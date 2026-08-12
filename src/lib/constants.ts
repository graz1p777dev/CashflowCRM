import type {
  ConsultationStatus,
  ActualStatus,
  StatusAfterFv,
  AlbStatus,
  AttendanceStatus,
  UserRole,
  EmployeeStatus,
  SalaryStatus,
} from '@/types'

// ============================================================
// Consultation status labels & colors
// ============================================================

export const CONSULTATION_STATUS_MAP: Record<
  ConsultationStatus,
  { label: string; color: string; bg: string }
> = {
  'Придёт':      { label: 'Придёт',      color: '#166534', bg: '#dcfce7' },
  'Не придёт':   { label: 'Не придёт',   color: '#430c61', bg: '#fee2e2' },
  'Перезапись':  { label: 'Перезапись',  color: '#92400e', bg: '#fef3c7' },
  'Отменил':     { label: 'Отменил',     color: '#6b7280', bg: '#fdfbfb' },
  'Не отвечает': { label: 'Не отвечает', color: '#430c61', bg: '#fdfbfb' },
}

export const ACTUAL_STATUS_MAP: Record<
  ActualStatus,
  { label: string; color: string; bg: string }
> = {
  'Пришла':    { label: 'Пришла',    color: '#166534', bg: '#dcfce7' },
  'Не пришла': { label: 'Не пришла', color: '#430c61', bg: '#fee2e2' },
}

export const STATUS_AFTER_FV_MAP: Record<
  StatusAfterFv,
  { label: string; color: string; bg: string }
> = {
  'Купила':    { label: 'Купила',    color: '#166534', bg: '#dcfce7' },
  'Не купила': { label: 'Не купила', color: '#430c61', bg: '#fee2e2' },
  'Предоплата':{ label: 'Предоплата',color: '#430c61', bg: '#f3e9f8' },
  'Дожать':    { label: 'Дожать',    color: '#92400e', bg: '#fef3c7' },
  'Отказ':     { label: 'Отказ',     color: '#6b7280', bg: '#fdfbfb' },
}

export const NOTIFICATION_TYPE_MAP: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  server_load:            { label: 'Нагрузка сервера',     icon: '⚠️', color: '#430c61', bg: '#fee2e2' },
  sale_lead:               { label: 'Хочет купить',         icon: '🛒', color: '#166534', bg: '#bbf7d0' },
  order_new:                { label: 'Новый заказ',          icon: '📦', color: '#430c61', bg: '#f3e9f8' },
  consultation_booked:     { label: 'Запись на консультацию', icon: '📅', color: '#430c61', bg: '#f3e9f8' },
  consultation_reminder:   { label: 'Скоро консультация',   icon: '⏰', color: '#92400e', bg: '#fef3c7' },
  deploy:                   { label: 'Деплой',               icon: '🚀', color: '#430c61', bg: '#f3e9f8' },
  security:                 { label: 'Безопасность',         icon: '🔒', color: '#430c61', bg: '#fee2e2' },
  audit:                    { label: 'Изменение записи',     icon: '✏️', color: '#6b7280', bg: '#fdfbfb' },
  kpi_alert:                { label: 'KPI',                  icon: '📉', color: '#430c61', bg: '#fee2e2' },
  kpi_success:              { label: 'KPI',                  icon: '📈', color: '#166534', bg: '#dcfce7' },
  plan_100:                 { label: 'План выполнен',        icon: '🎯', color: '#166534', bg: '#dcfce7' },
  absence:                  { label: 'Отсутствие',           icon: '🚫', color: '#92400e', bg: '#fef3c7' },
  salary_ready:             { label: 'Зарплата',             icon: '💰', color: '#166534', bg: '#dcfce7' },
  finance_alert:            { label: 'Финансы',              icon: '💸', color: '#430c61', bg: '#fee2e2' },
  sale:                      { label: 'Продажа',              icon: '✅', color: '#166534', bg: '#dcfce7' },
  system:                   { label: 'Система',              icon: 'ℹ️', color: '#6b7280', bg: '#fdfbfb' },
}

export const ALB_STATUS_MAP: Record<
  AlbStatus,
  { label: string; color: string; bg: string }
