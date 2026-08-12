// ─── POST /api/public/messages ──────────────────────────────────────────────
// Бот складывает сюда переписку, чтобы менеджер видел её в карточке сделки
// (src/actions/deals.ts, getDealConversation). Отвечать продолжают в боте —
// CRM только читает.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardBotRequest, readJson } from '@/lib/public-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MessagePayload {
  chatId?: number | string
  direction?: 'in' | 'out'
  sender?: 'client' | 'bot' | 'operator'
  text?: string
}

export async function POST(request: Request) {
  const guard = guardBotRequest(request)
  if (!guard.ok) return guard.response

  const payload = await readJson<MessagePayload>(request)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const text = payload.text?.trim()
  if (!payload.chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (payload.direction !== 'in' && payload.direction !== 'out') {
    return NextResponse.json({ error: 'direction must be in|out' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('bot_messages').insert({
    chat_id: String(payload.chatId),
    direction: payload.direction,
    sender: payload.sender ?? (payload.direction === 'in' ? 'client' : 'bot'),
    // Длинные простыни в карточке всё равно не читают, а таблицу раздувают.
    text: text.slice(0, 4000),
  })

  if (error) {
    console.error('public/messages insert failed', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
