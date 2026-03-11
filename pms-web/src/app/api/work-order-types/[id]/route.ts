import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1, '类型名称不能为空').optional(),
  sort: z.number().int().optional(),
  enabled: z.boolean().optional(),
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
    const typeId = parseInt(id, 10)
    if (isNaN(typeId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.workOrderType.findFirst({
      where: { id: typeId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '工单类型不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    if (parsed.name && parsed.name !== existing.name) {
      const nameExists = await prisma.workOrderType.findFirst({
        where: { name: parsed.name, companyId: user.companyId },
      })
      if (nameExists) {
        return NextResponse.json(
          { success: false, message: '该工单类型名称已存在' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.workOrderType.update({
      where: { id: typeId },
      data: {
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.sort !== undefined && { sort: parsed.sort }),
        ...(parsed.enabled !== undefined && { enabled: parsed.enabled }),
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
    const typeId = parseInt(id, 10)
    if (isNaN(typeId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.workOrderType.findFirst({
      where: { id: typeId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '工单类型不存在' },
        { status: 404 }
      )
    }

    const workOrderCount = await prisma.workOrder.count({
      where: { companyId: user.companyId, type: existing.name },
    })
    if (workOrderCount > 0) {
      return NextResponse.json(
        { success: false, message: `该类型下有 ${workOrderCount} 个工单，无法删除` },
        { status: 400 }
      )
    }

    await prisma.workOrderType.delete({ where: { id: typeId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
