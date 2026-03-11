import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed']).optional(),
  result: z.string().optional(),
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
    const complaintId = parseInt(id, 10)
    if (isNaN(complaintId)) {
      return NextResponse.json({ success: false, message: '无效的投诉ID' }, { status: 400 })
    }
    const existing = await prisma.complaint.findFirst({
      where: { id: complaintId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '投诉不存在' }, { status: 404 })
    }
    const body = await request.json()
    const parsed = updateSchema.parse(body)
    const updateData: Record<string, unknown> = {}
    if (parsed.status !== undefined) {
      updateData.status = parsed.status
      if (parsed.status === 'completed') {
        updateData.handledBy = user.id
        updateData.handledAt = new Date()
      }
    }
    if (parsed.result !== undefined) {
      updateData.result = parsed.result
    }
    const complaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    })
    return NextResponse.json({ success: true, data: complaint })
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
