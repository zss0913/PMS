'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'

type Company = {
  id: number
  name: string
  contact: string
  phone: string
  address: string | null
  status: string
  _count?: { employees: number; buildings: number; rooms: number }
}

export function CompanyList({ companies }: { companies: Company[] }) {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const filtered = companies.filter(
    (c) => !keyword || c.name.includes(keyword) || c.contact.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleDelete = async (c: Company) => {
    const roomCount = c._count?.rooms ?? 0
    if (roomCount > 0) {
      alert(`该公司下存在 ${roomCount} 条房源，无法删除`)
      return
    }
    if (
      !confirm(
        `确定删除物业公司「${c.name}」？将同时删除该公司下所有员工账号、部门、楼宇及关联业务数据，且不可恢复。`
      )
    ) {
      return
    }
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/companies/${c.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        router.refresh()
      } else {
        alert(json.message || '删除失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索公司名称、联系人"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <AppLink
          href="/companies/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新建物业公司
        </AppLink>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">公司名称</th>
              <th className="text-left p-4 font-medium">联系人</th>
              <th className="text-left p-4 font-medium">联系电话</th>
              <th className="text-left p-4 font-medium">地址</th>
              <th className="text-left p-4 font-medium">员工/楼宇数</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium w-36">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4">{c.contact}</td>
                <td className="p-4">{c.phone}</td>
                <td className="p-4">{c.address || '-'}</td>
                <td className="p-4">
                  {c._count?.employees ?? 0} / {c._count?.buildings ?? 0}
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      c.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {c.status === 'active' ? '启用' : '停用'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <AppLink
                      href={`/companies/${c.id}/edit`}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded inline-block"
                    >
                      <Pencil className="w-4 h-4" />
                    </AppLink>
                    <button
                      type="button"
                      title={
                        (c._count?.rooms ?? 0) > 0
                          ? '该公司下存在房源，无法删除'
                          : '删除物业公司'
                      }
                      disabled={deletingId === c.id || (c._count?.rooms ?? 0) > 0}
                      onClick={() => handleDelete(c)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新建物业公司」添加
        </div>
      )}
      {filtered.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
