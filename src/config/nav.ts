import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@/types'
import { FinanceNavIcon } from '@/components/finance/FinanceDesignerIcons'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: UserRole[]
  exact?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

import {
  LayoutDashboard,
  BarChart3,
  Megaphone,
  DollarSign,
  Users,
  Calendar,
  Bell,
  FileText,
  Settings,
  HelpCircle,
  KanbanSquare,
  Handshake,
  Dices,
} from 'lucide-react'

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Главное',
    items: [
      {
        href: '/dashboard',
        label: 'Дашборд',
        icon: LayoutDashboard,
        roles: ['owner', 'rop', 'mp', 'lmai'],
        exact: true,
      },
      {
        // Расписание игр: даты, места, записавшиеся. Бот берёт игры отсюда.
        href: '/dashboard/games',
        label: 'Игры',
        icon: Dices,
        roles: ['owner', 'rop', 'mp', 'lmai'],
      },
      {
        // Воронка продаж. Сделки заводятся сами, как только человек начал
        // запись в боте — бухгалтеру не нужна.
        href: '/dashboard/deals',
        label: 'Сделки',
        icon: Handshake,
        roles: ['owner', 'rop', 'mp', 'lmai'],
      },
    ],
  },
  {
    label: 'Аналитика',
    items: [
      {
        href: '/dashboard/decomposition',
        label: 'Декомпозиция',
        icon: BarChart3,
        roles: ['owner', 'rop', 'mp', 'lmai'],
      },
      {
        href: '/dashboard/salary',
        label: 'Зарплата',
        icon: DollarSign,
        roles: ['owner', 'rop', 'mp', 'lmai', 'accountant'],
      },
      {
        href: '/dashboard/finance',
        label: 'Финансы',
        icon: FinanceNavIcon,
        roles: ['owner', 'accountant'],
      },
      {
        href: '/dashboard/marketing',
        label: 'Маркетинг',
        icon: Megaphone,
        roles: ['owner', 'rop'],
      },
    ],
  },
  {
    label: 'Управление',
    items: [
      {
        href: '/dashboard/tasks',
        label: 'Задачи',
        icon: KanbanSquare,
        roles: ['owner', 'rop', 'mp', 'lmai', 'accountant'],
      },
      {
        href: '/dashboard/employees',
        label: 'Сотрудники',
        icon: Users,
        roles: ['owner', 'rop'],
      },
      {
        href: '/dashboard/calendar',
        label: 'Календарь',
        icon: Calendar,
        roles: ['owner', 'rop', 'mp', 'lmai'],
      },
      {
        href: '/dashboard/notifications',
        label: 'Уведомления',
        icon: Bell,
        roles: ['owner', 'rop', 'mp', 'lmai', 'accountant'],
      },
      {
        href: '/dashboard/documents',
        label: 'Документы',
        icon: FileText,
        roles: ['owner', 'accountant', 'rop'],
      },
    ],
  },
  {
    label: 'Система',
    items: [
      {
        href: '/dashboard/settings',
        label: 'Настройки',
        icon: Settings,
        roles: ['owner'],
      },
      {
        href: '/dashboard/help',
        label: 'Помощь',
        icon: HelpCircle,
        roles: ['owner', 'rop', 'mp', 'lmai', 'accountant'],
      },
    ],
  },
]
