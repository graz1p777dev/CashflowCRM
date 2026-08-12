import { getGamesData } from '@/actions/games'
import GamesClient from '@/components/games/GamesClient'

export const metadata = { title: 'Игры — Cashflow' }
export const dynamic = 'force-dynamic'

export default async function GamesPage() {
  const { games, bookings, hosts, role } = await getGamesData()

  if (!role) {
    return <div className="p-8 text-sm text-gray-400">Нет доступа</div>
  }

  return (
    <GamesClient
      initialGames={games}
      initialBookings={bookings}
      hosts={hosts}
      role={role}
    />
  )
}
