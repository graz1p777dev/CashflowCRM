-- ============================================================
-- Migration 042: игры Cashflow, записи на них и переписка бота
--
-- Три таблицы:
--   games         — расписание игр. Опубликованные игры (is_published)
--                   видит Telegram-бот через публичный API; черновики
--                   живут только в CRM.
--   game_bookings — записи людей. UNIQUE (game_id, telegram_chat_id) —
--                   ключ идемпотентности: повторное нажатие «Записаться»
--                   в боте не создаёт вторую бронь.
--   bot_messages  — переписка бота с человеком, только для чтения в CRM
--                   (карточка сделки). Отвечают в самом боте.
--
-- Свободные места НЕ хранятся отдельным полем: считаются как
-- seats_total − сумма seats у активных броней (games_seats_taken ниже).
-- Отдельный счётчик пришлось бы синхронизировать триггерами, и он всё
-- равно разъехался бы при ручной правке брони.
-- ============================================================

-- ------------------------------------------------------------
-- Игры
-- ------------------------------------------------------------
CREATE TABLE public.games (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL DEFAULT 'Игра CASHFLOW',
  -- Момент начала игры. TIMESTAMPTZ, а не date+time: бот показывает время
  -- людям, и часовой пояс должен быть однозначным.
  starts_at     TIMESTAMPTZ  NOT NULL,
  duration_min  INTEGER      NOT NULL DEFAULT 210,
  venue         VARCHAR(300) NOT NULL DEFAULT 'Тоголок-Молдо 106, Бишкек',
  price         NUMERIC(10,2) NOT NULL DEFAULT 1500,
  currency      TEXT         NOT NULL DEFAULT 'KGS',
  seats_total   INTEGER      NOT NULL DEFAULT 8,
  -- Ведущий игры. Сотрудник CRM: у него в карточке видно, сколько провёл.
  host_employee_id UUID      REFERENCES public.employees(id) ON DELETE SET NULL,
  -- Заметка для команды. Боту не показывается.
  note          TEXT,
  -- Черновик не виден в боте: игру готовят заранее, публикуют осознанно.
  is_published  BOOLEAN      NOT NULL DEFAULT FALSE,
  status        TEXT         NOT NULL DEFAULT 'planned',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  CONSTRAINT games_currency_check CHECK (currency IN ('KGS','USD','RUB')),
  CONSTRAINT games_status_check   CHECK (status IN ('planned','done','cancelled')),
  CONSTRAINT games_seats_check    CHECK (seats_total BETWEEN 1 AND 60),
  CONSTRAINT games_duration_check CHECK (duration_min BETWEEN 30 AND 600),
  CONSTRAINT games_price_check    CHECK (price >= 0),
  CONSTRAINT games_title_check    CHECK (btrim(title) <> '')
);

