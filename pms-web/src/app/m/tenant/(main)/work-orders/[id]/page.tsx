'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Wo = {
  id: number
  code: string
  title: string
  type: string
  description: string
  status: string
  facilityScope: string | null
  feeRemark: string | null
  location: string | null
  imageUrls: string[]
  building: { name: string } | null
  room: { roomNumber: string; name: string } | null
  tenant: { companyName: string } | null
  assignedEmployee: { name: string; phone: string } | null
  createdAt: string
}

export default function TenantWorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [wo, setWo] = useState<Wo | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}`, { credentials: 'include' })
      const j = await r.json()
      setWo(j.workOrder ?? null)
    } catch {
      setWo(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const confirmFee = async () => {
    setMsg('')
    setConfirming(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/confirm-fee`, {
        method: 'POST',
        credentials: 'include',
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '操作失败')
        return
      }
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">加载中…</div>
    )
  }
  if (!wo) {
    return (
      <div className="p-4">
        <Link href="/m/tenant/work-orders" className="text-sm text-slate-500">
          ← 返回
        </Link>
        <p className="mt-4 text-slate-500">工单不存在</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <Link href="/m/tenant/work-orders" className="text-sm text-slate-500">
        ← 返回列表
      </Link>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex justify-between gap-2">
          <span className="font-mono text-xs text-slate-500">{wo.code}</span>
          <span className="text-sm font-medium text-blue-600">{wo.status}</span>
        </div>
        <h1 className="text-lg font-semibold">{wo.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{wo.description}</p>
        <dl className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">类型</dt>
            <dd>{wo.type}</dd>
          </div>
          {wo.facilityScope && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">范围</dt>
              <dd>{wo.facilityScope}</dd>
            </div>
          )}
          {wo.building && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">楼宇</dt>
              <dd>{wo.building.name}</dd>
            </div>
          )}
          {wo.room && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">房源</dt>
              <dd>
                {wo.room.roomNumber} · {wo.room.name}
              </dd>
            </div>
          )}
          {wo.tenant && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">租客</dt>
              <dd>{wo.tenant.companyName}</dd>
            </div>
          )}
          {wo.assignedEmployee && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">处理人</dt>
              <dd>
                {wo.assignedEmployee.name} {wo.assignedEmployee.phone}
              </dd>
            </div>
          )}
          {wo.location && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">位置</dt>
              <dd>{wo.location}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">创建时间</dt>
            <dd>{new Date(wo.createdAt).toLocaleString('zh-CN')}</dd>
          </div>
        </dl>

        {wo.feeRemark && wo.status === '待确认费用' && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">费用说明</p>
            <p className="mt-1 text-amber-800 dark:text-amber-100 whitespace-pre-wrap">{wo.feeRemark}</p>
            <button
              type="button"
              onClick={() => void confirmFee()}
              disabled={confirming}
              className="mt-3 w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {confirming ? '提交中…' : '确认费用并继续维修'}
            </button>
          </div>
        )}

        {wo.status === '待评价' && (
          <p className="text-sm text-slate-500">
            工单已办结，评价功能即将开放；您也可在 PC 端联系物业反馈。
          </p>
        )}

        {wo.imageUrls.length > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-2">图片</p>
            <div className="flex flex-wrap gap-2">
              {wo.imageUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                </a>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  )
}
