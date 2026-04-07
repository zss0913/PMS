import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      name: true,
      contact: true,
      phone: true,
      address: true,
    },
  })

  if (!company) {
    return NextResponse.json({ success: false, message: '企业不存在' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      appName: '物业员工端',
      version: '1.0.0',
      companyName: company.name,
      contact: company.contact,
      phone: company.phone,
      address: company.address ?? '',
      aboutText:
        `${company.name} 员工端用于处理工单、巡检、公告与站内通知等物业运营事项。` +
        '具体业务能力以当前物业公司配置与小程序开通范围为准。',
    },
  })
}
