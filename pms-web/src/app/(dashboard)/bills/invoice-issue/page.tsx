import { Suspense } from 'react'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InvoiceIssueForm } from '@/components/bills/InvoiceIssueForm'

export default async function InvoiceIssuePage() {
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
      <h1 className="text-2xl font-bold mb-2">开票登记</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        系统仅记录开票金额，不生成纸质或 Word
        票据。默认按租客合并：同一租客的多条账单记为一次开票；也可选择按账单逐条开票。请填写本次开票金额；未填写的行不参与。本次开票与历史已开票之和不能超过应收。
      </p>
      <Suspense
        fallback={
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            加载中…
          </div>
        }
      >
        <InvoiceIssueForm />
      </Suspense>
    </div>
  )
}
