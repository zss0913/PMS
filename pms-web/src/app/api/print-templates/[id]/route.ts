import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').optional(),
  type: z.enum(['催缴单', '收据'], { message: '模板类型须为催缴单或收据' }).optional(),
  templateUrl: z.string().optional(),
  fields: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
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
    const templateId = parseInt(id, 10)
    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.printTemplate.findFirst({
      where: { id: templateId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '打印模板不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updated = await prisma.printTemplate.update({
      where: { id: templateId },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.type !== undefined && { type: parsed.type }),
        ...(parsed.templateUrl !== undefined && { templateUrl: parsed.templateUrl || null }),
        ...(parsed.fields !== undefined && { fields: parsed.fields || null }),
        ...(parsed.status !== undefined && { status: parsed.status }),
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
    const templateId = parseInt(id, 10)
    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.printTemplate.findFirst({
      where: { id: templateId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '打印模板不存在' },
        { status: 404 }
      )
    }

    await prisma.printTemplate.delete({ where: { id: templateId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
