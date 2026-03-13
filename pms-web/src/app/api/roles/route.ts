import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '角色名称不能为空'),
  code: z.string().min(1, '角色编码不能为空'),
  dataScope: z.enum(['all', 'project', 'department', 'self']),
  menuIds: z.array(z.coerce.number()).optional().default([]),
  companyId: z.number().int().min(0).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const where =
      user.companyId > 0 ? { companyId: user.companyId } : {}

    const roles = await prisma.role.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: roles.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        dataScope: r.dataScope,
        menuIds: r.menuIds ? (JSON.parse(r.menuIds) as number[]) : [],
        companyId: r.companyId,
        companyName: r.company?.name,
        accountCount: r._count.employees,
        createdAt: r.createdAt,
      })),
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

    const body = await request.json()
    const parsed = createSchema.parse(body)

    const companyId =
      user.companyId > 0 ? user.companyId : (parsed.companyId ?? 0)

    if (companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '请选择所属公司' },
        { status: 400 }
      )
    }

    const exists = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!exists) {
      return NextResponse.json(
        { success: false, message: '公司不存在' },
        { status: 400 }
      )
    }

    const codeExists = await prisma.role.findFirst({
      where: { code: parsed.code, companyId },
    })
    if (codeExists) {
      return NextResponse.json(
        { success: false, message: '该公司下角色编码已存在' },
        { status: 400 }
      )
    }

    const role = await prisma.role.create({
      data: {
        name: parsed.name,
        code: parsed.code,
        dataScope: parsed.dataScope,
        menuIds: JSON.stringify(parsed.menuIds ?? []),
        companyId,
      },
    })

    return NextResponse.json({ success: true, data: role })
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
