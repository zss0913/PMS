import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReceiptRecordList } from '@/components/receipts/ReceiptRecordList'

export default async function ReceiptRecordsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">收据记录</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法查看收据记录</p>
          <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">收据记录</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        每次「生成并下载收据」时，按实际生成的收据份数记条：同一租客合并多账单为一张收据时仅一条；不合并时一笔账单对应一张收据。同一次下载中的多条记录共享同一批次 ID（明细中可见前 8 位）。
      </p>
      <ReceiptRecordList />
    </div>
  )
}
