import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '部门名称必填'),
  parentId: z.number().nullable().optional(),
  managerId: z.number().nullable().optional(),
  projectIds: z.array(z.number()).optional().default([]),
  buildingIds: z.array(z.number()).optional().default([]),
})

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
    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    })
    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    })
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
    })
    const managerIds = [...new Set(departments.map((d) => d.managerId).filter(Boolean))] as number[]
    const managers =
      managerIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, name: true },
          })
        : []
    const managerMap = Object.fromEntries(managers.map((m) => [m.id, m]))
    const list = departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId,
      parent: d.parent,
      managerId: d.managerId,
      manager: d.managerId ? managerMap[d.managerId] ?? null : null,
      projectIds: parseJsonIds(d.projectIds),
      buildingIds: parseJsonIds(d.buildingIds),
      companyId: d.companyId,
      employeeCount: d._count.employees,
    }))
    return NextResponse.json({
      success: true,
      data: { list, projects, buildings, employees },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
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
    const dept = await prisma.department.create({
      data: {
        name: parsed.name,
        parentId: parsed.parentId ?? null,
        managerId: parsed.managerId ?? null,
        projectIds: JSON.stringify(parsed.projectIds ?? []),
        buildingIds: JSON.stringify(parsed.buildingIds ?? []),
        companyId: user.companyId,
      },
    })
    return NextResponse.json({ success: true, data: dept })
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
