// ─── /api/public/bookings ───────────────────────────────────────────────────
// Запись на игру из Telegram-бота.
//
//   POST  — записать (идемпотентно: повтор с того же чата обновляет бронь)
//   GET   — брони этого чата, чтобы бот показал «Мои записи»
//   PATCH — отмена или подтверждение брони самим человеком
//
// Свободные места проверяет БД-триггер (042_games.sql): двое могут нажать
// «Записаться» одновременно, и последнее место должно достаться одному.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardBotRequest, readJson } from '@/lib/public-api'
import { upsertDealFromInbound } from '@/lib/deals/auto-create'
import { advanceDealFromBotAction } from '@/lib/deals/advance-stage'
import { notify } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_SEATS = 'Свободных мест нет'

interface BookingPayload {
  gameId?: string
  name?: string
  phone?: string | null
  seats?: number
  telegramChatId?: number
  telegramUsername?: string | null
}

export async function POST(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const payload = await readJson<BookingPayload>(request)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { gameId, telegramChatId } = payload
  const name = payload.name?.trim()
  const seats = payload.seats ?? 1

  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!telegramChatId) {
    return NextResponse.json({ error: 'telegramChatId is required' }, { status: 400 })
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > 10) {
    return NextResponse.json({ error: 'seats must be 1..10' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: game } = await admin
    .from('games')
    .select('id, title, starts_at, seats_total, is_published, status')
    .eq('id', gameId)
    .is('deleted_at', null)
    .maybeSingle()
  const g = game as {
    id: string; title: string; starts_at: string
    seats_total: number; is_published: boolean; status: string
  } | null

  if (!g) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (!g.is_published || g.status !== 'planned') {
    return NextResponse.json({ error: 'Game is not open' }, { status: 409 })
  }

  // Сделка в воронке. Падение здесь не должно ломать запись: место человеку
  // важнее карточки в CRM, поэтому ошибку только логируем. Сделка заводится
  // до брони намеренно: даже если мест не хватило, человек остаётся лидом
  // в «Неразобранном» — ему можно предложить другую дату.
  const deal = await upsertDealFromInbound({
    externalKey: `tg:${telegramChatId}`,
    source: 'telegram',
    customerName: name,
    customerPhone: payload.phone ?? null,
    customerUsername: payload.telegramUsername ?? null,
  })
  if (deal.error) console.error('public/bookings: deal upsert failed', deal.error)

  const row = {
    game_id: gameId,
    name,
    phone: payload.phone?.trim() || null,
    telegram_chat_id: telegramChatId,
    telegram_username: payload.telegramUsername?.replace(/^@/, '') || null,
    seats,
    source: 'bot' as const,
    status: 'booked' as const,
    deal_id: deal.id,
  }

  // Повторная запись того же чата — обновление своей брони, а не вторая.
  const { data: inserted, error } = await admin
    .from('game_bookings')
    .upsert(row, { onConflict: 'game_id,telegram_chat_id' })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes(NO_SEATS)) {
      return NextResponse.json({ error: 'no_seats' }, { status: 409 })
    }
    console.error('public/bookings insert failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  await advanceDealFromBotAction(`tg:${telegramChatId}`, 'booked')

  await notify({
    type: 'game_booking',
    title: `Запись на игру: ${name}`,
    body: `${g.title} · мест: ${seats}${payload.phone ? ` · ${payload.phone}` : ''}`,
    actionUrl: '/dashboard/games',
    sourceType: 'game',
    sourceId: g.id,
  })

  const { data: taken } = await admin.rpc('game_seats_taken', { g_id: gameId })
  return NextResponse.json({
    ok: true,
    bookingId: (inserted as { id: string }).id,
    seatsFree: Math.max(0, g.seats_total - (Number(taken) || 0)),
  })
}

export async function GET(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const chatId = new URL(request.url).searchParams.get('chatId')
  if (!chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_bookings')
    .select('id, seats, status, games(id, title, starts_at, venue, price, currency)')
    .eq('telegram_chat_id', Number(chatId))
    .in('status', ['booked', 'confirmed', 'attended'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('public/bookings list failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  type Row = {
    id: string
    seats: number
    status: string
    games: {
      id: string; title: string; starts_at: string
      venue: string; price: number; currency: string
    } | null
  }

  return NextResponse.json({
    bookings: ((data ?? []) as unknown as Row[])
      .filter((b) => b.games)
      .map((b) => ({
        id: b.id,
        seats: b.seats,
        status: b.status,
        game: {
          id: b.games!.id,
          title: b.games!.title,
          startsAt: b.games!.starts_at,
          venue: b.games!.venue,
          price: Number(b.games!.price),
          currency: b.games!.currency,
        },
      })),
  })
}

interface PatchPayload {
  bookingId?: string
  telegramChatId?: number
  status?: 'cancelled' | 'confirmed'
}

export async function PATCH(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const payload = await readJson<PatchPayload>(request)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  if (!payload.bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
  }
  if (payload.status !== 'cancelled' && payload.status !== 'confirmed') {
    return NextResponse.json({ error: 'status must be cancelled|confirmed' }, { status: 400 })
  }
  // Человек через бота меняет только свою бронь: сверяем чат, иначе по
  // чужому id можно было бы отменить любую запись.
  if (!payload.telegramChatId) {
    return NextResponse.json({ error: 'telegramChatId is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_bookings')
    .update({ status: payload.status })
    .eq('id', payload.bookingId)
    .eq('telegram_chat_id', payload.telegramChatId)
    .select('id')

  if (error) {
    console.error('public/bookings patch failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (payload.status === 'confirmed') {
    await advanceDealFromBotAction(`tg:${payload.telegramChatId}`, 'confirmed')
  }

  return NextResponse.json({ ok: true })
}
