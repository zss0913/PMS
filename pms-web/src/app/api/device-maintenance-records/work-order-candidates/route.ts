import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 维保表单：搜索可选工单；默认可选列表不含已被其他维保占用的工单，includeTaken=1 时一并返回并带标识 */
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
    const q = (searchParams.get('q') ?? '').trim()
    const recordIdRaw = searchParams.get('recordId')
    const includeTaken = searchParams.get('includeTaken') === '1'
    const recordId =
      recordIdRaw && recordIdRaw.trim() !== ''
        ? parseInt(recordIdRaw, 10)
        : Number.NaN
    const editingId = Number.isFinite(recordId) ? recordId : null

    const whereBase = {
      companyId: user.companyId,
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { title: { contains: q } },
              { type: { contains: q } },
            ],
          }
        : {}),
    }

    const rows = await prisma.workOrder.findMany({
      where: whereBase,
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        status: true,
        deviceMaintenanceRecordId: true,
        deviceMaintenanceRecord: { select: { id: true, code: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    })

    const mapped = rows.map((wo) => {
      const linkedRid = wo.deviceMaintenanceRecordId
      const selectable =
        linkedRid == null || (editingId != null && linkedRid === editingId)
      return {
        id: wo.id,
        code: wo.code,
        title: wo.title,
        type: wo.type,
        status: wo.status,
        selectable,
        linkedMaintenanceId:
          !selectable && wo.deviceMaintenanceRecord ? wo.deviceMaintenanceRecord.id : null,
        linkedMaintenanceCode:
          !selectable && wo.deviceMaintenanceRecord ? wo.deviceMaintenanceRecord.code : null,
      }
    })

    const results = includeTaken ? mapped : mapped.filter((r) => r.selectable)

    return NextResponse.json({ success: true, data: { results } })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
