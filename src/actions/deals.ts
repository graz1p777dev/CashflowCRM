'use server'

// Воронка продаж. Сделки живут в Supabase (036_deals.sql). Заводятся сами,
// когда человек записывается на игру через Telegram-бота
// (src/lib/deals/auto-create.ts), либо вручную из доски.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Deal,
  DealEmployee,
  DealMessage,
  DealSource,
  DealStage,
  DealViewer,
} from '@/types'

export type DealActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ─── Текущий сотрудник ───────────────────────────────────────────────────────

async function getViewer(): Promise<DealViewer | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('employees')
    .select('id, role, name')
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  return (data as DealViewer | null) ?? null
}

// ─── Данные для доски ────────────────────────────────────────────────────────

export interface DealsData {
  stages: DealStage[]
  deals: Deal[]
  employees: DealEmployee[]
  me: DealViewer | null
}

export async function getDealsData(): Promise<DealsData> {
  const me = await getViewer()
  if (!me) return { stages: [], deals: [], employees: [], me: null }

  const supabase = await createClient()
  const admin = createAdminClient()

  // deal_stages/deals — через RLS-клиент: какие сделки видны, решает БД.
  // employees — через admin: имена нужны для пикера ответственного.
  const [{ data: stages }, { data: deals }, { data: emps }] = await Promise.all([
    supabase
      .from('deal_stages')
      .select('id, name, sort_order, kind, color, is_default, description')
      .order('sort_order'),
    supabase
      .from('deals')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('employees')
      .select('id, name, avatar_url')
      .is('deleted_at', null)
      .order('name'),
  ])

  return {
    stages: (stages ?? []) as DealStage[],
    deals: (deals ?? []) as Deal[],
    employees: (emps ?? []) as DealEmployee[],
    me,
  }
}

// ─── Форма сделки ────────────────────────────────────────────────────────────

const DealSchema = z.object({
  title: z.string().trim().min(1, 'Введите название сделки').max(300, 'Слишком длинное название'),
  stage_id: z.string().uuid('Выберите этап'),
  amount: z.number().nonnegative('Сумма не может быть отрицательной').nullable().optional(),
  currency: z.enum(['KGS', 'USD', 'RUB']).default('KGS'),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  customer_username: z.string().nullable().optional(),
  city: z.string().max(120, 'Слишком длинное название города').nullable().optional(),
  address: z.string().max(500, 'Слишком длинный адрес').nullable().optional(),
  responsible_employee_id: z.string().uuid().nullable().optional(),
  note: z.string().nullable().optional(),
})

export type DealFormData = z.input<typeof DealSchema>

const clean = (value: string | null | undefined) => value?.trim() || null

export async function createDeal(input: DealFormData): Promise<DealActionResult<{ id: string }>> {
  const me = await getViewer()
  if (!me) return { success: false, error: 'Нет авторизации' }

  const parsed = DealSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  const d = parsed.data
  const supabase = await createClient()

  const { data: created, error } = await supabase
    .from('deals')
    .insert({
      title: d.title,
      stage_id: d.stage_id,
      amount: d.amount ?? null,
      currency: d.currency,
      customer_name: clean(d.customer_name),
      customer_phone: clean(d.customer_phone),
      customer_username: clean(d.customer_username),
      city: clean(d.city),
      address: clean(d.address),
      source: 'manual' satisfies DealSource,
      responsible_employee_id: d.responsible_employee_id ?? null,
      note: clean(d.note),
    })
    .select('id')
    .single()

  if (error || !created) {
    return { success: false, error: error?.message ?? 'Не удалось создать сделку' }
  }

  revalidatePath('/dashboard/deals')
  return { success: true, data: { id: (created as { id: string }).id } }
}

export async function updateDeal(id: string, input: DealFormData): Promise<DealActionResult> {
  const me = await getViewer()
  if (!me) return { success: false, error: 'Нет авторизации' }

  const parsed = DealSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  const d = parsed.data
  const supabase = await createClient()

  // status и stage_changed_at проставляет триггер БД — здесь их не трогаем.
  const { data: updated, error } = await supabase
    .from('deals')
    .update({
      title: d.title,
      stage_id: d.stage_id,
      amount: d.amount ?? null,
      currency: d.currency,
      customer_name: clean(d.customer_name),
      customer_phone: clean(d.customer_phone),
      customer_username: clean(d.customer_username),
      city: clean(d.city),
      address: clean(d.address),
      responsible_employee_id: d.responsible_employee_id ?? null,
      note: clean(d.note),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) return { success: false, error: 'Сделка недоступна' }

  revalidatePath('/dashboard/deals')
  return { success: true }
}

/** Перенос карточки между колонками. deal_events пишет триггер БД. */
export async function moveDeal(dealId: string, stageId: string): Promise<DealActionResult> {
  const me = await getViewer()
  if (!me) return { success: false, error: 'Нет авторизации' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deals')
    .update({ stage_id: stageId })
    .eq('id', dealId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Недостаточно прав' }

  revalidatePath('/dashboard/deals')
  return { success: true }
}

/** Мягкое удаление — история переходов в deal_events остаётся. */
export async function deleteDeal(id: string): Promise<DealActionResult> {
  const me = await getViewer()
  if (!me) return { success: false, error: 'Нет авторизации' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Сделка недоступна' }

  revalidatePath('/dashboard/deals')
  return { success: true }
}


// ─── Переписка по сделке ─────────────────────────────────────────────────────

export interface DealConversation {
  messages: DealMessage[]
  /** Почему переписки нет — показываем вместо пустоты. */
  note: string | null
}

/**
 * Диалог из Telegram-бота записи на игру. Бот складывает сообщения в
 * bot_messages (миграция 100), CRM только читает: отвечать продолжают в боте.
 */
export async function getDealConversation(dealId: string): Promise<DealConversation> {
  const me = await getViewer()
  if (!me) return { messages: [], note: 'Нет авторизации' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('external_key')
    .eq('id', dealId)
    .maybeSingle()
  const deal = data as { external_key: string | null } | null
  if (!deal) return { messages: [], note: 'Сделка недоступна' }

  if (!deal.external_key?.startsWith('tg:')) {
    return { messages: [], note: 'Сделка заведена вручную — переписки нет' }
  }

  const chatId = deal.external_key.slice('tg:'.length)
  const { data: rows } = await supabase
    .from('bot_messages')
    .select('id, direction, sender, text, created_at')
    .eq('chat_id', chatId)
    .order('created_at')
    .order('id')
    .limit(200)

  const messages: DealMessage[] = ((rows ?? []) as {
    id: number
    direction: 'in' | 'out'
    sender: 'client' | 'bot' | 'operator'
    text: string
    created_at: string
  }[]).map((row) => ({
    id: String(row.id),
    direction: row.direction,
    sender: row.sender,
    text: row.text,
    created_at: row.created_at,
  }))

  return { messages, note: messages.length ? null : 'Сообщений пока нет' }
}
