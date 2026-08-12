import type { BookingSource, BookingStatus, GameStatus } from '@/types'

// ─── Статусы записи ──────────────────────────────────────────────────────────
// booked → confirmed → attended — обычный путь. cancelled и no_show
// освобождают место: занятые места считаются только по первым трём.

export interface StatusMeta {
  label: string
  color: string
  bg: string
}

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
  booked:    { label: 'Записан',     color: '#0369a1', bg: '#e0f2fe' },
  confirmed: { label: 'Подтвердил',  color: '#8a5b00', bg: '#fff4db' },
  attended:  { label: 'Пришёл',      color: '#3f7d2e', bg: '#e7f6ec' },
  cancelled: { label: 'Отменил',     color: '#781a3e', bg: '#fdeaea' },
  no_show:   { label: 'Не пришёл',   color: '#574d4f', bg: '#f0eaea' },
}

/** Статусы, которые держат место. Должно совпадать с 042_games.sql. */
export const HOLDS_SEAT: BookingStatus[] = ['booked', 'confirmed', 'attended']

export const BOOKING_SOURCE: Record<BookingSource, string> = {
  bot: 'Telegram-бот',
  manual: 'Вручную',
  site: 'Сайт',
}

export const GAME_STATUS: Record<GameStatus, StatusMeta> = {
  planned:   { label: 'Запланирована', color: '#430c61', bg: '#f3e9f8' },
  done:      { label: 'Проведена',     color: '#3f7d2e', bg: '#e7f6ec' },
  cancelled: { label: 'Отменена',      color: '#781a3e', bg: '#fdeaea' },
}

/** «13 августа, четверг · 18:00» — так же, как игру называют в боте. */
export function formatGameWhen(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

/** Значение для <input type="datetime-local"> — он не понимает ISO с зоной. */
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
