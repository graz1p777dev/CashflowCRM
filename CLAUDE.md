# Cashflow — CRM System

## Описание проекта

CRM клуба деловой игры CASHFLOW (Бишкек). Форк CRM Smilekit: то же ядро
(Next.js 16 + Supabase), но без магазинных модулей. Управление расписанием
игр и записями, сделками, сотрудниками, декомпозицией планов, финансами и
зарплатами.

### Домен: что продаётся

Продукт — участие в живой бизнес-игре CASHFLOW: вечер на 3–4 часа, 4–8
человек за столом, ведущий объясняет правила и разбирает решения после.

- Игра проходит по адресу Тоголок-Молдо 106, Бишкек. Цена и время у каждой
  игры свои — источник истины таблица `games`, а не тексты в коде.
- Мест ограниченное число (обычно 8). Свободные места считаются как
  `seats_total` минус активные брони — отдельного счётчика нет намеренно.
- **Не обещать, что игра починит личные финансы.** Она про мышление и
  практику решений; формулировки в CRM и боте держатся этой границы.
- Запись приходит из Telegram-бота (`~/Desktop/cashflow/bot`, aiogram) через
  `/api/public/*`. Бот детерминированный, без ИИ: тексты в
  `bot/cashflow_bot/templates.py`.

### Чего в этом форке нет

Разделов «Заказы», amoCRM, WhatsApp, «Рассылки», «ИИ-помощник» и
AI-лаборатории здесь нет — они были завязаны на магазин Smilekit. Если
понадобится похожее, брать за образец `~/Desktop/SmilekitCRM`, а не
восстанавливать по памяти.

**Supabase Project Ref:** завести отдельный проект под Cashflow и вписать
сюда ref после первого деплоя.

---

## Язык общения

**Весь текст — только на русском языке.** Украинский язык запрещён при любых обстоятельствах.
Код, имена файлов, функции, SQL, переменные окружения — на английском.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Framework | Next.js 14 App Router |
| База данных | Supabase (PostgreSQL 15+) |
| Типизация | TypeScript strict — no `any`, no `!` |
| Стили | Tailwind CSS v4 + inline styles |
| UI-компоненты | shadcn/ui |
| Иконки | lucide-react |
| Графики | Recharts |
| Уведомления | Sonner |
| Realtime | Supabase Realtime (WebSocket) |
| Auth | Supabase Auth + RLS |

---

## Архитектура

### Ключевые принципы

- **Server Components по умолчанию.** `'use client'` только при необходимости: Realtime, `useState`, `useEffect`, обработчики событий.
- **Server Actions для всех мутаций.** Никогда не вызывать Supabase напрямую из Client Component.
- **Suspense + Skeleton.** Каждый тяжёлый Server Component оборачивается в `<Suspense fallback={<Skeleton />}>`.
- **`Promise.all` для параллельных запросов** в Server Components.
- **RLS включён на всех 24 таблицах.** Фильтрация через `get_my_role()` и `get_my_employee_id()` (SECURITY DEFINER).
- **Soft delete** — `deleted_at TIMESTAMPTZ`. Активные записи: `WHERE deleted_at IS NULL`.

### Три Supabase клиента

```
src/lib/supabase/
  client.ts  — браузер (createBrowserClient), только NEXT_PUBLIC_ ключи
  server.ts  — Server Components (createServerClient + cookies)
  admin.ts   — Server Actions ТОЛЬКО (SUPABASE_SERVICE_ROLE_KEY)
```

> **КРИТИЧНО:** `SUPABASE_SERVICE_ROLE_KEY` никогда не попадает в клиентский код.
> `admin.ts` импортируется только из Server Actions и Route Handlers — никогда из `'use client'` файлов.

### Dashboard Layout — Split Focus Premium

```
┌──────────────────────────────────────────────────────┐
│ Topbar 52px — blur(12px), Realtime notification badge │
├────────────────────────┬─────────────────────────────┤
│ Left Panel 55%         │ Right Panel 45%             │
│ bg: #ffffff            │ bg: #f5f6f8                 │
│ Итоги месяца:          │ Сегодня:                    │
│  KPI Cards (4 шт.)     │  TodayCards                 │
│  RevenueWeeksChart     │  LiveFeed (Realtime)         │
│  PlanVsFactTable       │  TeamNow (owner/rop only)   │
│                        │  TodaySchedule              │
└────────────────────────┴─────────────────────────────┘
```

### Realtime-паттерн

Server Component фетчит `initialItems` → передаёт как prop в Client Component → Client подписывается на INSERT/UPDATE. Channel очищается в `return () => supabase.removeChannel(channel)`. Supabase стабилизируется через `useMemo(() => createClient(), [])`.

---

## Структура основных папок

