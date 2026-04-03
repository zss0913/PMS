import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  applyComplaintStaffAction,
  type ComplaintStaffActionBody,
} from '@/lib/complaint-process'

const updateSchema = z.object({
  status: z.string().optional(),
  assignedTo: z.number().int().positive().optional(),
  result: z.string().optional(),
  resultImages: z.array(z.string()).max(12).optional(),
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
    if (user.companyId === 0 || user.type !== 'employee') {
      return NextResponse.json(
        { success: false, message: '请使用物业公司员工账号操作' },
        { status: 403 }
      )
    }
    const { id } = await params
    const complaintId = parseInt(id, 10)
    if (Number.isNaN(complaintId)) {
      return NextResponse.json({ success: false, message: '无效的投诉ID' }, { status: 400 })
    }

    let body: ComplaintStaffActionBody
    try {
      body = updateSchema.parse(await request.json())
    } catch {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
    }

    const r = await applyComplaintStaffAction(prisma, {
      complaintId,
      companyId: user.companyId,
      actorEmployeeId: user.id,
      body,
    })

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.message },
        { status: r.status ?? 400 }
      )
    }

    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, companyId: user.companyId },
    })
    return NextResponse.json({ success: true, data: complaint })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
