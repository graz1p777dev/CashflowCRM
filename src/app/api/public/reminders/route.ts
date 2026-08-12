// ─── GET /api/public/reminders ──────────────────────────────────────────────
// Кого бот напоминает о завтрашней игре. Бот опрашивает эту ручку по
// расписанию и сам следит, чтобы не отправить напоминание дважды
// (его SQLite, таблица reminders_sent) — CRM состояние рассылок не хранит.
//
// withinHours — окно от «сейчас» вперёд: 26 часов покрывает «завтра
// в это же время» с запасом на то, что бот проснулся чуть позже.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardBotRequest } from '@/lib/public-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const raw = new URL(request.url).searchParams.get('withinHours')
  const hours = Math.min(72, Math.max(1, Number(raw) || 26))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('game_bookings')
    .select('id, name, seats, status, telegram_chat_id, games!inner(id, title, starts_at, venue, status, deleted_at)')
    .not('telegram_chat_id', 'is', null)
    .in('status', ['booked', 'confirmed'])
    .gte('games.starts_at', new Date().toISOString())
    .lte('games.starts_at', new Date(Date.now() + hours * 3600_000).toISOString())
    .eq('games.status', 'planned')
    .is('games.deleted_at', null)

  if (error) {
    console.error('public/reminders failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  type Row = {
    id: string
    name: string
    seats: number
    status: string
    telegram_chat_id: number
    games: { id: string; title: string; starts_at: string; venue: string } | null
  }

  return NextResponse.json({
    reminders: ((data ?? []) as unknown as Row[])
      .filter((b) => b.games)
      .map((b) => ({
        bookingId: b.id,
        chatId: b.telegram_chat_id,
        name: b.name,
        seats: b.seats,
        status: b.status,
        game: {
          id: b.games!.id,
          title: b.games!.title,
          startsAt: b.games!.starts_at,
          venue: b.games!.venue,
        },
      })),
  })
}