```
src/
  app/
    dashboard/
      page.tsx              — Server Component, точка входа Dashboard
      layout.tsx            — Sidebar + Topbar
      error.tsx             — Next.js Error Boundary
      games/                — расписание игр и записи (ядро этого форка)
      deals/                — воронка записи на игру
      decomposition/        — планы и факт
      employees/
      finance/
      salary/
      settings/
    auth/login/
  components/
    dashboard/              — LeftPanel, RightPanel, TodayCards, LiveFeed, TeamNow...
    common/                 — KpiCard, BlockError, EmptyState, DashboardErrorBoundary
    layout/                 — Topbar.tsx
    Sidebar.tsx
  lib/
    supabase/               — client.ts / server.ts / admin.ts
    dashboard-queries.ts    — Все запросы для Dashboard (getMonthKpiStats, getLiveFeed...)
    formatters.ts           — formatMoney, formatDate, getInitials, getRuMonthName...
    constants.ts            — STATUS_MAP, BRAND, getKpiColor, KPI_THRESHOLDS
  types/
    index.ts                — Все типы: Employee, Consultation, LiveFeedItem, UserRole...
  config/
    nav.ts                  — NAV_GROUPS для Sidebar
  contexts/
    AuthContext.tsx          — Сессия + employee из таблицы employees
supabase/
  migrations/               — 001–042; игры и брони — 042_games.sql
docs/
  08_Database_Schema.md     — Схема БД, 24 таблицы
  09_Development_Rules.md   — Правила разработки
  11_Implementation_Backlog.md — Backlog, 10 Sprint-ов
middleware.ts               — Защита /dashboard/*, редирект accountant → /dashboard/finance
```

---

## Правила работы с Sprint

1. Работать **строго по `docs/11_Implementation_Backlog.md`**. Брать только задачи текущего Sprint.
2. **После завершения Sprint — сформировать отчёт и остановиться.** Ждать явного подтверждения.
3. Никогда не переходить к следующему Sprint без явного разрешения.
4. Никогда не вносить изменения в код вне задач текущего Sprint (рефакторинг, попутные правки).
5. Технический долг (`as unknown as`, `TODO`, `// @ts-nocheck`) — фиксировать в разделе **«Технический долг»** Sprint-отчёта.

### Формат Sprint-отчёта

- Таблица: ID задачи → статус ✅/❌
- Созданные и изменённые файлы
- Визуальные изменения
- Результаты проверок: `tsc`, `eslint`, `next build`
- Раздел «Технический долг»

### Текущий статус Sprint

| Sprint | Статус | Описание |
|--------|--------|----------|
| Sprint 0 | ✅ | Инфраструктура: migrations, types, clients, auth, middleware |
| Sprint 1 | ✅ | Layout: Sidebar, Topbar, структура Dashboard |
| Sprint 2 | ✅ | Dashboard Left Panel: KPI Cards, Chart, PlanVsFactTable |
| Sprint 3 | ✅ | Dashboard Right Panel: TodayCards, LiveFeed, TeamNow, TodaySchedule |
| Sprint 4 | ⏳ | Consultations module: CONS-01, 02, 03 |
| Sprint 5 | ⏳ | Decomposition module |
| Sprint 6 | ⏳ | Employees + Calendar |
| Sprint 7 | ⏳ | Finance + Salaries |
| Sprint 8 | ⏳ | Settings + Notifications + Documents |
| Sprint 9 | ⏳ | Integrations + Stabilization |

---

## Правила Git Commit

- Коммитить **после каждого Sprint**, не в процессе.
- Формат: `feat: Sprint N — краткое описание`
- Перечислять задачи по ID: `CONS-01: описание`
- Всегда добавлять: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Использовать HEREDOC для сообщения коммита.
- Staged files добавлять явно по имени — **никогда `git add .` или `git add -A`**.

---

## Правила работы с Supabase

### Какой клиент использовать

| Контекст | Клиент |
|----------|--------|
| Client Component (браузер) | `src/lib/supabase/client.ts` |
| Server Component | `src/lib/supabase/server.ts` |
| Server Action / Route Handler | `src/lib/supabase/admin.ts` |

### JOIN-типы (технический долг)

Supabase возвращает JOIN как `unknown`. Временное решение:
```typescript
(row.employees as unknown as { name: string }).name
```
Постоянное решение: `supabase gen types typescript --project-id rjzmxgiqleftwcsxgfte`.

### Проверки перед коммитом

```bash
npx tsc --noEmit           # 0 ошибок
npx eslint src/path/file   # только изменённые файлы, не весь src/
npx next build             # Compiled successfully
```

---

## Правила ролей пользователей

```
owner      → весь контент компании, без фильтров
rop        → только свой отдел (фильтр по department_id)
mp         → только свои данные (фильтр по employee_id)
lmai       → только свои данные (фильтр по employee_id)
accountant → редирект middleware на /dashboard/finance
```

### Паттерн фильтрации

