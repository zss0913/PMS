import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

async function recalculateFloorArea(floorId: number) {
  try {
    const rooms = await prisma.room.findMany({
      where: { floorId },
      select: { area: true },
    })
    const totalArea = rooms.reduce((sum, room) => sum + Number(room.area), 0)
    await prisma.floor.update({
      where: { id: floorId },
      data: { area: totalArea },
    })
  } catch (e) {
    console.error('计算楼层面积失败:', e)
  }
}

const ROOM_TYPES = ['商铺', '写字楼', '住宅'] as const
const ROOM_STATUSES = ['空置', '已租', '自用'] as const
const LEASING_STATUSES = ['可招商', '不可招商'] as const

const roomItemSchema = z.object({
  name: z.string().min(1, '房源名称不能为空'),
  roomNumber: z.string().min(1, '房号不能为空'),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  floorName: z.string().min(1, '楼层名称不能为空'),
  type: z.string(),
  status: z.string(),
  leasingStatus: z.string(),
})

const batchSchema = z.object({
  buildingId: z.number(),
  rooms: z.array(roomItemSchema).min(1, '至少需要导入一条房源'),
})

type FailedRow = {
  name: string
  roomNumber: string
  area: number
  floorName: string
  type: string
  status: string
  leasingStatus: string
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const companyId = user.companyId
    if (companyId <= 0) {
      return NextResponse.json({ success: false, message: '超级管理员需使用员工账号操作' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = batchSchema.parse(body)

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId },
      include: { floors: { select: { id: true, name: true } } },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在或无权限' }, { status: 404 })
    }

        // 楼层名称匹配：支持 "3" 匹配 "3层"、全角数字转半角
    const normalizeFloorName = (s: string): string => {
      let r = s.trim()
      r = r.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      return r.replace(/\s+/g, '')
    }
    const floorMap = new Map<string, number>()
    for (const f of building.floors) {
      const name = normalizeFloorName(f.name)
      floorMap.set(name, f.id)
      const m = name.match(/^(-?\d+)层?$/)
      if (m) floorMap.set(m[1], f.id)
      if (name.endsWith('层')) floorMap.set(name.replace(/层$/, ''), f.id)
    }
    const existingRooms = await prisma.room.findMany({
      where: { buildingId: parsed.buildingId },
      select: { roomNumber: true },
    })
    const existingNumbers = new Set(existingRooms.map((r) => r.roomNumber))

    const toCreate: { name: string; roomNumber: string; area: number; floorId: number; type: string; status: string; leasingStatus: string }[] = []
    const failedRows: FailedRow[] = []
    const importNumbers = new Set<string>()

    for (let i = 0; i < parsed.rooms.length; i++) {
      const r = parsed.rooms[i]
      const rowData = {
        name: r.name.trim(),
        roomNumber: r.roomNumber.trim(),
        area: r.area,
        floorName: r.floorName.trim(),
        type: r.type,
        status: r.status,
        leasingStatus: r.leasingStatus,
      }

      // 校验房源类型、房源状态、招商状态
      const reasons: string[] = []
      if (!ROOM_TYPES.includes(r.type as typeof ROOM_TYPES[number])) {
        reasons.push(`房源类型「${r.type}」无效，应为：${ROOM_TYPES.join('、')}`)
      }
      if (!ROOM_STATUSES.includes(r.status as typeof ROOM_STATUSES[number])) {
        reasons.push(`房源状态「${r.status}」无效，应为：${ROOM_STATUSES.join('、')}`)
      }
      if (!LEASING_STATUSES.includes(r.leasingStatus as typeof LEASING_STATUSES[number])) {
        reasons.push(`招商状态「${r.leasingStatus}」无效，应为：${LEASING_STATUSES.join('、')}`)
      }
      if (reasons.length > 0) {
        failedRows.push({ ...rowData, reason: reasons.join('；') })
        continue
      }

      if (r.area < 0) {
        failedRows.push({ ...rowData, reason: '管理面积不能为负' })
        continue
      }

      const normalized = normalizeFloorName(r.floorName)
      const floorId = floorMap.get(normalized) ??
        floorMap.get(normalized.replace(/层$/, '')) ??
        floorMap.get(normalized + '层')
      if (!floorId) {
        failedRows.push({ ...rowData, reason: `楼层「${r.floorName}」在该楼宇中不存在` })
        continue
      }

      if (existingNumbers.has(rowData.roomNumber)) {
        failedRows.push({ ...rowData, reason: '房号已存在' })
        continue
      }
      if (importNumbers.has(rowData.roomNumber)) {
        failedRows.push({ ...rowData, reason: '房号在导入数据中重复' })
        continue
      }
      importNumbers.add(rowData.roomNumber)

      toCreate.push({
        ...rowData,
        floorId,
      })
    }

    const floorIdsToRecalc = new Set<number>()
    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((r) =>
          prisma.room.create({
            data: {
              name: r.name,
              roomNumber: r.roomNumber,
              area: new Decimal(r.area),
              buildingId: parsed.buildingId,
              floorId: r.floorId,
              type: r.type,
              status: r.status,
              leasingStatus: r.leasingStatus,
              companyId,
            },
          })
        )
      )
      for (const r of toCreate) {
        floorIdsToRecalc.add(r.floorId)
      }
      for (const fid of floorIdsToRecalc) {
        await recalculateFloorArea(fid)
      }
    }

    return NextResponse.json({
      success: true,
      successCount: toCreate.length,
      failedCount: failedRows.length,
      failedRows,
      message:
        failedRows.length === 0
          ? `成功导入 ${toCreate.length} 条房源`
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
