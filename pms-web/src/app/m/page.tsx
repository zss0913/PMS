import Link from 'next/link'

export default function MIndexPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">物业管理系统 · 移动端 H5</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          与 PC 管理端数据互通，请使用租客账号或物业员工账号登录
        </p>
      </div>
      <div className="flex flex-col w-full max-w-xs gap-3">
        <Link
          href="/m/tenant/login"
          className="block text-center py-3.5 rounded-xl bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-500"
        >
          租客端登录
        </Link>
        <Link
          href="/m/staff/login"
          className="block text-center py-3.5 rounded-xl bg-slate-800 text-white font-medium shadow-sm hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          员工端登录
        </Link>
      </div>
      <Link
        href="/login"
        className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400"
      >
        前往 PC 管理端登录
      </Link>
    </div>
  )
}
