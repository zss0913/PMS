import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const HEADERS = [
  '设备编号',
  '设备名称',
  '设备类型',
  '所属楼宇',
  '状态',
  '具体位置',
  '维修联系人',
  '厂家',
  '品牌',
  '投用日期',
] as const

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

    const devices = await prisma.device.findMany({
      where: { companyId: user.companyId },
      include: { building: { select: { name: true } } },
      orderBy: { id: 'asc' },
    })

    if (devices.length === 0) {
      return NextResponse.json(
        { success: false, message: '导出的数据不能为空，请先添加设备台账' },
        { status: 400 }
      )
    }

    const rows = devices.map((d) => [
      d.code,
      d.name,
      d.type,
      d.building.name,
      d.status,
      d.location ?? '',
      d.maintenanceContact ?? '',
      d.supplier ?? '',
      d.brand ?? '',
      d.commissionedDate.toISOString().slice(0, 10),
    ])

    const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '设备台账')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="devices-export.xlsx"; filename*=UTF-8''${encodeURIComponent('设备台账导出.xlsx')}`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
