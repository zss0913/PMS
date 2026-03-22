import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  runWorkOrderAdvance,
  workOrderAdvanceBodySchema,
} from '@/lib/work-order-advance'

/** 员工端小程序：工单流程推进（与 /api/work-orders/[id]/advance 同源，走 MP 域名白名单路径） */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'employee' || user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '仅物业员工可操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = workOrderAdvanceBodySchema.parse(body)

    const r = await runWorkOrderAdvance(user, workOrderId, parsed)
    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    return NextResponse.json({ success: true })
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
