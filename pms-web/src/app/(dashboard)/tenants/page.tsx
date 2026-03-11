import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantList } from '@/components/tenants/TenantList'

export default async function TenantsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">租客管理</h1>
      <TenantList />
    </div>
  )
}
