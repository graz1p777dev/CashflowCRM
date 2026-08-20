# CASHFLOW CRM — полное описание проекта

CRM клуба деловой игры CASHFLOW (Бишкек). Форк [SmilekitCRM](../SmilekitCRM): то же ядро (Next.js + Supabase), но без магазинных модулей — управление расписанием игр, записями, сделками, сотрудниками, декомпозицией планов, финансами и зарплатами.

## Домен: что продаётся

Продукт — участие в живой бизнес-игре CASHFLOW: вечер на 3–4 часа, 4–8 человек за столом, ведущий объясняет правила и разбирает решения после игры.

- Игра проходит по адресу Тоголок-Молдо 106, Бишкек (значение по умолчанию). Цена, время и адрес у каждой игры свои — источник истины таблица `games`, а не тексты в коде.
- Мест ограниченное число (обычно 8, поле `seats_total`). Свободные места считаются как `seats_total` минус активные брони — отдельного счётчика нет намеренно, чтобы не рассинхронизировался при ручной правке.
- **Игра не чинит личные финансы.** Она про мышление и практику решений — эта граница соблюдается в текстах и CRM, и бота.
- Запись приходит из Telegram-бота (`~/Desktop/cashflow/bot`, aiogram) через `/api/public/*`. Бот детерминированный, без ИИ — все тексты в `bot/cashflow_bot/templates.py`.

Чего в этом форке нет (специально исключено из SmilekitCRM): «Заказы», amoCRM, WhatsApp, «Рассылки», «ИИ-помощник», AI-лаборатория, склад — всё было завязано на магазинную часть Smilekit. За образцом для восстановления идти в `~/Desktop/SmilekitCRM`, а не по памяти.

## Стек технологий

| Слой | Технология |
|---|---|
| Framework | Next.js `16.3.0`, React `19.2.4`, App Router |
| БД | Supabase — PostgreSQL 15+, Auth, Realtime |
| Типизация | TypeScript strict — без `any`, без `!` |
| Стили | Tailwind CSS v4 + inline styles |
| UI | shadcn/ui, `@base-ui/react`, lucide-react |
| Графики | recharts |
| Формы | zod |
| Даты | date-fns |
| Уведомления в UI | sonner |

> В CLAUDE.md указано «Next.js 14 App Router» — расхождение с фактической версией в `package.json` (16.3.0), документация не обновлена после апгрейда.

Скрипты: `dev`, `build`, `start`, `lint`, `seed:owner` (`node scripts/seed-owner.mjs`).

## Архитектура

### Три Supabase-клиента (`src/lib/supabase/`)
- `client.ts` — браузер, только `NEXT_PUBLIC_*` ключи
- `server.ts` — Server Components (cookies)
- `admin.ts` — только Server Actions/Route Handlers, `SUPABASE_SERVICE_ROLE_KEY`, никогда не импортируется из `'use client'`

### Принципы
- Server Components по умолчанию, `'use client'` только при необходимости
- Все мутации — через Server Actions, клиентские компоненты никогда не дёргают Supabase напрямую
- Suspense + Skeleton на каждом тяжёлом Server Component
- `Promise.all` для параллельных запросов
- RLS включён на всех таблицах, фильтрация через SECURITY DEFINER-функции `get_my_role()`, `get_my_employee_id()`, `get_my_department_id()`
- Soft delete через `deleted_at TIMESTAMPTZ`

### Dashboard layout — «Split Focus Premium»
Topbar 52px (blur, realtime-бейдж) → левая панель 55% (KPI-карточки, `RevenueWeeksChart`, `PlanVsFactTable`) + правая панель 45% (`TodayCards`, `LiveFeed` realtime, `TeamNow` — только owner/rop, `TodaySchedule`).

### middleware.ts
Matcher: `/dashboard/:path*`, `/chat/:path*`, `/inventory/:path*`, `/cashier`, `/auth/:path*`.
- Проверяет пользователя через `supabase.auth.getUser()`
- Без сессии → редирект на `/auth/login`
- Роль `cashier` → жёсткий редирект на `/cashier` (наследие Smilekit — товароучёт/касса Cashflow не используется, но код в middleware остался)
- На auth-страницах с активной сессией → редирект в `/dashboard`

