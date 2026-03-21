import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InvoiceRecordList } from '@/components/invoices/InvoiceRecordList'

export default async function InvoiceRecordsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">开票记录</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法查看开票记录</p>
          <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">开票记录</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        每次在账单管理中「开票登记」成功后，按实际条数记入：按租客合并时同一租客一条；不合并时每笔账单一条。同一次提交共享批次 ID。可对记录作废或红冲，金额将冲回各账单「已开票」并记入账单操作日志。
      </p>
      <InvoiceRecordList />
    </div>
  )
}
