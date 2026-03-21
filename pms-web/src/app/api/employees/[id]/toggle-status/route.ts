import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const { id: rawId } = await params
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }
    const companyId = user.companyId
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '员工不存在' }, { status: 404 })
    }
    if (companyId > 0 && existing.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
    if (existing.id === user.id) {
      return NextResponse.json({ success: false, message: '不能禁用自己' }, { status: 400 })
    }
    const newStatus = existing.status === 'active' ? 'inactive' : 'active'
    const employee = await prisma.employee.update({
      where: { id },
      data: { status: newStatus },
      include: {
        project: { select: { name: true } },
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    })
    return NextResponse.json({ success: true, data: employee })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
