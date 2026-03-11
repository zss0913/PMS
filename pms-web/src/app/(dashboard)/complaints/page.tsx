import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ComplaintList } from '@/components/complaints/ComplaintList'

export default async function ComplaintsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">卫生吐槽</h1>
      <ComplaintList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
