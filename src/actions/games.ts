'use server'

// Расписание игр и записи на них (supabase/migrations/042_games.sql).
// Опубликованные игры отсюда забирает Telegram-бот через публичный API
// (src/app/api/public/games), записи из бота приходят обратно в
// game_bookings — CRM и бот работают с одной таблицей.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type {
  BookingStatus,
  Game,
  GameBooking,
  GameWithSeats,
  UserRole,
} from '@/types'

export type GameActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

export interface GameHost {
  id: string
  name: string
}

export interface GamesData {
  games: GameWithSeats[]
  bookings: GameBooking[]
  hosts: GameHost[]
  role: UserRole | null
}

/** Занятые места считаем здесь, а не в БД-поле: одна правда — сами брони. */
const HOLDS_SEAT: BookingStatus[] = ['booked', 'confirmed', 'attended']

export async function getGamesData(): Promise<GamesData> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { games: [], bookings: [], hosts: [], role: null }

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const [{ data: games }, { data: bookings }, { data: hosts }] = await Promise.all([
    supabase
      .from('games')
      .select('*')
      .is('deleted_at', null)
      .order('starts_at', { ascending: false }),
    supabase
      .from('game_bookings')
      .select('*')
      .order('created_at'),
    supabase
      .from('employees')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  const rows = (bookings ?? []) as GameBooking[]
  const taken = new Map<string, number>()
  for (const b of rows) {
    if (!HOLDS_SEAT.includes(b.status)) continue
    taken.set(b.game_id, (taken.get(b.game_id) ?? 0) + b.seats)
  }

  return {
    games: ((games ?? []) as Game[]).map((g) => ({
      ...g,
      seats_taken: taken.get(g.id) ?? 0,
    })),
    bookings: rows,
    hosts: (hosts ?? []) as GameHost[],
    role: (me as { role: UserRole } | null)?.role ?? null,
  }
}

// ─── Игра ────────────────────────────────────────────────────────────────────

const GameSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(200, 'Слишком длинное название'),
  starts_at: z.string().min(1, 'Укажите дату и время'),
  duration_min: z.number().int().min(30, 'Минимум 30 минут').max(600, 'Максимум 10 часов'),
  venue: z.string().trim().min(1, 'Укажите место').max(300, 'Слишком длинный адрес'),
  price: z.number().nonnegative('Цена не может быть отрицательной'),
  currency: z.enum(['KGS', 'USD', 'RUB']).default('KGS'),
  seats_total: z.number().int().min(1, 'Минимум 1 место').max(60, 'Максимум 60 мест'),
  host_employee_id: z.string().uuid().nullable().optional(),
  note: z.string().nullable().optional(),
  is_published: z.boolean().default(false),
  status: z.enum(['planned', 'done', 'cancelled']).default('planned'),
})

export type GameFormData = z.input<typeof GameSchema>

const clean = (value: string | null | undefined) => value?.trim() || null

export async function createGame(input: GameFormData): Promise<GameActionResult<{ id: string }>> {
  const parsed = GameSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  const g = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .insert({
      title: g.title,
      starts_at: g.starts_at,
      duration_min: g.duration_min,
      venue: g.venue,
      price: g.price,
      currency: g.currency,
      seats_total: g.seats_total,
      host_employee_id: g.host_employee_id ?? null,
      note: clean(g.note),
      is_published: g.is_published,
      status: g.status,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Не удалось создать игру' }
  }

  revalidatePath('/dashboard/games')
  return { success: true, data: { id: (data as { id: string }).id } }
}

export async function updateGame(id: string, input: GameFormData): Promise<GameActionResult> {
  const parsed = GameSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  const g = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('games')
    .update({
      title: g.title,
      starts_at: g.starts_at,
      duration_min: g.duration_min,
      venue: g.venue,
      price: g.price,
      currency: g.currency,
      seats_total: g.seats_total,
      host_employee_id: g.host_employee_id ?? null,
      note: clean(g.note),
      is_published: g.is_published,
      status: g.status,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Игра недоступна' }

  revalidatePath('/dashboard/games')
  return { success: true }
}

/** Публикация — единственное, что переключают из списка одним кликом. */
export async function setGamePublished(id: string, published: boolean): Promise<GameActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('games')
    .update({ is_published: published })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Игра недоступна' }

  revalidatePath('/dashboard/games')
  return { success: true }
}

/** Мягкое удаление: записи людей остаются, история не теряется. */
export async function deleteGame(id: string): Promise<GameActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('games')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Игра недоступна' }

  revalidatePath('/dashboard/games')
  return { success: true }
}

// ─── Записи ──────────────────────────────────────────────────────────────────

const BookingSchema = z.object({
  game_id: z.string().uuid('Выберите игру'),
  name: z.string().trim().min(1, 'Введите имя').max(200, 'Слишком длинное имя'),
  phone: z.string().trim().max(32, 'Слишком длинный номер').nullable().optional(),
  seats: z.number().int().min(1, 'Минимум 1 место').max(10, 'Максимум 10 мест'),
  note: z.string().nullable().optional(),
})

export type BookingFormData = z.input<typeof BookingSchema>

/** Ручная запись — когда человек позвонил или пришёл сам, минуя бота. */
export async function createBooking(input: BookingFormData): Promise<GameActionResult> {
  const parsed = BookingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  const b = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('game_bookings').insert({
    game_id: b.game_id,
    name: b.name,
    phone: clean(b.phone),
    seats: b.seats,
    source: 'manual',
    note: clean(b.note),
  })

  // Проверку мест делает триггер БД — двое могут записаться одновременно.
  if (error) {
    return {
      success: false,
      error: error.message.includes('Свободных мест нет')
        ? 'Свободных мест нет'
        : error.message,
    }
  }

  revalidatePath('/dashboard/games')
  return { success: true }
}

export async function setBookingStatus(
  id: string,
  status: BookingStatus
): Promise<GameActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('game_bookings')
    .update({ status })
    .eq('id', id)
    .select('id')

  if (error) {
    return {
      success: false,
      error: error.message.includes('Свободных мест нет')
        ? 'Свободных мест нет — сначала освободите место'
        : error.message,
    }
  }
  if (!data || data.length === 0) return { success: false, error: 'Запись недоступна' }

  revalidatePath('/dashboard/games')
  return { success: true }
}

export async function deleteBooking(id: string): Promise<GameActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('game_bookings').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/games')
  return { success: true }
}
