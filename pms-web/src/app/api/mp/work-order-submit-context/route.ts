import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 租客端：报事报修页展示用，楼宇/房源/租客由账号自动解析 */
export async function GET(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const rel = user.relations?.[0]
    if (!rel) {
      return NextResponse.json({
        success: true,
        data: {
          tenantId: null as number | null,
          buildingId: null as number | null,
          roomId: null as number | null,
          tenantName: null as string | null,
          buildingName: null as string | null,
          roomLabel: null as string | null,
        },
      })
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: rel.tenantId, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
      },
    })

    const firstLink = await prisma.tenantRoom.findFirst({
      where: { tenantId: rel.tenantId },
      include: {
        room: { select: { id: true, name: true, roomNumber: true } },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: rel.tenantId,
        buildingId: tenant?.buildingId ?? rel.buildingId,
        roomId: firstLink?.roomId ?? null,
        tenantName: tenant?.companyName ?? null,
        buildingName: tenant?.building?.name ?? null,
        roomLabel: firstLink?.room
          ? `${firstLink.room.roomNumber} · ${firstLink.room.name}`
          : null,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
