import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routeReferencesNfcTagId } from '@/lib/inspection-route-nfc'
import { z } from 'zod'

const INSPECTION_TYPES = ['工程', '安保', '设备', '绿化'] as const

const updateSchema = z.object({
  tagId: z.string().min(1, 'NFC ID不能为空').optional(),
  buildingId: z.number().int().min(1).optional(),
  location: z.string().min(1, '位置名称不能为空').optional(),
  description: z.string().optional(),
  inspectionType: z.enum(INSPECTION_TYPES).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

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
    const tagId = parseInt(id, 10)
    if (isNaN(tagId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.nfcTag.findFirst({
      where: { id: tagId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'NFC标签不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    if (parsed.tagId && parsed.tagId !== existing.tagId) {
      const tagIdExists = await prisma.nfcTag.findFirst({
        where: { tagId: parsed.tagId, companyId: user.companyId },
      })
      if (tagIdExists) {
        return NextResponse.json(
          { success: false, message: '该NFC ID已存在' },
          { status: 400 }
        )
      }
    }

    if (parsed.buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: parsed.buildingId, companyId: user.companyId },
      })
      if (!building) {
        return NextResponse.json(
          { success: false, message: '楼宇不存在' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.nfcTag.update({
      where: { id: tagId },
      data: {
        ...(parsed.tagId && { tagId: parsed.tagId }),
        ...(parsed.buildingId && { buildingId: parsed.buildingId }),
        ...(parsed.location && { location: parsed.location }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.inspectionType && { inspectionType: parsed.inspectionType }),
        ...(parsed.status && { status: parsed.status }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
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
    const tagId = parseInt(id, 10)
    if (isNaN(tagId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.nfcTag.findFirst({
      where: { id: tagId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'NFC标签不存在' },
        { status: 404 }
      )
    }

    const nfcCode = existing.tagId
    const companyId = user.companyId

    const plans = await prisma.inspectionPlan.findMany({
      where: { companyId, route: { not: null } },
      select: { route: true },
    })
    if (plans.some((p) => p.route && routeReferencesNfcTagId(p.route, nfcCode))) {
      return NextResponse.json(
        {
          success: false,
          message:
            '该NFC标签已出现在巡检计划路线中，请先调整计划后再删除',
        },
        { status: 400 }
      )
    }

    const tasks = await prisma.inspectionTask.findMany({
      where: { companyId, route: { not: null } },
      select: { route: true },
    })
    if (tasks.some((t) => t.route && routeReferencesNfcTagId(t.route, nfcCode))) {
      return NextResponse.json(
        {
          success: false,
          message:
            '该NFC标签已出现在巡检任务路线中，请先调整相关任务后再删除',
        },
        { status: 400 }
      )
    }

    const recordHit = await prisma.inspectionRecord.findFirst({
      where: { companyId, tagId: nfcCode },
      select: { id: true },
    })
    if (recordHit) {
      return NextResponse.json(
        {
          success: false,
          message: '该NFC标签已有巡检记录，无法删除',
        },
        { status: 400 }
      )
    }

    await prisma.nfcTag.delete({ where: { id: tagId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
