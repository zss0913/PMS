import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AccountList } from '@/components/accounts/AccountList'

export default async function AccountsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">收款账户管理</h1>
      <AccountList isSuperAdmin={user.companyId === 0} />
    </div>
  )
}
