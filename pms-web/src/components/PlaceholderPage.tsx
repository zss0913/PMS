import { Construction } from 'lucide-react'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{title}</h1>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
        <Construction className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-500">功能开发中，敬请期待</p>
      </div>
    </div>
  )
}