### Структура src/
```
src/
  actions/     account, audit, auth, company-plan, deals, documents,
               employees, games, kpi-settings, notifications, settings, tasks
  app/
    api/internal/  deals/route.ts, notify/route.ts
    api/public/    bookings/, games/, messages/, reminders/
    auth/          callback, change-password, dev-login, forgot-password,
                    login, register, reset-password
    dashboard/
      calendar/, deals/, decomposition/, documents/, employees/[id]/,
      finance/, games/, help/, marketing/, notifications/, salary/,
      settings/, tasks/
  components/  dashboard/, deals/, decomposition/, employees/, finance/,
               games/, marketing/, notifications/, tasks/, layout/, ui/, charts/
  config/      nav.ts, help-content.ts
  contexts/    AuthContext.tsx
  lib/         supabase/, dashboard-queries.ts, formatters.ts, constants.ts,
               deals/ (advance-stage.ts, auto-create.ts),
               notifications/notify.ts, public-api.ts, phone.ts
  types/       index.ts
```

**Технический долг форка:** в `src/lib/data`, `src/lib/providers`, `src/lib/services` остались адаптеры/мапперы Smilekit (finance, marketing, warehouse, salary) — репозиторная архитектура, унаследованная при форке и не описанная в CLAUDE.md. Также найдено два роута логина (`src/app/auth/login/` и `src/app/login/`) — возможный дубль.

## База данных

42 миграции (`supabase/migrations/001…042` + `20260810154527_add_deal_city_address.sql`).

### Все таблицы

| Таблица | Миграция | Назначение |
|---|---|---|
| `roles`, `permissions` | 002 | справочник ролей и матрица прав role×resource×scope |
| `departments` | 003 | отделы |
| `employees` | 004 | сотрудники — центральная таблица, связывает `auth.users` с бизнес-данными |
| `schedules`, `attendance` | 005 | графики и отметки посещаемости |
| `kpi_templates`, `employee_kpi` | 006 | KPI-шаблоны и назначенные KPI |
| `consultations` | 007 | консультации (наследие Smilekit) |
| `daily_facts`, `decomposition` | 008 | ежедневные факты и план-факт по месяцу |
| `salaries`, `salary_calculations` | 009 | зарплаты и лог расчёта |
| `finance_categories`, `finance_transactions`, `finances` | 010 | финансовый модуль |
| `investors`, `investor_payouts` | 011 | инвесторы и выплаты |
| `notifications` | 012 (расширена 031, 042) | системные уведомления |
| `documents`, `document_folders` | 013, 033 | документы и папки |
| `integrations`, `settings` | 014 | интеграции и настройки |
| `audit_logs` | 015 | аудит-лог |
| `work_schedules` | 026 | графики работы (доп.) |
| `kpi_role_settings`, `kpi_plan_tiers`, `kpi_daily_tiers`, `kpi_items`, `employee_kpi_results`, `employee_kpi_item_results`, `advance_payments` | 028 | редизайн KPI/зарплаты |
| `kpi_bonus_blocks`, `kpi_bonus_tiers` | 029 | бонусные блоки KPI |
| `company_plans` | 030 | планы компании |
| `tasks`, `task_members` | 032 | задачи (kanban) |
| `deal_stages`, `deals`, `deal_events` | 036 (+ city/address) | воронка продаж/записи на игру |
| `games`, `game_bookings`, `bot_messages` | 042 | **ядро форка**: игры, брони, переписка бота |

### Ключевые таблицы форка

