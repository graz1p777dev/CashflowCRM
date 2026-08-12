'use client'

import { useState, useTransition } from 'react'
import { X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import Modal from '../Modal'
import { createGame, updateGame, deleteGame, type GameHost } from '@/actions/games'
import type { GameCurrency, GameStatus, GameWithSeats } from '@/types'
import { toLocalInputValue } from './game-config'

interface Props {
  game: GameWithSeats | null
  hosts: GameHost[]
  canDelete: boolean
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  title: string
  starts_at: string
  duration_min: string
  venue: string
  price: string
  currency: GameCurrency
  seats_total: string
  host_employee_id: string
  note: string
  is_published: boolean
  status: GameStatus
}

/** Ближайший вечер: новая игра почти всегда «на неделе в 18:00». */
function defaultStart(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(18, 0, 0, 0)
  return toLocalInputValue(date.toISOString())
}

export default function GameModal({ game, hosts, canDelete, onClose, onSaved }: Props) {
  const isNew = !game
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState<FormState>(() => ({
    title: game?.title ?? 'Игра CASHFLOW',
    starts_at: game ? toLocalInputValue(game.starts_at) : defaultStart(),
    duration_min: String(game?.duration_min ?? 210),
    venue: game?.venue ?? 'Тоголок-Молдо 106, Бишкек',
    price: String(game?.price ?? 1500),
    currency: game?.currency ?? 'KGS',
    seats_total: String(game?.seats_total ?? 8),
    host_employee_id: game?.host_employee_id ?? '',
    note: game?.note ?? '',
    is_published: game?.is_published ?? false,
    status: game?.status ?? 'planned',
  }))

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    const duration = Number(form.duration_min)
    const price = Number(form.price.replace(',', '.'))
    const seats = Number(form.seats_total)
    if (!form.starts_at) {
      toast.error('Укажите дату и время')
      return
    }
    if (!Number.isFinite(duration) || !Number.isFinite(price) || !Number.isFinite(seats)) {
      toast.error('Длительность, цена и мест — числа')
      return
    }
    // Мест меньше, чем уже занято, быть не может: иначе бот увидит
    // отрицательный остаток, а люди уже записаны.
    if (game && seats < game.seats_taken) {
      toast.error(`Уже занято мест: ${game.seats_taken}`)
      return
    }

    const payload = {
      title: form.title,
      // datetime-local отдаёт локальное время без зоны — Date приводит
      // его к зоне браузера, а в БД уходит ISO с зоной.
      starts_at: new Date(form.starts_at).toISOString(),
      duration_min: duration,
      venue: form.venue,
      price,
      currency: form.currency,
      seats_total: seats,
      host_employee_id: form.host_employee_id || null,
      note: form.note || null,
      is_published: form.is_published,
      status: form.status,
    }

    startTransition(async () => {
      const res = isNew ? await createGame(payload) : await updateGame(game!.id, payload)
      if (res.success) {
        toast.success(isNew ? 'Игра создана' : 'Изменения сохранены')
        onSaved()
        onClose()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleDelete = () => {
    if (!game) return
    startTransition(async () => {
      const res = await deleteGame(game.id)
      if (res.success) {
        toast.success('Игра удалена')
        onSaved()
        onClose()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Modal onClose={onClose} variant="right">
      <div className="flex h-[100dvh] w-[min(640px,100vw)] flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">
            {isNew ? 'Новая игра' : 'Игра'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 scroll-hidden">
          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Дата и время</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Длительность, мин</Label>
              <Input
                type="number"
                value={form.duration_min}
                onChange={(e) => set('duration_min', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Место</Label>
            <Input
              value={form.venue}
              onChange={(e) => set('venue', e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Цена</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Валюта</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => set('currency', v as GameCurrency)}
              >
                <SelectTrigger><SelectValue>{form.currency}</SelectValue></SelectTrigger>
                <SelectContent>
                  {(['KGS', 'USD', 'RUB'] as GameCurrency[]).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Мест всего</Label>
              <Input
                type="number"
                value={form.seats_total}
                onChange={(e) => set('seats_total', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ведущий</Label>
              <Select
                value={form.host_employee_id || 'none'}
                onValueChange={(v) => set('host_employee_id', v === 'none' ? '' : (v as string))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {hosts.find((h) => h.id === form.host_employee_id)?.name ?? 'Не назначен'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {hosts.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v as GameStatus)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.status === 'planned' ? 'Запланирована'
                      : form.status === 'done' ? 'Проведена' : 'Отменена'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Запланирована</SelectItem>
                  <SelectItem value="done">Проведена</SelectItem>
                  <SelectItem value="cancelled">Отменена</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Заметка для команды</Label>
            <Textarea
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Кого ждём, что подготовить…"
              rows={3}
            />
          </div>

          {/* Публикация — единственное, что видят люди в боте */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => set('is_published', e.target.checked)}
              className="mt-0.5 size-4 accent-[#430C61]"
            />
            <span className="text-[13px] leading-snug text-gray-600">
              <b className="text-gray-900">Показывать в боте</b>
              <br />
              Пока выключено, игру видят только сотрудники — запись невозможна.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          {!isNew && canDelete ? (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-400 transition-colors hover:bg-[#f3e9f8] hover:text-[#430c61] disabled:opacity-50"
            >
              <Trash2 size={15} />
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
