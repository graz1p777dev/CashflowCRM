// Продвижение сделки по воронке по сигналам Telegram-бота Cashflow.
//
// Бот (bot/cashflow_bot/crm.py, push_stage) на ключевых шагах записи шлёт
// PATCH /api/internal/deals с action. Здесь action превращается в конкретный
// deal_stages.id.
//
// status и deal_events заполняет БД-триггер
// (trg_deals_sync_stage_state / trg_deals_log_stage_change,
// supabase/migrations/036_deals.sql) — здесь их не трогаем. Сумму и состав
// брони сделке не проставляем: это отдельная таблица game_bookings.

import { createAdminClient } from '@/lib/supabase/admin'

/** action → название этапа (supabase/migrations/036_deals.sql). */
const ACTION_STAGE_NAME: Record<string, string> = {
  started: 'Начал запись',
  contact: 'Оставил контакты',
  booked: 'Записан на игру',
  confirmed: 'Подтвердил участие',
  attended: 'Пришёл на игру',
  no_show: 'Не пришёл',
}

// no_show — не шаг воронки вперёд, а фиксация того, что человек не дошёл:
// случиться это может на любом этапе, поэтому правило «только вперёд»
// для него не применяется.
const BYPASS_FORWARD_ONLY = new Set(['no_show'])

export interface AdvanceDealResult {
  ok: boolean
  id?: string
  skipped?: 'not_found' | 'terminal' | 'unknown_action' | 'no_change'
  error?: string
}

export async function advanceDealFromBotAction(
  externalKey: string,
  action: string
): Promise<AdvanceDealResult> {
  const targetStageName = ACTION_STAGE_NAME[action]
  if (!targetStageName) return { ok: false, skipped: 'unknown_action' }

  const key = externalKey.trim()
  if (!key) return { ok: false, error: 'externalKey пустой' }

  const supabase = createAdminClient()

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, stage_id, status')
    .eq('external_key', key)
    .is('deleted_at', null)
    .maybeSingle()
  if (dealError) return { ok: false, error: dealError.message }
  if (!deal) return { ok: false, skipped: 'not_found' }
  const d = deal as { id: string; stage_id: string; status: string }

  // Сделку, которую менеджер уже закрыл (выиграна/потеряна), бот не трогает.
  if (d.status !== 'open') return { ok: true, skipped: 'terminal' }

  const { data: currentStage, error: currentStageError } = await supabase
    .from('deal_stages')
    .select('sort_order')
    .eq('id', d.stage_id)
    .maybeSingle()
  if (currentStageError) return { ok: false, error: currentStageError.message }

  const { data: targetStage, error: targetStageError } = await supabase
    .from('deal_stages')
    .select('id, sort_order')
    .eq('name', targetStageName)
    .maybeSingle()
  if (targetStageError) return { ok: false, error: targetStageError.message }
  if (!targetStage) return { ok: false, error: `Этап "${targetStageName}" не найден` }
  const target = targetStage as { id: string; sort_order: number }

  // Воронка двигается только вперёд — повторное распознанное намерение
  // (например клиент второй раз спросил про товар) не откатывает сделку.
  // Исключение — non_standard_request (см. BYPASS_FORWARD_ONLY выше).
  if (
    !BYPASS_FORWARD_ONLY.has(action) &&
    currentStage &&
    target.sort_order <= (currentStage as { sort_order: number }).sort_order
  ) {
    return { ok: true, id: d.id, skipped: 'no_change' }
  }

  const { error: updateError } = await supabase
    .from('deals')
    .update({ stage_id: target.id })
    .eq('id', d.id)
  if (updateError) return { ok: false, error: updateError.message }

  return { ok: true, id: d.id }
}
