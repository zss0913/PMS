import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ComplaintDetail } from '@/components/complaints/ComplaintDetail'

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/complaints')
  const { id } = await params
  if (!id || !/^\d+$/.test(id)) redirect('/complaints')
  return <ComplaintDetail id={id} />
}
