'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { PermissionGate } from '@/components/permissions/PermissionGate'
import { MENU_ID } from '@/lib/menu-config'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'

type Building = {
  id: number
  name: string
  area: number
  managedArea?: number
  manager: string
  phone: string
  location: string | null
  projectId: number | null
  project?: { name: string } | null
  _count?: { floors: number; rooms: number }
}
type Project = { id: number; name: string }

export function BuildingList({
  buildings,
  projects,
  isSuperAdmin,
}: {
  buildings: Building[]
  projects: Project[]
  isSuperAdmin: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const router = useRouter()

  const handleDelete = async (b: Building) => {
    if ((b._count?.rooms ?? 0) > 0) {
      alert('楼宇下存在房源无法删除')
      return
    }
    if (!confirm(`确定要删除楼宇「${b.name}」吗？删除后不可恢复。`)) return
    setDeletingId(b.id)
    try {
      const res = await fetch(`/api/buildings/${b.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        alert(data.message || '删除失败')
      }
    } catch {
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = buildings.filter(
    (b) => !keyword || b.name.includes(keyword) || b.manager.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索楼宇名称、负责人"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <PermissionGate menuId={MENU_ID.BUILDINGS} action="create">
          <AppLink
            href="/buildings/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增楼宇
          </AppLink>
        </PermissionGate>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">楼宇名称</th>
              <th className="text-left p-4 font-medium">管理面积(㎡)</th>
              <th className="text-left p-4 font-medium">面积(㎡)</th>
              <th className="text-left p-4 font-medium">负责人</th>
              <th className="text-left p-4 font-medium">联系电话</th>
              <th className="text-left p-4 font-medium">所属项目</th>
              <th className="text-left p-4 font-medium">楼层/房源数</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4">
                  <AppLink href={`/buildings/${b.id}`} className="font-medium text-blue-600 hover:underline">
                    {b.name}
                  </AppLink>
                </td>
                <td className="p-4">{Number(b.managedArea ?? 0)}</td>
                <td className="p-4">{Number(b.area)}</td>
                <td className="p-4">{b.manager}</td>
                <td className="p-4">{b.phone}</td>
                <td className="p-4">{b.project?.name || '-'}</td>
                <td className="p-4">
                  {b._count?.floors ?? 0}层 / {b._count?.rooms ?? 0}间
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <PermissionGate menuId={MENU_ID.BUILDINGS} action="update">
                      <button
                        type="button"
                        onClick={() => router.push(`/buildings/${b.id}/edit`)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                    <PermissionGate menuId={MENU_ID.BUILDINGS} action="delete">
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        disabled={deletingId === b.id}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded disabled:opacity-50"
                        title={b._count?.rooms ? '楼宇下存在房源无法删除' : '删除'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增楼宇」添加
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
