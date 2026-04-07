import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  CATEGORY_TO_NFC_TYPE,
  type InspectionCategory,
  isValidInspectionCategory,
} from '@/lib/inspection-point-types'

function parseImagesJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string' && x.length > 0)
  } catch {
    return []
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  buildingId: z.number().int().positive().optional(),
  floorId: z.number().int().positive().optional().nullable(),
  inspectionCategory: z.enum(['工程巡检', '设备巡检', '安保巡检', '绿化巡检']).optional(),
  location: z.string().optional(),
  description: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  deviceIds: z.array(z.number().int().positive()).optional(),
  nfcTagId: z.number().int().positive().optional().nullable(),
  status: z.enum(['enabled', 'disabled']).optional(),
})

async function assertNfcTagMatchesPoint(
  companyId: number,
  buildingId: number,
  category: InspectionCategory,
  nfcTagId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const expectType = CATEGORY_TO_NFC_TYPE[category]
  const tag = await prisma.nfcTag.findFirst({
    where: { id: nfcTagId, companyId, buildingId, status: 'active' },
  })
  if (!tag) {
    return { ok: false, message: 'NFC 不存在、已停用或不属于本楼宇' }
  }
  if (tag.inspectionType !== expectType) {
    return {
      ok: false,
      message: `该 NFC 属于「${tag.inspectionType}」类，与当前巡检类型「${category}」不匹配`,
    }
  }
  return { ok: true }
}

async function validateDevicesForPoint(
  companyId: number,
  buildingId: number,
  deviceIds: number[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (deviceIds.length === 0) return { ok: true }
  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds }, companyId, buildingId },
  })
  if (devices.length !== deviceIds.length) {
    return { ok: false, message: '部分设备不存在或不属于该楼宇' }
  }
  return { ok: true }
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
    const pid = parseInt(id, 10)
    if (isNaN(pid)) {
      return NextResponse.json({ success: false, message: '无效 ID' }, { status: 400 })
    }

    const p = await prisma.inspectionPoint.findFirst({
      where: { id: pid, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true } },
        devices: { include: { device: { select: { id: true, code: true, name: true, type: true } } } },
        nfcTag: { select: { id: true, tagId: true, location: true, inspectionType: true } },
      },
    })
    if (!p) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: p.id,
        name: p.name,
        inspectionCategory: p.inspectionCategory,
        buildingId: p.buildingId,
        buildingName: p.building.name,
        floorId: p.floorId,
        floorName: p.floor?.name ?? null,
        location: p.location,
        description: p.description,
        images: parseImagesJson(p.images),
        nfcTagId: p.nfcTagId,
        nfcTag: p.nfcTag,
        status: p.status,
        deviceIds: p.devices.map((d) => d.deviceId),
        devices: p.devices.map((d) => d.device),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
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
    const pid = parseInt(id, 10)
    if (isNaN(pid)) {
      return NextResponse.json({ success: false, message: '无效 ID' }, { status: 400 })
    }

    const existing = await prisma.inspectionPoint.findFirst({
      where: { id: pid, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const nextBuildingId = parsed.buildingId ?? existing.buildingId
    if (parsed.buildingId !== undefined) {
      const b = await prisma.building.findFirst({
        where: { id: parsed.buildingId, companyId: user.companyId },
      })
      if (!b) {
        return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
      }
    }

    let nextFloorId = existing.floorId
    if (parsed.floorId !== undefined) {
      nextFloorId = parsed.floorId
      if (nextFloorId != null) {
        const fl = await prisma.floor.findFirst({
          where: { id: nextFloorId, buildingId: nextBuildingId },
        })
        if (!fl) {
          return NextResponse.json({ success: false, message: '楼层不存在或不属于该楼宇' }, { status: 400 })
        }
      }
    }

    const nextCategory = (parsed.inspectionCategory ?? existing.inspectionCategory) as InspectionCategory
    if (parsed.inspectionCategory != null && !isValidInspectionCategory(parsed.inspectionCategory)) {
      return NextResponse.json({ success: false, message: '无效的巡检类型' }, { status: 400 })
    }

    const nextStatus = parsed.status ?? existing.status
    const nextNfcId = parsed.nfcTagId !== undefined ? parsed.nfcTagId : existing.nfcTagId

    const isDeviceCategory = nextCategory === '设备巡检'
    const nextDeviceIds = parsed.deviceIds ?? undefined
    if (nextDeviceIds !== undefined) {
      if (isDeviceCategory && nextDeviceIds.length === 0) {
        return NextResponse.json(
          { success: false, message: '设备巡检须至少关联一台设备' },
          { status: 400 }
        )
      }
      if (!isDeviceCategory && nextDeviceIds.length > 0) {
        return NextResponse.json({ success: false, message: '仅设备巡检可关联设备' }, { status: 400 })
      }
      const vd = await validateDevicesForPoint(user.companyId, nextBuildingId, nextDeviceIds)
      if (!vd.ok) {
        return NextResponse.json({ success: false, message: vd.message }, { status: 400 })
      }
    }

    if (nextStatus === 'enabled' && (nextNfcId == null || nextNfcId <= 0)) {
      return NextResponse.json({ success: false, message: '启用前须绑定 NFC' }, { status: 400 })
    }
    if (nextNfcId != null && nextNfcId > 0) {
      const vn = await assertNfcTagMatchesPoint(
        user.companyId,
        nextBuildingId,
        nextCategory,
        nextNfcId
      )
      if (!vn.ok) {
        return NextResponse.json({ success: false, message: vn.message }, { status: 400 })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.inspectionPoint.update({
        where: { id: pid },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
          ...(parsed.buildingId !== undefined ? { buildingId: parsed.buildingId } : {}),
          ...(parsed.floorId !== undefined ? { floorId: parsed.floorId } : {}),
          ...(parsed.inspectionCategory !== undefined ? { inspectionCategory: parsed.inspectionCategory } : {}),
          ...(parsed.location !== undefined ? { location: parsed.location.trim() } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description?.trim() || null } : {}),
          ...(parsed.images !== undefined
            ? {
                images:
                  parsed.images.length > 0
                    ? JSON.stringify(parsed.images.map((u) => u.trim()).filter(Boolean))
                    : null,
              }
            : {}),
          ...(parsed.nfcTagId !== undefined ? { nfcTagId: parsed.nfcTagId } : {}),
          ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        },
      })

      if (nextDeviceIds !== undefined) {
        await tx.inspectionPointDevice.deleteMany({ where: { inspectionPointId: pid } })
        if (nextDeviceIds.length > 0) {
          await tx.inspectionPointDevice.createMany({
            data: nextDeviceIds.map((deviceId) => ({
              inspectionPointId: pid,
              deviceId,
            })),
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
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
    const pid = parseInt(id, 10)
    if (isNaN(pid)) {
      return NextResponse.json({ success: false, message: '无效 ID' }, { status: 400 })
    }

    const existing = await prisma.inspectionPoint.findFirst({
      where: { id: pid, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    await prisma.inspectionPoint.delete({ where: { id: pid } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