**`games`** — `id`, `title` (default «Игра CASHFLOW»), `starts_at TIMESTAMPTZ`, `duration_min` (default 210), `venue` (default «Тоголок-Молдо 106, Бишкек»), `price NUMERIC(10,2)` (default 1500), `currency` (KGS/USD/RUB), `seats_total` (1–60, default 8), `host_employee_id → employees`, `is_published BOOLEAN` (черновики боту не видны), `status` (planned/done/cancelled), `deleted_at`. RLS: SELECT всем authenticated; INSERT/UPDATE — owner/rop/mp/lmai; жёсткое DELETE — только owner. Realtime включён.

**`game_bookings`** — `id`, `game_id → games CASCADE`, `name`, `phone`, `telegram_chat_id BIGINT`, `telegram_username`, `seats` (1–10), `source` (bot/manual/site), `status` (booked/confirmed/attended/cancelled/no_show), `deal_id → deals SET NULL`.

- `UNIQUE (game_id, telegram_chat_id)` — идемпотентность записи: повторный клик «Записаться» не создаёт вторую бронь, а через `ON CONFLICT` обновляет статус существующей.
- Функция `game_seats_taken(g_id)` — STABLE SQL, считает занятые места; используется и RLS, и API бота.
- Триггер `trg_game_bookings_seats` (BEFORE) через `check_game_seats()` — не даёт перебронировать игру даже при гонке двух одновременных запросов (проверка в БД, не в коде).

**`bot_messages`** — `id BIGSERIAL`, `chat_id`, `direction` (in/out), `sender` (client/bot/operator), `text` (обрезается до 4000 символов). RLS: только SELECT (owner/rop/mp/lmai) — INSERT-политики нет намеренно, пишет только бот через `service_role`.

**`deals`** — `id`, `title`, `stage_id → deal_stages RESTRICT`, `amount`, `currency`, `customer_name/phone/username`, `source` (telegram/whatsapp/instagram/manual/site), `external_key TEXT UNIQUE` (ключ идемпотентности `tg:<chat_id>`), `responsible_employee_id → employees`, `status` (open/won/lost, синхронизируется триггером), `deleted_at`.

- Триггер `trg_deals_sync_stage_state` → `sync_deal_stage_state()` — проставляет `status` из типа этапа
- Триггер `trg_deals_log_stage_change` (AFTER, SECURITY DEFINER) → пишет в `deal_events` (append-only журнал)
- Функция `can_see_deal(responsible)`: owner/rop видят всё; mp/lmai — свои сделки + «ничьи» (`responsible IS NULL`, «Неразобранное»)
- 7 стадий воронки: Неразобранное(default) → Начал запись → Оставил контакты → Записан на игру → Подтвердил участие → Пришёл на игру(won) / Не пришёл(lost)

**`employees`** — `id`, `user_id UNIQUE → auth.users`, `department_id`, `role` (owner/rop/mp/lmai/accountant), `base_salary`, `kpi_coefficient` (default 1.0), `schedule_type`, `status` (active/probation/archived), `deleted_at`. RLS: owner/accountant видят всех; rop — свой отдел + себя; mp/lmai — только себя.

**`notifications`** — типы (CHECK): kpi_alert, kpi_success, plan_100, absence, salary_ready, finance_alert, system, sale, consultation_booked, consultation_reminder, sale_lead, server_load, deploy, security, audit, **game_booking**. RLS: каждый видит свои, owner — все. Realtime включён.

## Роли и права

| Роль | Доступ |
|---|---|
| `owner` | весь контент компании, без ограничений |
| `rop` | руководитель отдела продаж — свой отдел, вся воронка и команда |
| `mp` | менеджер по продажам — только свои данные; в сделках свои + «ничьи» |
| `lmai` | менеджер по лидогенерации — аналогично mp |
| `accountant` | доступ к финансам/зарплатам (по CLAUDE.md; явный редирект в middleware.ts не подтверждён чтением кода) |
| `cashier` | наследие Smilekit — middleware жёстко редиректит на `/cashier` |

Паттерн фильтрации:
```ts
const filterById = (role === 'mp' || role === 'lmai') ? employeeId : undefined
const filterDept = role === 'rop' ? departmentId : undefined
// owner → undefined → RLS фильтрует без ограничений
```

