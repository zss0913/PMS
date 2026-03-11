import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BillRuleList } from '@/components/bill-rules/BillRuleList'

export default async function BillRulesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">账单规则</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法管理账单规则</p>
          <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">账单规则</h1>
      <BillRuleList />
    </div>
  )
}
