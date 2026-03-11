'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export type EmployeeFormData = {
  name: string
  phone: string
  password: string
  projectId: number | null
  departmentId: number | null
  position: '保安' | '维修工' | '保洁' | '管理员' | '其他'
  isLeader: boolean
  businessTypes: string[]
  roleId: number
  companyId?: number
}

const POSITIONS = ['保安', '维修工', '保洁', '管理员', '其他'] as const
const BUSINESS_TYPES = ['报修', '巡检', '设备']

type Project = { id: number; name: string; companyId: number }
type Department = { id: number; name: string; companyId: number }
type Role = { id: number; name: string; companyId: number }
type Company = { id: number; name: string }

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: EmployeeFormData) => Promise<void>
  initialData?: Partial<EmployeeFormData> & { id?: number }
  projects: Project[]
  departments: Department[]
  roles: Role[]
  companies?: Company[]
  isSuperAdmin?: boolean
}

const defaultForm: EmployeeFormData = {
  name: '',
  phone: '',
  password: '',
  projectId: null,
  departmentId: null,
  position: '其他',
  isLeader: false,
  businessTypes: [],
  roleId: 0,
}

export function EmployeeForm({
  open,
  onClose,
  onSubmit,
  initialData,
  projects,
  departments,
  roles,
  companies = [],
  isSuperAdmin = false,
}: Props) {
  const isEdit = !!initialData?.id
  const [form, setForm] = useState<EmployeeFormData>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      if (initialData) {
        setForm({
          name: initialData.name ?? '',
          phone: initialData.phone ?? '',
          password: '',
          projectId: initialData.projectId ?? null,
          departmentId: initialData.departmentId ?? null,
          position: initialData.position ?? '其他',
          isLeader: initialData.isLeader ?? false,
          businessTypes: initialData.businessTypes ?? [],
          roleId: initialData.roleId ?? 0,
          companyId: initialData.companyId,
        })
      } else {
        setForm({ ...defaultForm, companyId: companies[0]?.id })
      }
    }
  }, [open, initialData, companies])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('请输入姓名')
      return
    }
    if (!form.phone.trim()) {
      setError('请输入手机号')
      return
    }
    if (!isEdit && !form.password) {
      setError('请输入密码')
      return
    }
    if (form.roleId <= 0) {
      setError('请选择所属角色')
      return
    }
    if (isSuperAdmin && !form.companyId) {
      setError('请选择所属公司')
      return
    }
    setLoading(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? '提交失败')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h2 className="text-lg font-semibold">{isEdit ? '编辑员工' : '新增员工'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {isSuperAdmin && companies.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">所属公司</label>
              <select
                value={form.companyId ?? ''}
                onChange={(e) => {
                const cid = Number(e.target.value) || undefined
                setForm({
                  ...form,
                  companyId: cid,
                  projectId: null,
                  departmentId: null,
                  roleId: 0,
                })
              }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="">请选择</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">姓名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">手机号 <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入手机号"
              disabled={isEdit}
            />
            {isEdit && <p className="text-xs text-slate-500 mt-1">手机号不可修改</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              密码 {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder={isEdit ? '不修改请留空' : '默认123456'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">所属项目</label>
            <select
              value={form.projectId ?? ''}
              onChange={(e) => setForm({ ...form, projectId: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择</option>
              {(isSuperAdmin && form.companyId
                ? projects.filter((p) => 'companyId' in p && p.companyId === form.companyId)
                : projects
              ).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">所属部门</label>
            <select
              value={form.departmentId ?? ''}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择</option>
              {(isSuperAdmin && form.companyId
                ? departments.filter((d) => 'companyId' in d && d.companyId === form.companyId)
                : departments
              ).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">岗位</label>
            <select
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value as EmployeeFormData['position'] })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isLeader"
              checked={form.isLeader}
              onChange={(e) => setForm({ ...form, isLeader: e.target.checked })}
              className="rounded border-slate-300"
            />
            <label htmlFor="isLeader" className="text-sm">是否组长</label>
          </div>
          {form.isLeader && (
            <div>
              <label className="block text-sm font-medium mb-1">管理业务类型</label>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((bt) => (
                  <label key={bt} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={form.businessTypes.includes(bt)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.businessTypes, bt]
                          : form.businessTypes.filter((x) => x !== bt)
                        setForm({ ...form, businessTypes: next })
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">{bt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">所属角色 <span className="text-red-500">*</span></label>
            <select
              value={form.roleId || ''}
              onChange={(e) => setForm({ ...form, roleId: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择</option>
              {(isSuperAdmin && form.companyId
                ? roles.filter((r) => 'companyId' in r && r.companyId === form.companyId)
                : roles
              ).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? '提交中...' : '确定'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
