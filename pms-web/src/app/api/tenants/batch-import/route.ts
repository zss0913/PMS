import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { z } from 'zod'

const rowSchema = z.object({
  type: z.enum(['租客', '业主']),
  companyName: z.string().min(1, '公司名称必填').max(200, '公司名称最多200个字符'),
  buildingName: z.string().min(1),
  roomNumbers: z.string().min(1),
  leaseAreas: z.string().min(1),
  moveInDate: z.string().min(1),
  leaseStartDate: z.string().min(1),
  leaseEndDate: z.string().min(1),
  /** 客户端解析 Excel 时的 1-based 行号，用于失败明细 */
  excelRow: z.number().int().positive().optional(),
})

const bodySchema = z.object({
  rows: z.array(z.unknown()).min(1, '请至少提供一行数据'),
})

function coerceFailureRow(raw: unknown): TenantImportRow {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    type: o.type === '业主' ? '业主' : '租客',
    companyName: String(o.companyName ?? ''),
    buildingName: String(o.buildingName ?? ''),
    roomNumbers: String(o.roomNumbers ?? ''),
    leaseAreas: String(o.leaseAreas ?? ''),
    moveInDate: String(o.moveInDate ?? ''),
    leaseStartDate: String(o.leaseStartDate ?? ''),
    leaseEndDate: String(o.leaseEndDate ?? ''),
    excelRow:
      typeof o.excelRow === 'number' && Number.isFinite(o.excelRow) ? Math.floor(o.excelRow) : undefined,
  }
}

type TenantImportRow = z.infer<typeof rowSchema>

function splitCells(s: string): string[] {
  return String(s)
    .split(/[,，;；、\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseAreas(areasRaw: string, roomCount: number): { ok: true; values: number[] } | { ok: false; message: string } {
  const parts = splitCells(areasRaw)
  if (parts.length === 0) return { ok: false, message: '租赁面积不能为空' }
  const nums = parts.map((p) => {
    const n = Number(p)
    return Number.isFinite(n) && n >= 0 ? n : NaN
  })
  if (nums.some((n) => Number.isNaN(n))) {
    return { ok: false, message: '租赁面积须为有效数字' }
  }
  if (nums.length === 1 && roomCount > 1) {
    return { ok: true, values: Array(roomCount).fill(nums[0]) }
  }
  if (nums.length !== roomCount) {
    return { ok: false, message: `房号 ${roomCount} 个，面积需 1 个（各房相同）或 ${roomCount} 个（与房号一一对应）` }
  }
  return { ok: true, values: nums }
}

function parseDate(s: string): Date | null {
  const t = String(s).trim().replace(/\//g, '-')
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d
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
    const { rows: rawRows } = bodySchema.parse(body)

    const buildingNames = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, rooms: { select: { id: true, roomNumber: true } } },
    })
    const nameToBuilding = new Map(buildingNames.map((b) => [b.name.trim(), b]))

    type Failure = TenantImportRow & { rowIndex: number; reason: string }
    const failures: Failure[] = []
    let successCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      const parsedRow = rowSchema.safeParse(raw)
      if (!parsedRow.success) {
        const msg = parsedRow.error.errors[0]?.message ?? '字段校验失败'
        const cr = coerceFailureRow(raw)
        const rowIndex = cr.excelRow ?? i + 2
        failures.push({ ...cr, rowIndex, reason: msg })
        continue
      }
      const row = parsedRow.data
      const rowIndex = row.excelRow ?? i + 2
      const fail = (reason: string) => {
        const { excelRow: _e, ...rest } = row
        failures.push({ ...rest, rowIndex, reason })
      }

      try {
        const building = nameToBuilding.get(row.buildingName.trim())
        if (!building) {
          fail(`未找到楼宇「${row.buildingName}」，请与系统中楼宇名称完全一致`)
          continue
        }

        const roomNums = splitCells(row.roomNumbers)
        if (roomNums.length === 0) {
          fail('房号不能为空')
          continue
        }

        const areaParsed = parseAreas(row.leaseAreas, roomNums.length)
        if (!areaParsed.ok) {
          fail(areaParsed.message)
          continue
        }

        const moveIn = parseDate(row.moveInDate)
        const leaseStart = parseDate(row.leaseStartDate)
        const leaseEnd = parseDate(row.leaseEndDate)
        if (!moveIn || !leaseStart || !leaseEnd) {
          fail('日期格式无效，请使用 YYYY-MM-DD')
          continue
        }
        if (leaseEnd < leaseStart) {
          fail('租期结束不能早于租期开始')
          continue
        }

        const roomIdList: number[] = []
        for (const rn of roomNums) {
          const room = building.rooms.find((r) => r.roomNumber.trim() === rn)
          if (!room) {
            fail(`楼宇「${building.name}」下无房号「${rn}」`)
            break
          }
          roomIdList.push(room.id)
        }
        if (roomIdList.length !== roomNums.length) continue

        const totalArea = areaParsed.values.reduce((a, b) => a + b, 0)
        const companyName = row.companyName.trim()

        const nameDup = await prisma.tenant.findFirst({
          where: { companyId: user.companyId, companyName },
        })
        if (nameDup) {
          fail('公司名称在当前物业公司下已存在，不能重复')
          continue
        }

        await prisma.$transaction(async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              type: row.type,
              companyName,
              buildingId: building.id,
              moveInDate: moveIn,
              leaseStartDate: leaseStart,
              leaseEndDate: leaseEnd,
              totalArea: new Decimal(totalArea),
              companyId: user.companyId,
            },
          })
          await tx.tenantRoom.createMany({
            data: roomIdList.map((roomId, idx) => ({
              tenantId: tenant.id,
              roomId,
              leaseArea: new Decimal(areaParsed.values[idx]),
            })),
          })
        })

        successCount++
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          fail('公司名称在当前物业公司下已存在，不能重复')
        } else {
          fail(err instanceof Error ? err.message : '导入失败')
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount,
        failCount: failures.length,
        failures,
      },
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
