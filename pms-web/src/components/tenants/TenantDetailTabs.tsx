'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { Receipt, Upload, UserMinus, UserCheck, UserX, Shield, X, Plus, Search } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import * as XLSX from 'xlsx'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未缴纳',
  partial: '部分缴纳',
  paid: '已结清',
}

type TenantRoom = {
  id: number
  room: { id: number; name: string; roomNumber: string; area: number }
  leaseArea: number
}

type Bill = {
  id: number
  code: string
  room: { roomNumber: string; name: string } | null
  roomsDisplay?: string
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  paymentStatus: string
  dueDate: string
}

const FEE_TYPES = [
  { value: '', label: '全部类型' },
  { value: '物业费', label: '物业费' },
  { value: '水电费', label: '水电费' },
  { value: '租金', label: '租金' },
  { value: '其他', label: '其他' },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: '全部结清状态' },
  { value: 'unpaid', label: '未缴纳' },
  { value: 'partial', label: '部分缴纳' },
  { value: 'paid', label: '已结清' },
]

const OVERDUE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'overdue', label: '已逾期' },
  { value: 'not_overdue', label: '未逾期' },
]

function getMonthRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

type TenantUserItem = {
  id: number
  tenantUserId: number
  phone: string
  name: string
  status: string
  isAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
}

type Props = {
  tenantId: number
  tenantRooms: TenantRoom[]
}

const TABS = [
  { key: 'rooms', label: '租赁房源' },
  { key: 'bills', label: '账单列表' },
  { key: 'users', label: '员工账号管理' },
] as const

