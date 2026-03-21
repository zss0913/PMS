import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DEVICE_STATUSES = ['正常', '维修中', '报废'] as const

const deviceItemSchema = z.object({
  code: z.string().min(1, '设备编号不能为空'),
  name: z.string().min(1, '设备名称不能为空'),
  type: z.string().min(1, '设备类型不能为空'),
  status: z.enum(DEVICE_STATUSES),
  location: z.string().optional(),
  maintenanceContact: z.string().optional(),
  supplier: z.string().optional(),
  brand: z.string().optional(),
})

const batchSchema = z.object({
  buildingId: z.number().int().min(1, '请选择所属楼宇'),
  devices: z.array(deviceItemSchema).min(1, '至少需要导入一条设备'),
})

type FailedRow = {
  code: string
  name: string
  type: string
  status: string
  location: string
  maintenanceContact: string
  supplier: string
  brand: string
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号操作' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = batchSchema.parse(body)

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json(
        { success: false, message: '楼宇不存在或无权限' },
        { status: 404 }
      )
    }

    const existingCodes = new Set(
      (
        await prisma.device.findMany({
          where: { companyId: user.companyId },
          select: { code: true },
        })
      ).map((d) => d.code)
    )

    const toCreate: {
      code: string
      name: string
      type: string
      status: string
      buildingId: number
      location: string
      maintenanceContact: string | null
      supplier: string
      brand: string | null
      companyId: number
    }[] = []
    const failedRows: FailedRow[] = []
    const seenInBatch = new Set<string>()

    for (const d of parsed.devices) {
      const code = d.code.trim()
      const rowData: FailedRow = {
        code,
        name: d.name.trim(),
        type: d.type.trim(),
        status: d.status,
        location: (d.location ?? '').trim(),
        maintenanceContact: (d.maintenanceContact ?? '').trim(),
        supplier: (d.supplier ?? '').trim(),
        brand: (d.brand ?? '').trim(),
        reason: '',
      }

      if (!code) {
        rowData.reason = '设备编号不能为空'
        failedRows.push(rowData)
        continue
      }

      if (!DEVICE_STATUSES.includes(d.status as (typeof DEVICE_STATUSES)[number])) {
        rowData.reason = `状态「${d.status}」无效，应为：${DEVICE_STATUSES.join('、')}`
        failedRows.push(rowData)
        continue
      }

      if (seenInBatch.has(code)) {
        rowData.reason = '导入文件中设备编号重复'
        failedRows.push(rowData)
        continue
      }

      if (existingCodes.has(code)) {
        rowData.reason = '设备编号已存在（同一物业公司下不可重复）'
        failedRows.push(rowData)
        continue
      }

      seenInBatch.add(code)
      existingCodes.add(code)

      toCreate.push({
        code,
        name: rowData.name,
        type: rowData.type,
        status: rowData.status,
        buildingId: parsed.buildingId,
        location: rowData.location || '',
        maintenanceContact: rowData.maintenanceContact || null,
        supplier: rowData.supplier || '',
        brand: rowData.brand || null,
        companyId: user.companyId,
      })
    }

    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((r) =>
          prisma.device.create({
            data: {
              ...r,
              commissionedDate: new Date(),
            },
          })
        )
      )
    }

    return NextResponse.json({
      success: true,
      successCount: toCreate.length,
      failedCount: failedRows.length,
      failedRows,
      message:
        failedRows.length === 0
          ? `成功导入 ${toCreate.length} 条设备`
          : `成功导入 ${toCreate.length} 条，失败 ${failedRows.length} 条`,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
