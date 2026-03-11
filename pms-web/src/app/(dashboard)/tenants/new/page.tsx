import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantForm } from '@/components/tenants/TenantForm'

export default async function NewTenantPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/tenants')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新增租客</h1>
      <TenantForm mode="new" />
    </div>
  )
}
