import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  CATEGORY_TO_NFC_TYPE,
  INSPECTION_CATEGORIES,
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

const createSchema = z.object({
  name: z.string().min(1, '名称必填'),
  buildingId: z.number().int().positive('请选择楼宇'),
  floorId: z.number().int().positive().optional().nullable(),
  inspectionCategory: z.enum(['工程巡检', '设备巡检', '安保巡检', '绿化巡检']),
  location: z.string().optional().default(''),
  description: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]),
  deviceIds: z.array(z.number().int().positive()).optional().default([]),
  nfcTagId: z.number().int().positive().optional().nullable(),
  status: z.enum(['enabled', 'disabled']).default('disabled'),
})

/** 当 nfcTagId 已填写时校验标签（启用 / 禁用均可先绑定） */
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

    const { searchParams } = request.nextUrl
    const q = (searchParams.get('q') || '').trim()
    const buildingId = searchParams.get('buildingId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where: Prisma.InspectionPointWhereInput = {
      companyId: user.companyId,
    }
    if (buildingId && /^\d+$/.test(buildingId)) {
      where.buildingId = parseInt(buildingId, 10)
    }
    if (status === 'enabled' || status === 'disabled') {
      where.status = status
    }
    if (category && isValidInspectionCategory(category)) {
      where.inspectionCategory = category
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { location: { contains: q } },
        { description: { contains: q } },
      ]
    }

    const [rows, buildings, floors] = await Promise.all([
      prisma.inspectionPoint.findMany({
        where,
        orderBy: { id: 'desc' },
        include: {
          building: { select: { id: true, name: true } },
          floor: { select: { id: true, name: true } },
          nfcTag: { select: { id: true, tagId: true, location: true, inspectionType: true } },
          devices: { include: { device: { select: { id: true, code: true, name: true } } } },
        },
      }),
      prisma.building.findMany({
        where: { companyId: user.companyId },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      }),
      prisma.floor.findMany({
        where: { building: { companyId: user.companyId } },
        select: { id: true, name: true, buildingId: true, sort: true },
        orderBy: [{ buildingId: 'asc' }, { sort: 'asc' }, { id: 'asc' }],
      }),
    ])

    const list = rows.map((p) => ({
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
      nfcTag: p.nfcTag
        ? {
            id: p.nfcTag.id,
            tagId: p.nfcTag.tagId,
            location: p.nfcTag.location,
            inspectionType: p.nfcTag.inspectionType,
          }
        : null,
      status: p.status,
      devices: p.devices.map((d) => d.device),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        list,
        buildings,
        floors,
        inspectionCategories: [...INSPECTION_CATEGORIES],
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
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

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
    }

    if (parsed.floorId != null) {
      const fl = await prisma.floor.findFirst({
        where: { id: parsed.floorId, buildingId: parsed.buildingId },
      })
      if (!fl) {
        return NextResponse.json({ success: false, message: '楼层不存在或不属于该楼宇' }, { status: 400 })
      }
    }

    const isDeviceCategory = parsed.inspectionCategory === '设备巡检'
    if (isDeviceCategory && parsed.deviceIds.length === 0) {
      return NextResponse.json(
        { success: false, message: '设备巡检须至少关联一台设备' },
        { status: 400 }
      )
    }
    if (!isDeviceCategory && parsed.deviceIds.length > 0) {
      return NextResponse.json(
        { success: false, message: '仅设备巡检可关联设备' },
        { status: 400 }
      )
    }

    const vd = await validateDevicesForPoint(user.companyId, parsed.buildingId, parsed.deviceIds)
    if (!vd.ok) {
      return NextResponse.json({ success: false, message: vd.message }, { status: 400 })
    }

    if (parsed.status === 'enabled' && (parsed.nfcTagId == null || parsed.nfcTagId <= 0)) {
      return NextResponse.json({ success: false, message: '启用前须绑定 NFC' }, { status: 400 })
    }
    if (parsed.nfcTagId != null && parsed.nfcTagId > 0) {
      const vn = await assertNfcTagMatchesPoint(
        user.companyId,
        parsed.buildingId,
        parsed.inspectionCategory,
        parsed.nfcTagId
      )
      if (!vn.ok) {
        return NextResponse.json({ success: false, message: vn.message }, { status: 400 })
      }
    }

    const imagesJson =
      parsed.images.length > 0 ? JSON.stringify(parsed.images.map((u) => u.trim()).filter(Boolean)) : null

    const created = await prisma.$transaction(async (tx) => {
      const point = await tx.inspectionPoint.create({
        data: {
          companyId: user.companyId,
          buildingId: parsed.buildingId,
          floorId: parsed.floorId ?? null,
          inspectionCategory: parsed.inspectionCategory,
          name: parsed.name.trim(),
          location: parsed.location?.trim() ?? '',
          description: parsed.description?.trim() || null,
          images: imagesJson,
          nfcTagId: parsed.nfcTagId ?? null,
          status: parsed.status,
        },
      })

      if (parsed.deviceIds.length > 0) {
        await tx.inspectionPointDevice.createMany({
          data: parsed.deviceIds.map((deviceId) => ({
            inspectionPointId: point.id,
            deviceId,
          })),
        })
      }

      return point
    })

    return NextResponse.json({ success: true, data: { id: created.id } })
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