CREATE INDEX idx_games_starts    ON public.games(starts_at);
CREATE INDEX idx_games_published ON public.games(is_published, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_games_host      ON public.games(host_employee_id);

CREATE TRIGGER trg_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Записи на игру
-- ------------------------------------------------------------
CREATE TABLE public.game_bookings (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID         NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  phone            VARCHAR(32),
  telegram_chat_id BIGINT,
  telegram_username VARCHAR(120),
  -- Сколько мест занял: человек может привести с собой друга.
  seats            INTEGER      NOT NULL DEFAULT 1,
  -- Откуда пришла запись. 'bot' — Telegram, 'manual' — завёл менеджер.
  source           TEXT         NOT NULL DEFAULT 'bot',
  status           TEXT         NOT NULL DEFAULT 'booked',
  -- Сделка в воронке, если бот успел её завести.
  deal_id          UUID         REFERENCES public.deals(id) ON DELETE SET NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT game_bookings_seats_check  CHECK (seats BETWEEN 1 AND 10),
  CONSTRAINT game_bookings_source_check CHECK (source IN ('bot','manual','site')),
  CONSTRAINT game_bookings_status_check CHECK (status IN ('booked','confirmed','attended','cancelled','no_show')),
  CONSTRAINT game_bookings_name_check   CHECK (btrim(name) <> '')
);

-- Идемпотентность записи из бота: одна бронь на игру с одного чата.
-- Отменённая бронь тоже занимает ключ — человек не должен «дублироваться»,
-- вместо этого бот возвращает его же бронь и меняет ей статус.
CREATE UNIQUE INDEX idx_game_bookings_chat
  ON public.game_bookings(game_id, telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX idx_game_bookings_game   ON public.game_bookings(game_id, created_at);
CREATE INDEX idx_game_bookings_phone  ON public.game_bookings(phone);
CREATE INDEX idx_game_bookings_deal   ON public.game_bookings(deal_id);

CREATE TRIGGER trg_game_bookings_updated_at
  BEFORE UPDATE ON public.game_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Занятые места. Отменённые и не пришедшие место не держат.
-- STABLE-функция, а не VIEW: её зовут и RLS-политика записи, и API бота.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.game_seats_taken(g_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(seats), 0)::INTEGER
  FROM public.game_bookings
  WHERE game_id = g_id
    AND status IN ('booked','confirmed','attended');
$$;

GRANT EXECUTE ON FUNCTION public.game_seats_taken(UUID) TO authenticated, service_role;

-- Перебронировать игру нельзя даже из бота: проверка в БД, а не в коде,
-- потому что два человека могут нажать «Записаться» одновременно.
CREATE OR REPLACE FUNCTION public.check_game_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  total INTEGER;
  taken INTEGER;
BEGIN
  IF NEW.status NOT IN ('booked','confirmed','attended') THEN
    RETURN NEW;
  END IF;

  SELECT seats_total INTO total FROM public.games WHERE id = NEW.game_id;
  SELECT COALESCE(SUM(seats), 0)::INTEGER INTO taken
    FROM public.game_bookings
   WHERE game_id = NEW.game_id
     AND status IN ('booked','confirmed','attended')
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF taken + NEW.seats > total THEN
    RAISE EXCEPTION 'Свободных мест нет: занято %, всего %', taken, total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_game_bookings_seats
  BEFORE INSERT OR UPDATE OF seats, status, game_id ON public.game_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_game_seats();

-- ------------------------------------------------------------
-- Переписка бота. Пишет только бот (service_role), CRM читает.
-- ------------------------------------------------------------
CREATE TABLE public.bot_messages (
  id         BIGSERIAL   PRIMARY KEY,
  chat_id    TEXT        NOT NULL,
  direction  TEXT        NOT NULL,
  sender     TEXT        NOT NULL DEFAULT 'client',
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bot_messages_direction_check CHECK (direction IN ('in','out')),
  CONSTRAINT bot_messages_sender_check    CHECK (sender IN ('client','bot','operator'))
);

CREATE INDEX idx_bot_messages_chat ON public.bot_messages(chat_id, created_at);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages  ENABLE ROW LEVEL SECURITY;

-- Расписание игр видят все сотрудники: ведущий, РОП, бухгалтер — всем
-- нужно знать, когда игра. Правят владелец, РОП и менеджеры.
CREATE POLICY "games_select" ON public.games
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "games_insert" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('owner','rop','mp','lmai'));

CREATE POLICY "games_update" ON public.games
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('owner','rop','mp','lmai'))
  WITH CHECK (public.get_my_role() IN ('owner','rop','mp','lmai'));

-- Удаление мягкое (deleted_at через UPDATE); жёсткое — только владельцу.
CREATE POLICY "games_delete" ON public.games
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'owner');

CREATE POLICY "game_bookings_select" ON public.game_bookings
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "game_bookings_insert" ON public.game_bookings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('owner','rop','mp','lmai'));

CREATE POLICY "game_bookings_update" ON public.game_bookings
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('owner','rop','mp','lmai'))
  WITH CHECK (public.get_my_role() IN ('owner','rop','mp','lmai'));

CREATE POLICY "game_bookings_delete" ON public.game_bookings
  FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('owner','rop'));

-- Переписку читают те же, кто видит воронку. INSERT-политики нет
-- намеренно: сообщения кладёт бот через service_role.
CREATE POLICY "bot_messages_select" ON public.bot_messages
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('owner','rop','mp','lmai'));

-- ------------------------------------------------------------
-- GRANT'ы — см. пояснение в 035_role_grants.sql.
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_bookings TO authenticated;
GRANT SELECT                         ON public.bot_messages  TO authenticated;

GRANT ALL ON public.games         TO service_role;
GRANT ALL ON public.game_bookings TO service_role;
GRANT ALL ON public.bot_messages  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bot_messages_id_seq TO service_role;

-- ------------------------------------------------------------
-- Новый тип уведомления: запись на игру. Список типов — CHECK, а не
-- справочник, поэтому расширяется миграцией (см. 031_notifications_extend).
-- ------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'kpi_alert','kpi_success','plan_100','absence',
    'salary_ready','finance_alert','system','sale',
    'consultation_booked','consultation_reminder','sale_lead',
    'server_load','deploy','security','audit','game_booking'
  )
);

-- Realtime — карточка игры показывает новые записи без перезагрузки.
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
