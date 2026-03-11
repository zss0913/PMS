import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim() || undefined

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (status) {
      where.status = status
    }

    const tasks = await prisma.inspectionTask.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    })

    const employeeIds = new Set<number>()
    tasks.forEach((t) => {
      if (t.userIds) {
        try {
          const ids = JSON.parse(t.userIds) as number[]
          ids.forEach((id) => employeeIds.add(id))
        } catch {
          // ignore
        }
      }
    })

    const employees =
      employeeIds.size > 0
        ? await prisma.employee.findMany({
            where: { id: { in: Array.from(employeeIds) }, companyId: user.companyId },
            select: { id: true, name: true },
          })
        : []

    const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]))

    const list = tasks.map((t) => {
      let personnelNames = '-'
      if (t.userIds) {
        try {
          const ids = JSON.parse(t.userIds) as number[]
          personnelNames = ids.map((id) => empMap[id] ?? '').filter(Boolean).join('、') || '-'
        } catch {
          // ignore
        }
      }
      return {
        id: t.id,
        code: t.code,
        planName: t.plan?.name ?? t.planName,
        inspectionType: t.inspectionType,
        scheduledDate: t.scheduledDate.toISOString(),
        status: t.status,
        personnelNames,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        list,
        statusOptions: ['待执行', '执行中', '已完成', '已逾期'],
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