> = {
  'Не записан': { label: 'Не записан', color: '#6b7280', bg: '#fdfbfb' },
  'Записан':    { label: 'Записан',    color: '#430c61', bg: '#f3e9f8' },
  'Пришёл':     { label: 'Пришёл',    color: '#166534', bg: '#dcfce7' },
  'Не пришёл':  { label: 'Не пришёл', color: '#430c61', bg: '#fee2e2' },
  'Купил':      { label: 'Купил',     color: '#166534', bg: '#bbf7d0' },
}

export const FORMAT_BADGE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  'Онлайн': { label: 'Онлайн', color: '#430c61', bg: '#f3e9f8' },
  'Офлайн': { label: 'Офлайн', color: '#c2410c', bg: '#ffedd5' },
}

// ============================================================
// Attendance status labels & colors
// ============================================================

export const ATTENDANCE_STATUS_MAP: Record<
  AttendanceStatus,
  { label: string; color: string; dot: string }
> = {
  // Точка несёт цвет и может быть яркой (это графика, порог 3:1),
  // а подпись рядом берёт затемнённый вариант того же тона — ей нужен AA.
  present:  { label: 'На месте',  color: '#15803d', dot: 'bg-[#16a34a]' },
  remote:   { label: 'Удалённо',  color: '#430c61', dot: 'bg-[#430c61]' },
  absent:   { label: 'Отсутствует',color: '#430c61',dot: 'bg-[#430c61]' },
  sick:     { label: 'Больничный',color: '#b45309', dot: 'bg-[#f59e0b]' },
  vacation: { label: 'Отпуск',    color: '#430c61', dot: 'bg-[#e2554d]' },
  day_off:  { label: 'Выходной',  color: '#6b7280', dot: 'bg-[#a19698]' },
  weekend:  { label: 'Выходной',  color: '#6b7280', dot: 'bg-[#a19698]' },
}

// ============================================================
// Employee role labels
// ============================================================

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:     'Владелец',
  rop:       'РОП',
  mp:        'МП',
  lmai:      'LMAI',
  accountant:'Бухгалтер',
}

export const EMPLOYEE_STATUS_MAP: Record<
  EmployeeStatus,
  { label: string; color: string }
> = {
  active:   { label: 'Активен',    color: '#15803d' },
  vacation: { label: 'В отпуске',  color: '#b45309' },
  sick:     { label: 'На больничном', color: '#430c61' },
  archived: { label: 'Архив',      color: '#6b7280' },
}

// ============================================================
// Salary status labels & colors
// ============================================================

export const SALARY_STATUS_MAP: Record<
  SalaryStatus,
  { label: string; color: string; bg: string }
> = {
  draft:    { label: 'Черновик',  color: '#6b7280', bg: '#fdfbfb' },
  approved: { label: 'Утверждён', color: '#92400e', bg: '#fef3c7' },
  paid:     { label: 'Выплачен',  color: '#166534', bg: '#dcfce7' },
}

// ============================================================
// KPI progress thresholds (color breakpoints)
// ============================================================

export const KPI_THRESHOLDS = {
  danger:  30,  // < 30% → crimson
  warning: 60,  // 30–60% → amber
  brand:   90,  // 60–90% → brand red
  success: 100, // ≥ 90% → green
} as const

export function getKpiColor(pct: number): string {
  if (pct < KPI_THRESHOLDS.danger)  return '#430c61' // deep crimson (danger)
  if (pct < KPI_THRESHOLDS.warning) return '#b45309' // amber
  if (pct < KPI_THRESHOLDS.success) return '#430c61' // brand red
  return '#15803d'                                    // green
}

// ============================================================
// Finance transaction types
// ============================================================

export const TRANSACTION_TYPE_LABELS = {
  income:  { label: 'Доход',  color: '#15803d' },
  expense: { label: 'Расход', color: '#430c61' },
} as const

// ============================================================
// Brand palette (from Design System)
// ============================================================

export const BRAND = {
  ink:      '#1b1517',
  accent:   '#430c61',
  steel:    '#7d7174',
  fog:      '#ebebee',
  sidebar:  '#1b1517',
} as const
