'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pagination, type PageSize } from '@/components/Pagination'
import { AppLink } from '@/components/AppLink'
import {
  Search,
  Pencil,
  UserMinus,
  UserCheck,
  UserX,
  Shield,
  ShieldOff,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export type TenantUserAccountRow = {
  relationId: number
  tenantId: number
  tenantUserId: number
  tenantName: string
  buildingName: string
  name: string
  phone: string
  status: string
  isAdmin: boolean
  createdAt: string
  relationCreatedAt: string
}

type ListResponse = {
  list: TenantUserAccountRow[]
  total: number
  page: number
  pageSize: PageSize
}

export function TenantUserAccountList() {
  const [phone, setPhone] = useState('')
  const [accountName, setAccountName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [applied, setApplied] = useState({ phone: '', accountName: '', tenantName: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(15)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editRow, setEditRow] = useState<TenantUserAccountRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (applied.phone.trim()) params.set('phone', applied.phone.trim())
      if (applied.accountName.trim()) params.set('accountName', applied.accountName.trim())
      if (applied.tenantName.trim()) params.set('tenantName', applied.tenantName.trim())
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/tenant-users?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setData({ list: [], total: 0, page: 1, pageSize })
        if (json.message) alert(json.message)
      }
    } catch {
      setData({ list: [], total: 0, page: 1, pageSize })
    } finally {
      setLoading(false)
    }
  }, [applied, page, pageSize])

  const openEdit = (row: TenantUserAccountRow) => {
    setEditRow(row)
    setEditName(row.name)
    setEditPhone(row.phone)
    setEditPassword('')
    setEditIsAdmin(row.isAdmin)
    setEditStatus(row.status === 'inactive' ? 'inactive' : 'active')
  }

  const closeEdit = () => {
    setEditRow(null)
    setEditPassword('')
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRow) return
    if (!editName.trim()) {
      alert('请输入姓名')
      return
    }
    if (editPhone.trim().length < 11) {
      alert('请输入正确手机号')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        isAdmin: editIsAdmin,
        status: editStatus,
      }
      if (editPassword.trim()) body.password = editPassword.trim()
      const res = await fetch(`/api/tenant-user-relations/${editRow.relationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.message || '保存失败')
        return
      }
      closeEdit()
      await fetchList()
    } catch {
      alert('网络错误')
    } finally {
      setSaving(false)
    }
  }

  const patchRelation = async (relationId: number, body: Record<string, unknown>) => {
    const res = await fetch(`/api/tenant-user-relations/${relationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) alert(json.message || '操作失败')
    else await fetchList()
  }

  const handleToggleAdmin = (row: TenantUserAccountRow) => {
    patchRelation(row.relationId, { isAdmin: !row.isAdmin })
  }

  const handleToggleStatus = (row: TenantUserAccountRow) => {
    const next = row.status === 'active' ? 'inactive' : 'active'
    patchRelation(row.relationId, { status: next })
  }

  const handleRemove = async (row: TenantUserAccountRow) => {
    if (
      !confirm(
        `确定从租客「${row.tenantName}」移除此账号？移除后该手机号将无法再以该绑定登录此租客小程序端。`
      )
    )
      return
    setRemovingId(row.relationId)
    try {
      const res = await fetch(`/api/tenant-user-relations/${row.relationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) alert(json.message || '移除失败')
      else await fetchList()
    } catch {
      alert('网络错误')
    } finally {
      setRemovingId(null)
    }
  }

  const handleSearch = () => {
    setApplied({
      phone: phone.trim(),
      accountName: accountName.trim(),
      tenantName: tenantName.trim(),
    })
    setPage(1)
  }

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const list = data?.list ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">手机号</label>
          <input
            type="text"
            placeholder="租客账号（手机号）模糊"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[160px]"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">账号姓名</label>
          <input
            type="text"
            placeholder="租客账号姓名模糊"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[140px]"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">租客名称</label>
          <input
            type="text"
            placeholder="所属租客名称模糊"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[160px]"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Search className="w-4 h-4" />
          查询
        </button>
      </div>

      <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left p-3 font-medium">所属租客</th>
                <th className="text-left p-3 font-medium">姓名</th>
                <th className="text-left p-3 font-medium">手机号</th>
                <th className="text-left p-3 font-medium">状态</th>
                <th className="text-left p-3 font-medium">管理员</th>
                <th className="text-left p-3 font-medium">所属楼宇</th>
                <th className="text-left p-3 font-medium">创建时间</th>
                <th className="text-left p-3 font-medium w-44">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : list.length > 0 ? (
                list.map((row) => (
                  <tr key={row.relationId} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-3">
                      <AppLink
                        href={`/tenants/${row.tenantId}?returnTo=${encodeURIComponent('/tenant-users')}`}
                        className="text-blue-600 hover:text-blue-500 hover:underline"
                      >
                        {row.tenantName}
                      </AppLink>
                    </td>
                    <td className="p-3">{row.name}</td>
                    <td className="p-3 font-mono text-sm">{row.phone}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs ${
                          row.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {row.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="p-3">{row.isAdmin ? '是' : '否'}</td>
                    <td className="p-3">{row.buildingName}</td>
                    <td className="p-3 text-sm whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAdmin(row)}
                          className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                          title={row.isAdmin ? '取消管理员' : '设为管理员'}
                        >
                          {row.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(row)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                          title={row.status === 'active' ? '禁用' : '启用'}
                        >
                          {row.status === 'active' ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(row)}
                          disabled={removingId === row.relationId}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                          title="移除绑定"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    暂无租客账号数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && total > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        )}
      </div>

      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-600">
            <h3 className="text-lg font-semibold mb-1">编辑租客账号</h3>
            <p className="text-sm text-slate-500 mb-4">
              租客：{editRow.tenantName}（{editRow.buildingName}）
            </p>
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">姓名</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">手机号</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">新密码（留空不修改）</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  placeholder="至少6位"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-admin"
                  type="checkbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="edit-admin" className="text-sm">
                  该租客下管理员
                </label>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">状态</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
