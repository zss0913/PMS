import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const updateSchema = z.object({
  name: z.string().min(1, '项目名称必填'),
  location: z.string().optional().nullable(),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  greenArea: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  manager: z.string().min(1, '负责人必填'),
  phone: z.string().min(1, '联系电话必填'),
  buildingIds: z.array(z.number()).min(1, '至少选择一个关联楼宇'),
})

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
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
    const projectId = parseInt(id, 10)
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, message: '无效的项目ID' }, { status: 400 })
    }
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    })
    if (!project) {
      return NextResponse.json({ success: false, message: '项目不存在' }, { status: 404 })
    }
    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        ...project,
        area: Number(project.area),
        greenArea: Number(project.greenArea),
        buildingIds: parseJsonIds(project.buildingIds),
        buildings,
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
    const projectId = parseInt(id, 10)
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, message: '无效的项目ID' }, { status: 400 })
    }
    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '项目不存在' }, { status: 404 })
    }
    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const oldBuildingIds = parseJsonIds(existing.buildingIds)
    const newBuildingIds = parsed.buildingIds
    const toAdd = newBuildingIds.filter((id) => !oldBuildingIds.includes(id))
    const toRemove = oldBuildingIds.filter((id) => !newBuildingIds.includes(id))

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          name: parsed.name,
          location: parsed.location ?? null,
          area: new Decimal(parsed.area),
          greenArea: new Decimal(parsed.greenArea),
          manager: parsed.manager,
          phone: parsed.phone,
          buildingIds: JSON.stringify(parsed.buildingIds),
        },
      })
      if (toRemove.length > 0) {
        await tx.building.updateMany({
          where: { id: { in: toRemove }, projectId },
          data: { projectId: null },
        })
      }
      if (toAdd.length > 0) {
        await tx.building.updateMany({
          where: { id: { in: toAdd }, companyId: user.companyId },
          data: { projectId },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message || '参数错误', errors: e.errors },
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
    const projectId = parseInt(id, 10)
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, message: '无效的项目ID' }, { status: 400 })
    }
    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '项目不存在' }, { status: 404 })
    }
    await prisma.$transaction(async (tx) => {
      await tx.building.updateMany({
        where: { projectId },
        data: { projectId: null },
      })
      await tx.project.delete({ where: { id: projectId } })
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
