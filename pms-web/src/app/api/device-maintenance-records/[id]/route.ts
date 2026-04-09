import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { syncMaintenanceRecordWorkOrders } from '@/lib/device-maintenance-work-orders'

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD')

const maintenanceImagesJson = z
  .string()
  .optional()
  .nullable()
  .superRefine((val, ctx) => {
    if (val == null || val.trim() === '') return
    try {
      const arr = JSON.parse(val) as unknown
      if (!Array.isArray(arr) || !arr.every((x) => typeof x === 'string')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '维保图片须为 URL 字符串数组的 JSON' })
        return
      }
      if (arr.length > 50) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '维保图片最多 50 张' })
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '维保图片 JSON 格式无效' })
    }
  })

const updateSchema = z.object({
  type: z.string().min(1, '维保类型不能为空'),
  date: dateStr,
  maintainerId: z.number().int().min(1, '请选择维保人员'),
  cost: z.coerce.number().min(0).default(0),
  content: z.string().min(1, '维保内容不能为空'),
  images: maintenanceImagesJson,
  remark: z.string().optional().nullable(),
  /** 当前台账中仍存在的设备；已删除设备的明细行保留在库中，不在此数组中 */
  deviceIds: z.array(z.number().int().positive()).default([]),
  workOrderIds: z.array(z.number().int().positive()).max(100).optional().default([]),
})

function parseMaintenanceDate(s: string): Date {
  const d = new Date(s.trim() + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function mapRecord(r: {
  id: number
  code: string
  type: string
  date: Date
  maintainerId: number | null
  maintainerName: string
  cost: unknown
  content: string
  images: string | null
  remark: string | null
  companyId: number
  createdAt: Date
  updatedAt: Date
  items: {
    id: number
    deviceId: number | null
    deviceCode: string
    deviceName: string
    deviceType: string | null
    buildingName: string | null
  }[]
  linkedWorkOrders?: {
    id: number
    code: string
    title: string
    status: string
    type: string
  }[]
}) {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    date: r.date.toISOString().slice(0, 10),
    maintainerId: r.maintainerId,
    maintainerName: r.maintainerName,
    cost: Number(r.cost),
    content: r.content,
    images: r.images,
    remark: r.remark,
    companyId: r.companyId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      deviceId: i.deviceId,
      deviceCode: i.deviceCode,
      deviceName: i.deviceName,
      deviceType: i.deviceType,
      buildingName: i.buildingName,
      deviceRemovedFromLedger: i.deviceId === null,
    })),
    linkedWorkOrders: (r.linkedWorkOrders ?? []).map((w) => ({
      id: w.id,
      code: w.code,
      title: w.title,
      status: w.status,
      type: w.type,
    })),
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const rid = parseInt(id, 10)
    if (isNaN(rid)) {
      return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
    }

    const record = await prisma.deviceMaintenanceRecord.findFirst({
      where: { id: rid, companyId: user.companyId },
      include: {
        items: { orderBy: { id: 'asc' } },
        linkedWorkOrders: {
          select: { id: true, code: true, title: true, status: true, type: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!record) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: mapRecord(record) })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const rid = parseInt(id, 10)
    if (isNaN(rid)) {
      return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
    }

    const existing = await prisma.deviceMaintenanceRecord.findFirst({
      where: { id: rid, companyId: user.companyId },
      include: { items: { select: { deviceId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const orphanCount = existing.items.filter((i) => i.deviceId === null).length
    if (orphanCount + parsed.deviceIds.length < 1) {
      return NextResponse.json(
        { success: false, message: '至少保留一台设备（可仅为已删除台账的设备快照）' },
        { status: 400 }
      )
    }

    const maintainer = await prisma.employee.findFirst({
      where: { id: parsed.maintainerId, companyId: user.companyId },
    })
    if (!maintainer) {
      return NextResponse.json({ success: false, message: '维保人员不存在' }, { status: 400 })
    }

    const deviceRows = await prisma.device.findMany({
      where: { id: { in: parsed.deviceIds }, companyId: user.companyId },
      include: { building: { select: { name: true } } },
    })
    if (deviceRows.length !== parsed.deviceIds.length) {
      return NextResponse.json(
        { success: false, message: '部分设备不存在或无权访问' },
        { status: 400 }
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.deviceMaintenanceItem.deleteMany({
          where: { recordId: rid, deviceId: { not: null } },
        })
        await tx.deviceMaintenanceRecord.update({
          where: { id: rid },
          data: {
            type: parsed.type.trim(),
            date: parseMaintenanceDate(parsed.date),
            maintainerId: maintainer.id,
            maintainerName: maintainer.name,
            cost: parsed.cost,
            content: parsed.content.trim(),
            images: parsed.images?.trim() || null,
            remark: parsed.remark?.trim() || null,
            items: {
              create: deviceRows.map((d) => ({
                deviceId: d.id,
                deviceCode: d.code,
                deviceName: d.name,
                deviceType: d.type,
                buildingName: d.building.name,
              })),
            },
          },
        })
        await syncMaintenanceRecordWorkOrders(
          tx,
          user.companyId,
          rid,
          parsed.workOrderIds ?? []
        )
      })

      const record = await prisma.deviceMaintenanceRecord.findFirst({
        where: { id: rid },
        include: {
          items: { orderBy: { id: 'asc' } },
          linkedWorkOrders: {
            select: { id: true, code: true, title: true, status: true, type: true },
            orderBy: { id: 'asc' },
          },
        },
      })
      return NextResponse.json({
        success: true,
        data: record ? mapRecord(record) : null,
      })
    } catch (err) {
      if (err instanceof Error && (err.message.includes('工单') || err.message.includes('无权'))) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 })
      }
      throw err
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const rid = parseInt(id, 10)
    if (isNaN(rid)) {
      return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
    }

    const existing = await prisma.deviceMaintenanceRecord.findFirst({
      where: { id: rid, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    await prisma.deviceMaintenanceRecord.delete({ where: { id: rid } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
