import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
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
    const ruleId = parseInt(id, 10)
    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, message: '无效的规则ID' },
        { status: 400 }
      )
    }

    const rule = await prisma.billRule.findUnique({
      where: { id: ruleId },
    })
    if (!rule) {
      return NextResponse.json(
        { success: false, message: '规则不存在' },
        { status: 404 }
      )
    }

    if (rule.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该规则' },
        { status: 403 }
      )
    }

    const newStatus = rule.status === 'active' ? 'inactive' : 'active'
    const updated = await prisma.billRule.update({
      where: { id: ruleId },
      data: { status: newStatus },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
