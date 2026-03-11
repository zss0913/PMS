import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantForm } from '@/components/tenants/TenantForm'

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/tenants')
  const { id } = await params
  const tenantId = parseInt(id, 10)
  if (isNaN(tenantId)) redirect('/tenants')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑租客</h1>
      <TenantForm mode="edit" id={tenantId} />
    </div>
  )
}
