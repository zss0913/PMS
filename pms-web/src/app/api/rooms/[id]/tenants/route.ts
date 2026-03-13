import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
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

    const roomId = parseInt((await params).id, 10)
    if (isNaN(roomId)) {
      return NextResponse.json({ success: false, message: '无效房源ID' }, { status: 400 })
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true } },
      },
    })
    if (!room) {
      return NextResponse.json({ success: false, message: '房源不存在' }, { status: 404 })
    }

    const tenantRooms = await prisma.tenantRoom.findMany({
      where: { roomId },
      include: {
        tenant: {
          include: {
            building: { select: { id: true, name: true } },
            tenantRooms: {
              include: { room: { select: { id: true, name: true, roomNumber: true } } },
            },
            _count: { select: { tenantUsers: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const tenants = tenantRooms.map((tr) => ({
      id: tr.tenant.id,
      type: tr.tenant.type,
      companyName: tr.tenant.companyName,
      buildingId: tr.tenant.buildingId,
      building: tr.tenant.building,
      roomNumbers: tr.tenant.tenantRooms.map((r) => r.room.roomNumber).join(', '),
      totalArea: Number(tr.tenant.totalArea),
      leaseArea: Number(tr.leaseArea),
      moveInDate: tr.tenant.moveInDate.toISOString().slice(0, 10),
      leaseStartDate: tr.tenant.leaseStartDate.toISOString().slice(0, 10),
      leaseEndDate: tr.tenant.leaseEndDate.toISOString().slice(0, 10),
      employeeCount: tr.tenant._count.tenantUsers,
      createdAt: tr.tenant.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        room: {
          id: room.id,
          name: room.name,
          roomNumber: room.roomNumber,
          area: Number(room.area),
          building: room.building,
          floor: room.floor,
        },
        tenants,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
