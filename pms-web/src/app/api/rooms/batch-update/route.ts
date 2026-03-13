import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const batchUpdateSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1, '请至少选择一个房源'),
  status: z.enum(['空置', '已租', '自用']).optional(),
  leasingStatus: z.enum(['可招商', '不可招商']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号操作' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = batchUpdateSchema.parse(body)

    if (!parsed.status && !parsed.leasingStatus) {
      return NextResponse.json(
        { success: false, message: '请至少指定房源状态或招商状态' },
        { status: 400 }
      )
    }

    const updateData: { status?: string; leasingStatus?: string } = {}
    if (parsed.status) updateData.status = parsed.status
    if (parsed.leasingStatus) updateData.leasingStatus = parsed.leasingStatus

    const updated = await prisma.room.updateMany({
      where: {
        id: { in: parsed.ids },
        companyId: user.companyId,
      },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: { count: updated.count },
      message: `已更新 ${updated.count} 条房源`,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
