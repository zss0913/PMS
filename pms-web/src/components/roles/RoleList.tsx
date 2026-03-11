'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { RoleForm } from './RoleForm'
import { DATA_SCOPE_OPTIONS, MENU_OPTIONS } from '@/lib/menu-config'

export type Role = {
  id: number
  name: string
  code: string
  dataScope: string
  menuIds: number[]
  companyId: number
  companyName?: string
  accountCount: number
  createdAt: string
}

type Company = { id: number; name: string }

export function RoleList({
  isSuperAdmin,
  companies,
}: {
  isSuperAdmin: boolean
  companies: Company[]
}) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setRoles(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const filtered = roles.filter(
    (r) =>
      !keyword ||
      r.name.includes(keyword) ||
      r.code.includes(keyword) ||
      r.companyName?.includes(keyword)
  )

  const getDataScopeLabel = (scope: string) =>
    DATA_SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? scope

  const getMenuPermissionText = (menuIds: number[]) => {
    if (!menuIds?.length) return '全部'
    const names = menuIds
      .map((id) => MENU_OPTIONS.find((m) => m.id === id)?.label)
      .filter(Boolean)
    return names.length > 3 ? `${names.slice(0, 3).join('、')}等${names.length}项` : names.join('、')
  }

  const handleDelete = async (role: Role) => {
    if (!confirm(`确定删除角色「${role.name}」？`)) return
    setDeleting(role.id)
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        fetchRoles()
      } else {
        alert(json.message || '删除失败')
      }
    } finally {
      setDeleting(null)
    }
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingRole(null)
    fetchRoles()
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {isSuperAdmin && (
        <div className="p-3 mx-4 mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
          您当前以超级管理员身份查看，可查看所有公司的角色
        </div>
      )}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索角色名称、编码、公司"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingRole(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增角色
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">角色名称</th>
              <th className="text-left p-4 font-medium">角色编码</th>
              <th className="text-left p-4 font-medium">数据权限</th>
              <th className="text-left p-4 font-medium">菜单权限</th>
              {isSuperAdmin && (
                <th className="text-left p-4 font-medium">所属公司</th>
              )}
              <th className="text-left p-4 font-medium">账号数量</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="p-12 text-center text-slate-500">
                  加载中...
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-4 font-medium">{r.name}</td>
                  <td className="p-4">{r.code}</td>
                  <td className="p-4">{getDataScopeLabel(r.dataScope)}</td>
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                    {getMenuPermissionText(r.menuIds)}
                  </td>
                  {isSuperAdmin && (
                    <td className="p-4">{r.companyName || '-'}</td>
                  )}
                  <td className="p-4">{r.accountCount}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(r)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deleting === r.id || r.accountCount > 0}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title={r.accountCount > 0 ? '该角色下有员工，无法删除' : '删除'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增角色」添加
        </div>
      )}
      {formOpen && (
        <RoleForm
          role={editingRole}
          companies={companies}
          isSuperAdmin={isSuperAdmin}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
