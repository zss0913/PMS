'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search, Power, PowerOff } from 'lucide-react'
import { BillRuleForm } from './BillRuleForm'

const FEE_TYPE_LABELS: Record<string, string> = {
  物业费: '物业费',
  水电费: '水电费',
  租金: '租金',
  其他: '其他',
}

export type BillRule = {
  id: number
  name: string
  code: string
  feeType: string
  amount: number
  discountRate: number
  discountAmount: number
  dueDateOffsetDays?: number
  tenantIds: number[]
  buildingIds: number[]
  roomIds: number[]
  periodStartDate: string
  periodEndDate: string
  accountId: number
  account?: { id: number; name: string; bankName: string; accountNumber: string }
  status: string
}

type Tenant = { id: number; companyName: string }
type Building = { id: number; name: string }
type Room = { id: number; name: string; roomNumber: string; buildingId: number }
type Account = { id: number; name: string; bankName: string; accountNumber: string }

type ApiData = {
  list: BillRule[]
  tenants: Tenant[]
  buildings: Building[]
  rooms: Room[]
  accounts: Account[]
}

export function BillRuleList() {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<BillRule | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bill-rules')
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setData(null)
        return
      }
      setData(json.data)
    } catch (e) {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该账单规则吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/bill-rules/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (rule: BillRule) => {
    const action = rule.status === 'active' ? '停用' : '启用'
    if (!confirm(`确定要${action}该规则吗？`)) return
    setTogglingId(rule.id)
    try {
      const res = await fetch(`/api/bill-rules/${rule.id}/toggle-status`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '操作失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setTogglingId(null)
    }
  }

  const handleEdit = (rule: BillRule) => {
    setEditingRule(rule)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingRule(null)
    fetchData()
  }

  const list = data?.list ?? []
  const filtered = list.filter(
    (r) =>
      !keyword ||
      r.name.includes(keyword) ||
      r.code.includes(keyword) ||
      FEE_TYPE_LABELS[r.feeType]?.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const getScopeText = (rule: BillRule) => {
    const parts: string[] = []
    if (rule.tenantIds?.length) {
      const names = rule.tenantIds
        .map((id) => data?.tenants.find((t) => t.id === id)?.companyName)
        .filter(Boolean)
      if (names.length) parts.push(`租客: ${names.slice(0, 2).join('、')}${names.length > 2 ? '等' + names.length + '个' : ''}`)
    }
    if (rule.buildingIds?.length) {
      const names = rule.buildingIds
        .map((id) => data?.buildings.find((b) => b.id === id)?.name)
        .filter(Boolean)
      if (names.length) parts.push(`楼宇: ${names.slice(0, 2).join('、')}${names.length > 2 ? '等' + names.length + '栋' : ''}`)
    }
    if (rule.roomIds?.length) {
      parts.push(`房源${rule.roomIds.length}间`)
    }
    return parts.length ? parts.join('；') : '全部'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索规则编号、规则名称、费用类型"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingRule(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增规则
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">规则编号</th>
              <th className="text-left p-4 font-medium">规则名称</th>
              <th className="text-left p-4 font-medium">费用类型</th>
              <th className="text-left p-4 font-medium">每平米应收(元/㎡)</th>
              <th className="text-left p-4 font-medium">适用范围</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium w-36">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.code}</td>
                <td className="p-4">{r.name}</td>
                <td className="p-4">{FEE_TYPE_LABELS[r.feeType] ?? r.feeType}</td>
                <td className="p-4">¥{r.amount.toFixed(2)}/㎡</td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                  {getScopeText(r)}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {r.status === 'active' ? '启用' : '停用'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(r)}
                      disabled={togglingId === r.id}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                      title={r.status === 'active' ? '停用' : '启用'}
                    >
                      {r.status === 'active' ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(r)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
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
          暂无数据，点击「新增规则」添加
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
      {formOpen && (
        <BillRuleForm
          rule={editingRule}
          data={data!}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
