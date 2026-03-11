import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { DashboardHome } from '@/components/DashboardHome'

export default async function HomePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return <DashboardHome user={user} />
}