## Telegram-бот (`~/Desktop/cashflow/bot`)

Python, aiogram `3.30.0`, aiohttp `3.14.3`, pydantic-settings. Деплой на Railway, режим поллинга (`Procfile`: `worker: python -m cashflow_bot`), рестарт до 10 попыток при сбое.

```
cashflow_bot/
  __main__.py   — вход: поллинг + фоновый планировщик
  config.py     — pydantic-settings, переменные окружения
  handlers.py   — диалог (state machine)
  keyboards.py  — inline-кнопки
  templates.py  — все тексты (бот детерминированный, без ИИ)
  crm.py        — HTTP-клиент /api/public/* CRM
  storage.py    — SQLite (data/cashflow.db): состояние диалога, дожимы, напоминания
  scheduler.py  — фоновые дожимы и напоминания (тик каждые 120с по умолчанию)
```

State machine хранится в SQLite (таблица `funnels`), а не в памяти процесса — переживает передеплой на Railway. Шаги: `menu → games → seats → name → phone → done`.

**Сценарии:**
- `/start` — приветствие (разное для новых/вернувшихся)
- Рассказ об игре — 4 экрана с кнопкой «Дальше»
- Запись: дата (из CRM) → количество мест → имя → телефон → `POST /bookings`. Постоянным гостям данные не переспрашивают повторно
- «Мои записи» — `GET /bookings?chatId=`, кнопки «Буду»/«Не смогу» → `PATCH /bookings`
- Дожимы: 3 касания через 0.5ч/6ч/24ч (`FOLLOWUP_HOURS`) для тех, кто не закончил запись
- Напоминания: за сутки (с кнопками подтверждения) и в день игры (`REMINDER_HOURS`)
- Вся переписка дублируется в CRM через `POST /api/public/messages`

⚠️ **SQLite на Railway без volume пропадает при каждом деплое** — теряются незаконченные диалоги, возможны повторные напоминания. Сами брони не затрагиваются (хранятся в Supabase). Рекомендуется подключить volume на `data/`.

CRM-клиент бота не роняет диалог при недоступности CRM — все методы возвращают `None`; отсутствие мест (409) логируется как рабочий кейс, не ошибка.

## Публичный API (`/api/public/*`)

