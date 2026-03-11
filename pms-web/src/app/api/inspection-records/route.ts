import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
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
    const records = await prisma.inspectionRecord.findMany({
      where: { companyId: user.companyId },
      orderBy: { checkedAt: 'desc' },
    })
    const checkedByIds = [...new Set(records.map((r) => r.checkedBy).filter(Boolean))]
    const employees =
      checkedByIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: checkedByIds } },
            select: { id: true, name: true },
          })
        : []
    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e.name]))
    const list = records.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      taskCode: r.taskCode,
      inspectionType: r.inspectionType,
      tagId: r.tagId,
      location: r.location,
      checkedAt: r.checkedAt,
      checkedBy: r.checkedBy,
      checkedByName: employeeMap[r.checkedBy] ?? '-',
      status: r.status,
    }))
    return NextResponse.json({ success: true, data: { list } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
