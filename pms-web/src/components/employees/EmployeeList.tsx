'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, UserCheck, UserX } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { EmployeeForm, type EmployeeFormData } from './EmployeeForm'

export type Employee = {
  id: number
  name: string
  phone: string
  projectId: number | null
  departmentId: number | null
  position: string
  isLeader: boolean
  businessTypes: string | null
  roleId: number
  companyId: number
  status: string
  lastLoginAt: string | null
  project?: { name: string } | null
  department?: { name: string } | null
  role?: { name: string } | null
}

type Project = { id: number; name: string }
type Department = { id: number; name: string }
type Role = { id: number; name: string }
type Company = { id: number; name: string }

type Props = {
  projects: Project[]
  departments: Department[]
  roles: Role[]
  companies?: Company[]
  isSuperAdmin?: boolean
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  报修: '报修',
  巡检: '巡检',
  设备: '设备',
}

function parseBusinessTypes(val: string | null): string[] {
  if (!val) return []
  try {
    const arr = JSON.parse(val) as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function EmployeeList({
  projects,
  departments,
  roles,
  companies = [],
  isSuperAdmin = false,
}: Props) {
  const [keyword, setKeyword] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/employees', { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        setEmployees(json.data)
      }
    } catch {
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const filtered = employees.filter(
    (e) =>
      !keyword ||
      e.name.includes(keyword) ||
      e.phone.includes(keyword) ||
      e.project?.name?.includes(keyword) ||
      e.department?.name?.includes(keyword) ||
      e.role?.name?.includes(keyword)
  )

  const handleAdd = () => {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp)
    setFormOpen(true)
  }

  const handleFormSubmit = async (data: EmployeeFormData) => {
    const payload = {
      ...data,
      password: data.password || undefined,
      projectId: data.projectId || null,
      departmentId: data.departmentId || null,
    }
    if (editingEmployee) {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? '更新失败')
    } else {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          password: payload.password || '123456',
          companyId: isSuperAdmin ? payload.companyId : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? '创建失败')
    }
    await fetchEmployees()
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`确定删除员工「${emp.name}」？`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? '删除失败')
      await fetchEmployees()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleToggleStatus = async (emp: Employee) => {
    const action = emp.status === 'active' ? '禁用' : '启用'
    if (!confirm(`确定${action}员工「${emp.name}」？`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}/toggle-status`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? '操作失败')
      await fetchEmployees()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const VALID_POSITIONS = ['保安', '维修工', '保洁', '管理员', '其他']
  const formInitialData = editingEmployee
    ? {
        id: editingEmployee.id,
        name: editingEmployee.name,
        phone: editingEmployee.phone,
        projectId: editingEmployee.projectId,
        departmentId: editingEmployee.departmentId,
        position: (VALID_POSITIONS.includes(editingEmployee.position)
          ? editingEmployee.position
          : '其他') as EmployeeFormData['position'],
        isLeader: editingEmployee.isLeader,
        businessTypes: parseBusinessTypes(editingEmployee.businessTypes),
        roleId: editingEmployee.roleId,
      }
    : undefined

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索姓名、手机号、项目、部门、角色"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增员工
        </button>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left p-4 font-medium">姓名</th>
                <th className="text-left p-4 font-medium">手机号</th>
                <th className="text-left p-4 font-medium">所属项目</th>
                <th className="text-left p-4 font-medium">所属部门</th>
                <th className="text-left p-4 font-medium">岗位</th>
                <th className="text-left p-4 font-medium">是否组长</th>
                <th className="text-left p-4 font-medium">管理业务类型</th>
                <th className="text-left p-4 font-medium">所属角色</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium">最后登录</th>
                <th className="text-left p-4 font-medium w-36">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-4 font-medium">{e.name}</td>
                  <td className="p-4">{e.phone}</td>
                  <td className="p-4">{e.project?.name || '-'}</td>
                  <td className="p-4">{e.department?.name || '-'}</td>
                  <td className="p-4">{e.position}</td>
                  <td className="p-4">{e.isLeader ? '是' : '否'}</td>
                  <td className="p-4">
                    {e.isLeader && parseBusinessTypes(e.businessTypes).length > 0
                      ? parseBusinessTypes(e.businessTypes)
                          .map((bt) => BUSINESS_TYPE_LABELS[bt] ?? bt)
                          .join('、')
                      : '-'}
                  </td>
                  <td className="p-4">{e.role?.name || '-'}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        e.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {e.status === 'active' ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="p-4">{e.lastLoginAt ? formatDateTime(e.lastLoginAt) : '-'}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(e)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(e)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        title={e.status === 'active' ? '禁用' : '启用'}
                      >
                        {e.status === 'active' ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增员工」添加
        </div>
      )}
      <EmployeeForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingEmployee(null)
        }}
        onSubmit={handleFormSubmit}
        initialData={formInitialData}
        projects={projects}
        departments={departments}
        roles={roles}
        companies={companies}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