Требует заголовок `x-bot-token: $BOT_API_TOKEN` (`guardBotRequest()` в `src/lib/public-api.ts`).

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/public/games` | Список опубликованных будущих игр с `seatsFree`, лимит 20 |
| POST | `/api/public/bookings` | Запись на игру: `{gameId, name, phone?, seats, telegramChatId, telegramUsername?}`. Заводит/находит сделку, апсертит бронь по `(game_id, telegram_chat_id)`, при нехватке мест → 409 `{error: 'no_seats'}` |
| GET | `/api/public/bookings?chatId=` | Активные брони чата, join с `games` |
| PATCH | `/api/public/bookings` | `{bookingId, telegramChatId, status}` — отмена/подтверждение своей брони |
| GET | `/api/public/reminders?withinHours=` | Брони с игрой в ближайшие N часов (1–72, default 26) |
| POST | `/api/public/messages` | `{chatId, direction, sender?, text}` — лог переписки в `bot_messages` |

### Внутренний API (`/api/internal/*`)
Заголовок `x-internal-token: $INTERNAL_NOTIFY_TOKEN`.

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/internal/notify` | Создать системное уведомление |
| POST | `/api/internal/deals` | Завести сделку по входящему сообщению |
| PATCH | `/api/internal/deals` | Продвинуть сделку по воронке |

> Комментарии в коде ссылаются на методы `push_deal`/`push_stage` в `bot/cashflow_bot/crm.py`, которых в текущем коде бота нет — сделки продвигаются напрямую внутри `/api/public/bookings`. Ручка `/api/internal/deals`, вероятно, задел под будущую интеграцию.

## Ключевые бизнес-процессы

**Запись на игру:** менеджер публикует игру (`is_published=true`) → бот показывает дату/места → пользователь записывается → создаются `game_bookings` + сопутствующая сделка → уведомление в CRM (`game_booking`) → бот напоминает за сутки и в день игры → менеджер отмечает пришедших (`attended`/`no_show`).

**Воронка сделок:** движение по 7 стадиям, автосоздание по первому контакту (idempotent по `external_key`), автопродвижение по действиям бота (started/contact/booked/confirmed/attended/no_show).

**Финансы:** `finance_categories` (income/expense) → `finance_transactions` → `finances`.

**Зарплаты:** `salaries` (период, база, KPI-бонус, вычеты, статус draft/calculated/paid) + `salary_calculations` (лог расчёта) + KPI-редизайн 028–029 (`kpi_role_settings`, `kpi_plan_tiers`, `kpi_bonus_blocks` и т.д.).

**Декомпозиция:** `daily_facts` (ежедневные факты по сотруднику) + `decomposition` (агрегат план-факт по месяцу) + `company_plans`.

## Переменные окружения

**CRM (`.env.example`):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=              # прямое подключение для миграций (только пулер, IPv6 недоступен)
AUTH_BYPASS=                  # локальный просмотр без формы входа — на проде быть не должно
DEV_LOGIN_EMAIL=
DEV_LOGIN_PASSWORD=
INTERNAL_NOTIFY_TOKEN=        # секрет для /api/internal/*
BOT_API_TOKEN=                # секрет для /api/public/*, совпадает с CRM_BOT_TOKEN бота
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Бот (`.env.example`):**
```
TELEGRAM_BOT_TOKEN=
CRM_BASE_URL=https://cashflow-crm.up.railway.app
CRM_BOT_TOKEN=
DATABASE_PATH=data/cashflow.db
TIMEZONE=Asia/Bishkek
FOLLOWUP_HOURS=0.5,6,24
REMINDER_HOURS=24,3
```

## Запуск локально

```bash
cp .env.example .env.local   # заполнить ключи Supabase
npm install
npm run dev
```

Миграции применяются по порядку на чистом проекте Supabase.

## Текущий статус

**Git-история:** CRM — 2 коммита (`684aa5e` форк от Smilekit, `7ddf830` фикс upsert броней + локальный стек); бот — 1 коммит (`8361420`).

**Спринты (из CLAUDE.md):**

| Sprint | Статус | Содержание |
|---|---|---|
| 0 | ✅ | Инфраструктура: миграции, типы, клиенты, auth, middleware |
| 1 | ✅ | Layout: Sidebar, Topbar, структура Dashboard |
| 2 | ✅ | Dashboard Left Panel: KPI-карточки, график, план-факт |
| 3 | ✅ | Dashboard Right Panel: TodayCards, LiveFeed, TeamNow, TodaySchedule |
| 4 | ⏳ | Consultations |
| 5 | ⏳ | Decomposition |
| 6 | ⏳ | Employees + Calendar |
| 7 | ⏳ | Finance + Salaries |
| 8 | ⏳ | Settings + Notifications + Documents |
| 9 | ⏳ | Integrations + Stabilization |

Разделы Sprint 4–9 физически присутствуют в коде (унаследованы при форке из Smilekit), но помечены как не принятые: `consultations/page.tsx`, `decomposition/page.tsx`, `employees/page.tsx`, `finance/page.tsx`, `ConsultationModal.tsx` — все с `// @ts-nocheck`.

**Реально готово и рабочее ядро форка:** раздел «Игры» (публикация, брони, seats-логика в БД с защитой от гонок), «Сделки» (воронка записи на игру), интеграция с Telegram-ботом через `/api/public/*` и `/api/internal/*`, Dashboard с Realtime.

**Зафиксированный технический долг:**
1. `dashboard-queries.ts` — `as unknown as {name: string}` в `getLiveFeed` и `getTodaySchedule` (JOIN без типов)
2. `LiveFeed.tsx` — `manager_name` недоступен в Realtime payload, показывается «—»
3. `// @ts-nocheck` в 5 файлах (см. выше)
