import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

/**
 * 批量将所选任务的人员设为同一组 userIds（完全覆盖原有人员，与单条 PATCH 语义一致）。
 * Body: { taskIds: number[], userIds: number[] }，userIds 可空表示清空人员。
 */
export async function POST(request: Request) {
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

    const body = (await request.json()) as { taskIds?: unknown; userIds?: unknown }
    if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
      return NextResponse.json({ success: false, message: '请至少选择一条任务' }, { status: 400 })
    }
    if (!Array.isArray(body.userIds)) {
      return NextResponse.json({ success: false, message: 'userIds 须为数组' }, { status: 400 })
    }

    const taskIds = [
      ...new Set(
        body.taskIds
          .map((x) => (typeof x === 'number' ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ]
    if (taskIds.length === 0) {
      return NextResponse.json({ success: false, message: '任务 ID 无效' }, { status: 400 })
    }

    const userIds = [
      ...new Set(
        body.userIds
          .map((x) => (typeof x === 'number' ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ]

    if (userIds.length > 0) {
      const found = await prisma.employee.findMany({
        where: { id: { in: userIds }, companyId: user.companyId },
        select: { id: true },
      })
      if (found.length !== userIds.length) {
        return NextResponse.json(
          { success: false, message: '存在无效或非本公司员工' },
          { status: 400 }
        )
      }
    }

    const existing = await prisma.inspectionTask.findMany({
      where: { id: { in: taskIds }, companyId: user.companyId },
      select: { id: true },
    })
    if (existing.length !== taskIds.length) {
      return NextResponse.json(
        { success: false, message: '部分任务不存在或无权操作' },
        { status: 400 }
      )
    }

    const payload = userIds.length > 0 ? JSON.stringify(userIds) : null

    const result = await prisma.inspectionTask.updateMany({
      where: { id: { in: taskIds }, companyId: user.companyId },
      data: { userIds: payload },
    })

    return NextResponse.json({
      success: true,
      message: `已更新 ${result.count} 条任务的人员`,
      data: { updated: result.count },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