```typescript
const filterById = (role === 'mp' || role === 'lmai') ? employeeId : undefined
const filterDept = role === 'rop' ? departmentId : undefined
// owner → undefined → RLS фильтрует без ограничений
```

Компоненты **только для owner/rop**: `TeamNow`, строка «Команда» в `PlanVsFactTable`.

---

## Цветовая палитра

Фирменные цвета Cashflow — тёмно-фиолетовый и золото. Источник истины —
токены в `src/app/globals.css`; hex ниже дублируется для быстрой сверки.

```
#430C61  — Brand        — акцент, кнопки, активные ссылки (--brand, --brand-ink)
#2C0740  — Brand Strong — тёмный фиолетовый, градиенты и нажатые состояния (--brand-strong)
#7B3FA0  — Brand Light  — вторая точка фирменного градиента, декор
#F3E9F8  — Brand Soft   — светлая подложка под бренд (--brand-soft)
#F4A300  — Gold         — золото логотипа (--gold), только заливки и декор
#FFD42A  — Gold Bright  — вторая точка золотого градиента (--gold-bright)
#781A3E  — Bordo        — бордовый палитры: «мест нет», отмены
#17102a  — Ink          — заголовки и основной текст (--ink, 17.4:1 на белом)
#4e4560  — Ink 2        — вторичный текст (--ink-2, 8.3:1)
#766d88  — Ink 3        — минимум для мелкого текста (--ink-3, 4.8:1)
#ffffff  — Surface      — карточки, панели, светлые плоскости
```

Шрифты — **Manrope** (текст) и **Unbounded** (заголовки, `.brand-wordmark`).
Фирменный знак — круглая плашка `.brand-mark` с логотипом из `public/`.

**Контраст — жёсткое требование.** Мелкий белый текст не ставить на светлый
фиолетовый (`#8a68ad`) и на янтарь (`#f5a623`) — контраста не хватает. Белым
по фиолетовому допустимо только на `#5115a4` / `#360e7f`. `--ink-4` (`#9a93a8`)
— только иконки и декор, не текст.

**Запрещено:** красный как фирменный цвет (`#e11d1d`, `#ff5c68`) — красный
теперь только сигнал ошибки (`--bad: #b91c1c`). Также запрещены тёмные плиты
вроде `bg-gray-950` в светлой теме.
Быстрая проверка: `grep -rn "#e11d1d\|#ff5c68" src/`

---

## Правила поиска файлов

- **Читать только файлы, необходимые для задачи.** Не открывать файл «для контекста».
- Для поиска символа: `grep -rn "SymbolName" src/` — не читать файлы подряд.
- Для структуры: `find src/ -name "*.tsx" | head -30` — не `ls -R`.
- **Типы** → `src/types/index.ts`
- **Запросы к БД** → `src/lib/dashboard-queries.ts`
- **Константы и форматтеры** → `src/lib/constants.ts`, `src/lib/formatters.ts`
- **Схема БД** → `docs/08_Database_Schema.md` (читать только нужный раздел)
- **Backlog** → `docs/11_Implementation_Backlog.md` (читать только текущий Sprint)

---

## Правила экономии контекста

- **Не анализировать весь проект без необходимости.** Точечный `grep` лучше чтения 10 файлов.
- **Не перечитывать файл после редактирования.** Edit/Write сообщают об ошибке — верификация чтением не нужна.
- **Не запускать повторные проверки без изменений кода.** Если `tsc` прошёл — не запускать снова.
- **`eslint` только по изменённым файлам Sprint**, не по всему `src/`.
- **Не выводить код, уже показанный в сессии.** Ссылаться на путь к файлу.
- **Документацию** читать по разделам, а не целиком.
- **Параллельные инструменты** — запускать независимые Bash-команды одновременно.

---

## Технический долг (накопленный)

| # | Файл | Описание | Исправить в |
|---|------|----------|------------|
| 1 | `dashboard-queries.ts` | `as unknown as { name: string }` для JOIN в `getLiveFeed` | После gen types |
| 2 | `dashboard-queries.ts` | `as unknown as { name: string }` для JOIN в `getTodaySchedule` | После gen types |
| 3 | `LiveFeed.tsx` | `manager_name` недоступен в Realtime payload — показывается `'—'` | Sprint 4 |
| 4 | `consultations/page.tsx` | `// @ts-nocheck` | Sprint 4 |
| 5 | `decomposition/page.tsx` | `// @ts-nocheck` | Sprint 5 |
| 6 | `employees/page.tsx` | `// @ts-nocheck` | Sprint 6 |
| 7 | `finance/page.tsx` | `// @ts-nocheck` | Sprint 7 |
| 8 | `ConsultationModal.tsx` | `// @ts-nocheck` | Sprint 4 |

Исправлять технический долг **только в рамках Sprint**, которому принадлежит файл.
