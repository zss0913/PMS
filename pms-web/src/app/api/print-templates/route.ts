import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  type: z.string().min(1, '模板类型不能为空'),
  templateUrl: z.string().optional(),
  fields: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

const TEMPLATE_TYPES = ['催缴单', '收据', '发票'] as const

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

    const templates = await prisma.printTemplate.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
    })

    const list = templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      templateUrl: t.templateUrl,
      fields: t.fields,
      status: t.status,
    }))

    return NextResponse.json({ success: true, data: list })
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

    const created = await prisma.printTemplate.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        templateUrl: parsed.templateUrl || null,
        fields: parsed.fields || null,
        status: parsed.status,
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ success: true, data: created })
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