export function TenantDetailTabs({ tenantId, tenantRooms }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('rooms')
  const [users, setUsers] = useState<TenantUserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [bills, setBills] = useState<Bill[]>([])
  const [billsLoading, setBillsLoading] = useState(false)
  const [billFilters, setBillFilters] = useState(() => {
    const { start, end } = getMonthRange()
    return {
      feeType: '',
      paymentStatus: '',
      overdue: '',
      dueDateStart: start,
      dueDateEnd: end,
    }
  })
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showAddOne, setShowAddOne] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [userFilters, setUserFilters] = useState({ name: '', phone: '', isAdmin: '' })

  const fetchBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('tenantId', String(tenantId))
      if (billFilters.feeType) params.set('feeType', billFilters.feeType)
      if (billFilters.paymentStatus) params.set('paymentStatus', billFilters.paymentStatus)
      if (billFilters.overdue === 'overdue') params.set('overdue', 'true')
      if (billFilters.overdue === 'not_overdue') params.set('overdue', 'false')
      if (billFilters.dueDateStart) params.set('dueDateStart', billFilters.dueDateStart)
      if (billFilters.dueDateEnd) params.set('dueDateEnd', billFilters.dueDateEnd)
      const res = await fetch(`/api/bills?${params}`)
      const json = await res.json()
      if (json.success && json.data?.list) {
        setBills(json.data.list)
      } else {
        setBills([])
      }
    } catch {
      setBills([])
    } finally {
      setBillsLoading(false)
    }
  }, [tenantId, billFilters.feeType, billFilters.paymentStatus, billFilters.overdue, billFilters.dueDateStart, billFilters.dueDateEnd])

  const fetchUsers = useCallback(
    async (filtersOverride?: { name: string; phone: string; isAdmin: string }) => {
      const f = filtersOverride ?? userFilters
      setUsersLoading(true)
      try {
        const params = new URLSearchParams()
        if (f.name) params.set('name', f.name)
        if (f.phone) params.set('phone', f.phone)
        if (f.isAdmin) params.set('isAdmin', f.isAdmin)
        const qs = params.toString()
        const res = await fetch(`/api/tenants/${tenantId}/users${qs ? `?${qs}` : ''}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (json.success) {
          setUsers(json.data)
        }
      } finally {
        setUsersLoading(false)
      }
    },
    [tenantId, userFilters]
  )

  useEffect(() => {
    if (activeTab === 'users') fetchUsers()
  }, [activeTab, fetchUsers])

  useEffect(() => {
    if (activeTab === 'bills') fetchBills()
  }, [activeTab, fetchBills])

  const handleRemoveUser = async (relationId: number) => {
    if (!confirm('确定移除此员工？移除后该账号将无法登录此租客的小程序。')) return
    setRemovingId(relationId)
    try {
      const res = await fetch(`/api/tenants/${tenantId}/users/${relationId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) fetchUsers()
      else alert(json.message || '移除失败')
    } catch {
      alert('网络错误')
    } finally {
      setRemovingId(null)
    }
  }

  const handleToggleAdmin = async (relationId: number, isAdmin: boolean) => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/users/${relationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin }),
      })
      const json = await res.json()
      if (json.success) fetchUsers()
      else alert(json.message || '操作失败')
    } catch {
      alert('网络错误')
    }
  }

  const handleToggleStatus = async (relationId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch(`/api/tenants/${tenantId}/users/${relationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (json.success) fetchUsers()
      else alert(json.message || '操作失败')
    } catch {
      alert('网络错误')
    }
  }

  return (
    <div>
      <div className="flex border-b border-slate-200 dark:border-slate-600">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'rooms' && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left p-3 font-medium">房号</th>
                  <th className="text-left p-3 font-medium">房源名称</th>
                  <th className="text-left p-3 font-medium">房源面积(㎡)</th>
                  <th className="text-left p-3 font-medium">租赁面积(㎡)</th>
                </tr>
              </thead>
              <tbody>
                {tenantRooms.map((tr) => (
                  <tr key={tr.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-3">
                      <AppLink
                        href={`/rooms/${tr.room.id}?from=tenant&tenantId=${tenantId}`}
                        className="text-blue-600 hover:text-blue-500 hover:underline"
                      >
                        {tr.room.roomNumber}
                      </AppLink>
                    </td>
                    <td className="p-3">{tr.room.name}</td>
                    <td className="p-3">{Number(tr.room.area)}</td>
                    <td className="p-3">{Number(tr.leaseArea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenantRooms.length === 0 && (
              <div className="p-8 text-center text-slate-500">暂无租赁房源</div>
            )}
          </div>
        )}

        {activeTab === 'bills' && (
          <div>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">费用类型</label>
                <select
                  value={billFilters.feeType}
                  onChange={(e) => setBillFilters((p) => ({ ...p, feeType: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[100px]"
                >
                  {FEE_TYPES.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">结清状态</label>
                <select
                  value={billFilters.paymentStatus}
                  onChange={(e) => setBillFilters((p) => ({ ...p, paymentStatus: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[110px]"
                >
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">逾期状态</label>
                <select
                  value={billFilters.overdue}
                  onChange={(e) => setBillFilters((p) => ({ ...p, overdue: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[90px]"
                >
                  {OVERDUE_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-slate-500 mb-1">应付日期范围</label>
                <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-hidden">
                  <input
                    type="date"
                    value={billFilters.dueDateStart}
                    onChange={(e) => setBillFilters((p) => ({ ...p, dueDateStart: e.target.value }))}
                    className="px-3 py-2 border-0 border-r border-slate-200 dark:border-slate-600 bg-transparent text-sm"
                  />
                  <span className="px-2 text-slate-400 text-sm">至</span>
                  <input
                    type="date"
                    value={billFilters.dueDateEnd}
                    onChange={(e) => setBillFilters((p) => ({ ...p, dueDateEnd: e.target.value }))}
                    className="px-3 py-2 border-0 bg-transparent text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const { start, end } = getMonthRange()
                  setBillFilters((p) => ({ ...p, dueDateStart: start, dueDateEnd: end }))
                }}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                本月
              </button>
              <button
                onClick={() => fetchBills()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                查询
              </button>
              <div className="flex-1" />
              <AppLink
                href={`/bills?tenantId=${tenantId}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
              >
                <Receipt className="w-4 h-4" />
                查看全部
              </AppLink>
            </div>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left p-3 font-medium">账单编号</th>
                    <th className="text-left p-3 font-medium">房源</th>
                    <th className="text-left p-3 font-medium">费用类型</th>
                    <th className="text-left p-3 font-medium">账期</th>
                    <th className="text-right p-3 font-medium">应收</th>
                    <th className="text-right p-3 font-medium">已缴</th>
                    <th className="text-right p-3 font-medium">待缴</th>
                    <th className="text-left p-3 font-medium">结清状态</th>
                    <th className="text-left p-3 font-medium">应收日期</th>
                  </tr>
                </thead>
                <tbody>
                  {billsLoading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        加载中...
                      </td>
                    </tr>
                  ) : bills.length > 0 ? (
                    bills.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="p-3 font-medium">
                          <AppLink
                            href={`/bills/${b.id}`}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-500 hover:underline"
                          >
                            {b.code}
                          </AppLink>
                        </td>
                        <td className="p-3">
                          {b.roomsDisplay ?? b.room?.roomNumber ?? b.room?.name ?? '-'}
                        </td>
                        <td className="p-3">{b.feeType}</td>
                        <td className="p-3 text-sm">{b.period}</td>
                        <td className="p-3 text-right">¥{Number(b.accountReceivable).toFixed(2)}</td>
                        <td className="p-3 text-right">¥{Number(b.amountPaid).toFixed(2)}</td>
                        <td className="p-3 text-right">¥{Number(b.amountDue).toFixed(2)}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs ${
                              b.paymentStatus === 'paid'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : b.paymentStatus === 'partial'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? b.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3">{typeof b.dueDate === 'string' ? b.dueDate : formatDate(b.dueDate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        暂无账单
                      </td>
                    </tr>
                  )}
                </tbody>
                {!billsLoading && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                      <td colSpan={9} className="p-3">
                        <div className="flex flex-wrap gap-6 text-sm">
                          <span>
                            应收金额合计：
                            <strong className="ml-1">¥{bills.reduce((s, b) => s + Number(b.accountReceivable), 0).toFixed(2)}</strong>
                          </span>
                          <span>
                            已缴纳金额合计：
                            <strong className="ml-1">¥{bills.reduce((s, b) => s + Number(b.amountPaid), 0).toFixed(2)}</strong>
                          </span>
                          <span>
                            需缴纳金额合计：
                            <strong className="ml-1">¥{bills.reduce((s, b) => s + Number(b.amountDue), 0).toFixed(2)}</strong>
                          </span>
                          <span>
                            逾期金额合计：
                            <strong className="ml-1 text-red-600 dark:text-red-400">
                              ¥
                              {bills
                                .filter((b) => b.paymentStatus !== 'paid' && new Date(b.dueDate) < new Date())
                                .reduce((s, b) => s + Number(b.amountDue), 0)
                                .toFixed(2)}
                            </strong>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">姓名</label>
                <input
                  type="text"
                  placeholder="姓名模糊查询"
                  value={userFilters.name}
                  onChange={(e) => setUserFilters((p) => ({ ...p, name: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[120px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">手机号</label>
                <input
                  type="text"
                  placeholder="手机号模糊查询"
                  value={userFilters.phone}
                  onChange={(e) => setUserFilters((p) => ({ ...p, phone: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[120px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">管理员</label>
                <select
                  value={userFilters.isAdmin}
                  onChange={(e) => setUserFilters((p) => ({ ...p, isAdmin: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[90px]"
                >
                  <option value="">全部</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </div>
              <button
                onClick={() => fetchUsers()}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                <Search className="w-4 h-4" />
                查询
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowAddOne(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Plus className="w-4 h-4" />
                新增员工
              </button>
              <button
                onClick={() => setShowBatchImport(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                <Upload className="w-4 h-4" />
                批量导入
              </button>
            </div>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left p-3 font-medium">姓名</th>
                    <th className="text-left p-3 font-medium">手机号</th>
                    <th className="text-left p-3 font-medium">状态</th>
                    <th className="text-left p-3 font-medium">管理员</th>
                    <th className="text-left p-3 font-medium">最后登录</th>
                    <th className="text-left p-3 font-medium">添加时间</th>
                    <th className="text-left p-3 font-medium w-40">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        加载中...
                      </td>
                    </tr>
                  ) : users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="p-3">{u.name}</td>
                        <td className="p-3">{u.phone}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs ${
                              u.status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {u.status === 'active' ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="p-3">{u.isAdmin ? '是' : '否'}</td>
                        <td className="p-3 text-sm">
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '-'}
                        </td>
                        <td className="p-3 text-sm">{formatDateTime(u.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleToggleAdmin(u.id, !u.isAdmin)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                              title={u.isAdmin ? '取消管理员' : '设为管理员'}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u.id, u.status)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                              title={u.status === 'active' ? '禁用' : '启用'}
                            >
                              {u.status === 'active' ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleRemoveUser(u.id)}
                              disabled={removingId === u.id}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                              title="移除"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        暂无员工账号，点击「批量导入」添加
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showBatchImport && (
        <TenantUserBatchImportModal
          tenantId={tenantId}
          onClose={() => setShowBatchImport(false)}
          onSuccess={() => {
            setShowBatchImport(false)
            setUserFilters({ name: '', phone: '', isAdmin: '' })
            fetchUsers({ name: '', phone: '', isAdmin: '' })
            router.refresh()
          }}
        />
      )}
      {showAddOne && (
        <TenantUserAddOneModal
          tenantId={tenantId}
          onClose={() => setShowAddOne(false)}
          onSuccess={() => {
            setShowAddOne(false)
            setUserFilters({ name: '', phone: '', isAdmin: '' })
            fetchUsers({ name: '', phone: '', isAdmin: '' })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function TenantUserAddOneModal({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || phone.length < 11) {
      setError('请输入正确的手机号')
      return
    }
    if (!name.trim()) {
      setError('请输入姓名')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: [{ phone: phone.trim(), name: name.trim() }] }),
      })
      const json = await res.json()
      if (json.success) {
        onSuccess()
      } else {
        setError(json.message || json.data?.errors?.join('；') || '添加失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">新增员工</h2>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-slate-500">默认密码 123456，可登录租客端小程序</p>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">手机号 *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="11位手机号"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">姓名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="员工姓名"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600">
              取消
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
              {submitting ? '添加中...' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TenantUserBatchImportModal({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [rows, setRows] = useState<{ phone: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const header = ['手机号', '姓名']
    const example = ['13800138000', '张三']
    const ws = XLSX.utils.aoa_to_sheet([header, example])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '员工导入模板')
    XLSX.writeFile(wb, '租客员工批量导入模板.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) return
        const wb = XLSX.read(data, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as (string | number)[][]
        const list: { phone: string; name: string }[] = []
        for (let i = 0; i < raw.length; i++) {
          const row = raw[i]
          if (!row || row.length < 2) continue
          const phone = String(row[0] ?? '').trim()
          const name = String(row[1] ?? '').trim()
          if (phone.length >= 11 && name) list.push({ phone, name })
        }
        setRows(list)
      } catch {
        setResult('文件解析失败')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (rows.length === 0) {
      setResult('请先上传Excel文件')
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: rows }),
      })
      const json = await res.json()
      if (json.success) {
        setResult(json.message || `成功添加 ${json.data?.created ?? 0} 人`)
        if (json.data?.errors?.length) {
          setResult((r) => `${r}\n失败: ${json.data.errors.join('; ')}`)
        }
        setTimeout(() => onSuccess(), 1500)
      } else {
        setResult(json.message || '导入失败')
      }
    } catch {
      setResult('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">批量导入员工账号</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-500">
            上传Excel，列：手机号、姓名。新员工默认密码 123456，可登录租客端小程序。
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              下载模板
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-sm bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
            >
              选择文件
            </button>
          </div>
          {rows.length > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              已解析 {rows.length} 条，点击确认导入
            </p>
          )}
          {result && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
