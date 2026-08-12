'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Dices,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NAV_GROUPS } from '@/config/nav'
import { HELP_CONTENT } from '@/config/help-content'
import type { UserRole } from '@/types'

const navy = '#1b1517'
const steel = '#6b6063'

export default function HelpPage() {
  const { user } = useAuth()
  const role = user?.role as UserRole | undefined

  // Показываем только то, что доступно этой роли — ровно как в боковом меню.
  // Саму «Помощь» из списка убираем, чтобы страница не ссылалась на себя.
  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter(
      (item) => item.href !== '/dashboard/help' && role && item.roles.includes(role)
    ),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-5xl">
      {/* Шапка */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0" style={{ backgroundColor: '#430c61' }}>
          <HelpCircle size={22} color="#fff" />
        </div>
        <div>
          <h1 className="font-bold text-xl" style={{ color: navy }}>Помощь</h1>
          <p className="text-sm mt-0.5" style={{ color: steel }}>
            Что умеет каждый раздел и как туда перейти. Показаны только доступные вам разделы.
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 md:p-6" style={{ border: '1px solid #f0eaea' }}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#faf8f7' }}>
            <Bot size={20} color="#430c61" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: navy }}>Как работает запись через бота</h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: '#574d4f' }}>
              Бот показывает людям только те игры, которые вы опубликовали в разделе «Игры».
              Свободные места он считает сам и не пропустит запись сверх лимита.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            { icon: Dices, title: '1. Игра в CRM', text: 'Вы создаёте игру: дата, время, место, цена, мест.' },
            { icon: Send, title: '2. Публикация', text: 'Опубликованную игру бот сразу показывает в списке.' },
            { icon: MessageCircle, title: '3. Запись', text: 'Человек выбирает игру, оставляет имя и телефон.' },
            { icon: ClipboardCheck, title: '4. Бронь в CRM', text: 'Запись появляется в карточке игры, место резервируется.' },
            { icon: CheckCircle2, title: '5. Подтверждение', text: 'Менеджер подтверждает бронь и отмечает, кто пришёл.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl p-4" style={{ backgroundColor: '#fdfbfb', border: '1px solid #faf8f7' }}>
              <Icon size={18} color="#430c61" />
              <p className="mt-2 text-sm font-semibold" style={{ color: navy }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: steel }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-5" style={{ backgroundColor: '#fff8e8', border: '1px solid #f4dfad' }}>
        <div className="flex gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" color="#b7791f" />
          <div>
            <h2 className="font-bold" style={{ color: navy }}>Если запись не появилась в CRM</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed" style={{ color: '#574d4f' }}>
              <li>Проверьте, что игра опубликована и её дата ещё не прошла — снятую с публикации игру бот не показывает.</li>
              <li>Посмотрите свободные места: когда мест нет, бот отказывает в записи и предлагает другую дату.</li>
              <li>Откройте карточку игры и обновите страницу — записи приходят в реальном времени, но кэш браузера мог отстать.</li>
              <li>Если записи нет и там, сообщите владельцу: он проверит логи бота и токен доступа к CRM.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 md:p-6" style={{ border: '1px solid #f0eaea' }}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#fdfbfb' }}>
            <BarChart3 size={20} color="#430c61" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: navy }}>Как читать главный дашборд</h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: '#574d4f' }}>
              Главная страница — это не место для ввода данных, а короткая сводка. Она автоматически считает показатели из записей, продаж, финансов и расписания, доступных вашей роли.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#fdfbfb', border: '1px solid #faf8f7' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6063' }}>Слева · итоги месяца</p>
            <div className="mt-3 space-y-3 text-sm" style={{ color: '#574d4f' }}>
              <p><b style={{ color: navy }}>Первичные встречи (ФВ)</b> — сколько первых встреч проведено за текущий месяц и насколько выполнен план.</p>
              <p><b style={{ color: navy }}>Продажи</b> — количество закрытых продаж за месяц.</p>
              <p><b style={{ color: navy }}>Выручка</b> — сумма продаж, которые внесены в систему.</p>
              <p><b style={{ color: navy }}>KPI%</b> — общий процент выполнения плана. Цвет и процент помогают быстро увидеть отставание или выполнение.</p>
              <p><b style={{ color: navy }}>Выручка по неделям</b> — график темпа продаж внутри месяца; по нему видно, в какие недели был рост или спад.</p>
              <p><b style={{ color: navy }}>План vs факт</b> — у владельца и РОПа сравнение по команде, у сотрудника — только его личные цифры.</p>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: '#fdfbfb', border: '1px solid #faf8f7' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b6063' }}>Справа · сегодня</p>
            <div className="mt-3 space-y-3 text-sm" style={{ color: '#574d4f' }}>
              <p><b style={{ color: navy }}>ФВ сегодня и продажи сегодня</b> — только события текущего дня, не итог месяца.</p>
              <p><b style={{ color: navy }}>Выручка сегодня</b> появляется, когда в сегодняшних продажах есть сумма.</p>
              <p><b style={{ color: navy }}>Записи · лента</b> обновляется автоматически при новой записи: показывает клиента, статус, менеджера, сумму и время.</p>
              <p><b style={{ color: navy }}>Команда сейчас</b> видна руководителю: кто работает и какие показатели у команды сегодня.</p>
              <p><b style={{ color: navy }}>Расписание дня</b> — ближайшие события дня по времени.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link href="/dashboard/finance" className="rounded-xl p-4 transition-shadow hover:shadow-md" style={{ border: '1px solid #f0eaea' }}>
            <BarChart3 size={18} color="#430c61" />
            <p className="mt-2 text-sm font-semibold" style={{ color: navy }}>Нужно понять деньги?</p>
            <p className="mt-1 text-xs" style={{ color: steel }}>Откройте «Финансы» для движения денег, счетов и детальных операций.</p>
          </Link>
          <Link href="/dashboard/employees" className="rounded-xl p-4 transition-shadow hover:shadow-md" style={{ border: '1px solid #f0eaea' }}>
            <Users size={18} color="#430c61" />
            <p className="mt-2 text-sm font-semibold" style={{ color: navy }}>Нужно увидеть команду?</p>
            <p className="mt-1 text-xs" style={{ color: steel }}>Откройте «Сотрудники» — там роли, данные и доступы пользователей.</p>
          </Link>
        </div>
      </section>

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d7174' }}>
            {group.label}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {group.items.map((item) => {
              const help = HELP_CONTENT[item.href]
              const Icon = item.icon
              const external = item.href.startsWith('/inventory')
              const cardInner = (
                <div className="flex items-start gap-3 rounded-2xl bg-white p-5 h-full transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: '#fdfbfb' }}>
                    <Icon size={17} color="#430c61" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm" style={{ color: navy }}>{item.label}</span>
                      {external ? (
                        <ExternalLink size={13} color={steel} />
                      ) : (
                        <ArrowRight size={13} color={steel} />
                      )}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: '#574d4f' }}>
                      {help?.summary ?? 'Раздел системы.'}
                    </p>
                    {help?.details && (
                      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: steel }}>
                        {help.details}
                      </p>
                    )}
                    <span className="mt-2 inline-block text-xs font-medium" style={{ color: '#430c61' }}>
                      Открыть →
                    </span>
                  </div>
                </div>
              )
              // Товароучёт — отдельная зона Multi-Zones, нужен hard navigation.
              return external ? (
                <a key={item.href} href={item.href}>{cardInner}</a>
              ) : (
                <Link key={item.href} href={item.href}>{cardInner}</Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
