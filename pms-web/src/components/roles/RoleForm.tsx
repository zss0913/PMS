'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DATA_SCOPE_OPTIONS, MENU_OPTIONS } from '@/lib/menu-config'
import type { Role } from './RoleList'

type Company = { id: number; name: string }

export function RoleForm({
  role,
  companies,
  isSuperAdmin,
  onClose,
}: {
  role: Role | null
  companies: Company[]
  isSuperAdmin: boolean
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [dataScope, setDataScope] = useState<string>('all')
  const [menuIds, setMenuIds] = useState<number[]>([])
  const [companyId, setCompanyId] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!role

  useEffect(() => {
    if (role) {
      setName(role.name)
      setCode(role.code)
      setDataScope(role.dataScope)
      setMenuIds(role.menuIds || [])
      setCompanyId(role.companyId)
    } else {
      setName('')
      setCode('')
      setDataScope('all')
      setMenuIds([])
      setCompanyId(companies[0]?.id ?? 0)
    }
  }, [role, companies])

  const toggleMenu = (id: number) => {
    if (menuIds.length === 0) {
      setMenuIds(MENU_OPTIONS.map((m) => m.id).filter((x) => x !== id))
    } else if (menuIds.includes(id)) {
      setMenuIds(menuIds.filter((x) => x !== id))
    } else {
      setMenuIds([...menuIds, id])
    }
  }

  const isAllMenus = menuIds.length === 0 || menuIds.length === MENU_OPTIONS.length
  const toggleAllMenus = () => setMenuIds([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name,
        code,
        dataScope,
        menuIds,
      }
      if (isSuperAdmin && !isEdit) {
        body.companyId = companyId
      }

      const url = isEdit ? `/api/roles/${role!.id}` : '/api/roles'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑角色' : '新增角色'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="role-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">角色名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入角色名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">角色编码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="如 admin、manager"
              required
              disabled={isEdit}
            />
            {isEdit && (
              <p className="mt-1 text-xs text-slate-500">编辑时角色编码不可修改</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">数据权限</label>
            <select
              value={dataScope}
              onChange={(e) => setDataScope(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {DATA_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && !isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">所属公司</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                <option value={0}>请选择公司</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">菜单权限</label>
            <div className="text-xs text-slate-500 mb-2">
              不勾选则默认拥有全部菜单权限
            </div>
            {!isAllMenus && (
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={toggleAllMenus}
                  className="text-sm text-blue-600 hover:underline"
                >
                  全选
                </button>
              </div>
            )}
            <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {MENU_OPTIONS.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={menuIds.length === 0 || menuIds.includes(m.id)}
                    onChange={() => toggleMenu(m.id)}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="role-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
