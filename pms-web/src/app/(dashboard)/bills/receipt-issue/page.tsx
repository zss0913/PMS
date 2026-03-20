import { Suspense } from 'react'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReceiptIssueForm } from '@/components/bills/ReceiptIssueForm'

export default async function ReceiptIssuePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/bills')

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link
          href="/bills"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          ← 返回账单列表
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">开具收据</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        选择收据 Word 模板与「开具方式」：按租客合并时，同一租客的多条账单打在一张收据上；不合并则每笔账单单独一张。为需要开具的账单填写本次金额（未填写的行不会导出）。本次开具与已开收据之和不能超过应收。
      </p>
      <Suspense
        fallback={
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            加载中…
          </div>
        }
      >
        <ReceiptIssueForm />
      </Suspense>
    </div>
  )
}
