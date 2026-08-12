// Общая защита публичных ручек для Telegram-бота (/api/public/*).
//
// У бота нет и не должно быть SUPABASE_SERVICE_ROLE_KEY: он ходит по HTTP
// с общим секретом BOT_API_TOKEN в заголовке. Ручки узкие — только то,
// что нужно записи на игру, — поэтому утечка токена не даёт доступа к
// сотрудникам, финансам и зарплатам.

import { NextResponse } from 'next/server'

export type Guard = { ok: true } | { ok: false; response: NextResponse }

export function guardBotRequest(request: Request): Guard {
  const expected = process.env.BOT_API_TOKEN
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not configured' }, { status: 503 }),
    }
  }
  if (request.headers.get('x-bot-token') !== expected) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
