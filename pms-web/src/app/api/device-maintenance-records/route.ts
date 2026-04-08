import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
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

const createSchema = z.object({
  type: z.string().min(1, '维保类型不能为空'),
  date: dateStr,
  maintainerId: z.number().int().min(1, '请选择维保人员'),
  cost: z.coerce.number().min(0).default(0),
  content: z.string().min(1, '维保内容不能为空'),
  images: maintenanceImagesJson,
  remark: z.string().optional().nullable(),
  deviceIds: z.array(z.number().int().positive()).min(1, '至少选择一台设备'),
  /** 选填：关联工单（每条工单仅能关联一条维保记录） */
  workOrderIds: z.array(z.number().int().positive()).max(100).optional().default([]),
})

function parseMaintenanceDate(s: string): Date {
  const d = new Date(s.trim() + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? new Date() : d
}

async function nextRecordCode(companyId: number): Promise<string> {
  const prefix = `WB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`
  const last = await prisma.deviceMaintenanceRecord.findFirst({
    where: { companyId, code: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { code: true },
  })
  const n = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(n).padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const keyword = (searchParams.get('keyword') ?? '').trim()
    const maintainerQ = (searchParams.get('maintainer') ?? '').trim()
    const deviceQ = (searchParams.get('device') ?? '').trim()
    const type = (searchParams.get('type') ?? '').trim()
    const dateFrom = searchParams.get('dateFrom')?.trim()
    const dateTo = searchParams.get('dateTo')?.trim()

    const where: Prisma.DeviceMaintenanceRecordWhereInput = { companyId: user.companyId }

    if (type) {
      where.type = { contains: type }
    }
    const dateFilter: Prisma.DateTimeFilter = {}
    if (dateFrom) {
      dateFilter.gte = parseMaintenanceDate(dateFrom)
    }
    if (dateTo) {
      const end = parseMaintenanceDate(dateTo)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter
    }

    const records = await prisma.deviceMaintenanceRecord.findMany({
      where,
      include: {
        items: { select: { deviceCode: true, deviceName: true, deviceId: true } },
        _count: { select: { linkedWorkOrders: true } },
      },
      orderBy: { id: 'desc' },
    })

    let list = records.map((r) => {
      const items = r.items.map((i) => ({
        deviceCode: i.deviceCode,
        deviceName: i.deviceName,
      }))
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
        workOrderCount: r._count.linkedWorkOrders,
        deviceCount: r.items.length,
        deviceSummary:
          r.items.length === 0
            ? '—'
            : r.items.length <= 2
              ? r.items.map((i) => `${i.deviceCode} ${i.deviceName}`).join('；')
              : `${r.items[0].deviceCode} ${r.items[0].deviceName} 等 ${r.items.length} 台`,
        items,
      }
    })

    /** 综合关键词：单号、类型、维保内容（不含人员、设备） */
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(
        (r) =>
          r.code.toLowerCase().includes(kw) ||
          r.type.toLowerCase().includes(kw) ||
          r.content.toLowerCase().includes(kw)
      )
    }

    if (maintainerQ) {
      const m = maintainerQ.toLowerCase()
      list = list.filter((r) => r.maintainerName.toLowerCase().includes(m))
    }

    if (deviceQ) {
      const d = deviceQ.toLowerCase()
      list = list.filter(
        (r) =>
          r.deviceSummary.toLowerCase().includes(d) ||
          r.items.some(
            (i) =>
              i.deviceCode.toLowerCase().includes(d) || i.deviceName.toLowerCase().includes(d)
          )
      )
    }

    const devices = await prisma.device.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        buildingId: true,
        building: { select: { name: true } },
      },
    })

    const deviceOptions = devices.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      buildingId: d.buildingId,
      buildingName: d.building.name,
    }))

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true, phone: true, department: { select: { name: true } } },
      orderBy: { id: 'asc' },
    })

    const maintainerOptions = employees.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      departmentName: e.department?.name ?? '',
    }))

    return NextResponse.json({
      success: true,
      data: { list, deviceOptions, maintainerOptions },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const parsed = createSchema.parse(body)

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

    const code = await nextRecordCode(user.companyId)

    try {
      const record = await prisma.$transaction(async (tx) => {
        const created = await tx.deviceMaintenanceRecord.create({
          data: {
            code,
            type: parsed.type.trim(),
            date: parseMaintenanceDate(parsed.date),
            maintainerId: maintainer.id,
            maintainerName: maintainer.name,
            cost: parsed.cost,
            content: parsed.content.trim(),
            images: parsed.images?.trim() || null,
            remark: parsed.remark?.trim() || null,
            companyId: user.companyId,
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
          created.id,
          parsed.workOrderIds ?? []
        )
        return created
      })

      return NextResponse.json({ success: true, data: { id: record.id } })
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
