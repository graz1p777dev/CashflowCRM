// ─── GET /api/public/games ──────────────────────────────────────────────────
// Список игр для Telegram-бота: только опубликованные, только будущие,
// со свободными местами. Черновики и отменённые игры бот не видит вовсе —
// фильтрация здесь, а не в боте, чтобы «скрыть игру» работало сразу.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardBotRequest } from '@/lib/public-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GameRow {
  id: string
  title: string
  starts_at: string
  duration_min: number
  venue: string
  price: number
  currency: string
  seats_total: number
}

export async function GET(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const admin = createAdminClient()

  // Игра, которая началась час назад, боту уже не нужна, а «сегодня в 18:00»
  // при запросе в 18:05 — ещё интересна: берём с запасом в час назад.
  const from = new Date(Date.now() - 3600_000).toISOString()

  const { data: games, error } = await admin
    .from('games')
    .select('id, title, starts_at, duration_min, venue, price, currency, seats_total')
    .eq('is_published', true)
    .eq('status', 'planned')
    .is('deleted_at', null)
    .gte('starts_at', from)
    .order('starts_at')
    .limit(20)

  if (error) {
    console.error('public/games failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const rows = (games ?? []) as GameRow[]
  if (rows.length === 0) return NextResponse.json({ games: [] })

  const { data: bookings } = await admin
    .from('game_bookings')
    .select('game_id, seats, status')
    .in('game_id', rows.map((g) => g.id))
    .in('status', ['booked', 'confirmed', 'attended'])

  const taken = new Map<string, number>()
  for (const b of (bookings ?? []) as { game_id: string; seats: number }[]) {
    taken.set(b.game_id, (taken.get(b.game_id) ?? 0) + b.seats)
  }

  return NextResponse.json({
    games: rows.map((g) => ({
      id: g.id,
      title: g.title,
      startsAt: g.starts_at,
      durationMin: g.duration_min,
      venue: g.venue,
      price: Number(g.price),
      currency: g.currency,
      seatsTotal: g.seats_total,
      seatsFree: Math.max(0, g.seats_total - (taken.get(g.id) ?? 0)),
    })),
  })
}
