import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BillList } from '@/components/bills/BillList'

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const initialTenantId = params.tenantId ?? ''

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">账单管理</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法管理账单</p>
          <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">账单管理</h1>
      <BillList isSuperAdmin={user.companyId === 0} initialTenantId={initialTenantId} />
    </div>
  )
}
