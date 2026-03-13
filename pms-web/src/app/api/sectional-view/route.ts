import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

async function getBuildingIds(user: AuthUser): Promise<number[] | null> {
  if (user.companyId <= 0) return null
  const dataScope = user.dataScope ?? 'all'
  if (dataScope === 'all') return null

  if (dataScope === 'project' && user.projectId) {
    const ids = await prisma.building.findMany({
      where: { companyId: user.companyId, projectId: user.projectId },
      select: { id: true },
    })
    return ids.map((b) => b.id)
  }

  if (dataScope === 'department' && user.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: user.departmentId },
    })
    if (!dept?.buildingIds) return null
    try {
      const ids = JSON.parse(dept.buildingIds) as number[]
      return ids.length ? ids : null
    } catch {
      return null
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后查看剖面图' },
        { status: 403 }
      )
    }

    const buildingId = request.nextUrl.searchParams.get('buildingId')
    if (!buildingId) {
      return NextResponse.json({ success: false, message: '请指定楼宇ID' }, { status: 400 })
    }
    const bid = parseInt(buildingId, 10)
    if (isNaN(bid)) {
      return NextResponse.json({ success: false, message: '无效的楼宇ID' }, { status: 400 })
    }

    const allowedBuildingIds = await getBuildingIds(user)
    if (allowedBuildingIds && !allowedBuildingIds.includes(bid)) {
      return NextResponse.json({ success: false, message: '无权限查看该楼宇' }, { status: 403 })
    }

    const building = await prisma.building.findFirst({
      where: { id: bid, companyId: user.companyId },
      include: {
        floors: {
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          include: {
            rooms: {
              orderBy: { createdAt: 'asc' },
              include: {
                tenantRooms: {
                  include: {
                    tenant: true,
                  },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    })

    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }

    const now = new Date()
    let totalArea = 0
    let leasedArea = 0
    let leasedCount = 0
    let selfUseArea = 0
    let selfUseCount = 0
    let vacantArea = 0
    let vacantCount = 0

    const floors = building.floors.map((f) => {
      const floorArea = Number(f.area) || f.rooms.reduce((s, r) => s + Number(r.area), 0)
      const rooms = f.rooms.map((r) => {
        const area = Number(r.area)
        totalArea += area
        if (r.status === '已租') {
          leasedArea += area
          leasedCount += 1
        } else if (r.status === '自用') {
          selfUseArea += area
          selfUseCount += 1
        } else {
          vacantArea += area
          vacantCount += 1
        }

        const tenants = r.tenantRooms
          .map((tr) => ({
            id: tr.tenant.id,
            companyName: tr.tenant.companyName,
            type: tr.tenant.type,
            leaseArea: Number(tr.leaseArea),
            leaseStartDate: tr.tenant.leaseStartDate.toISOString().slice(0, 10),
            leaseEndDate: tr.tenant.leaseEndDate.toISOString().slice(0, 10),
            moveInDate: tr.tenant.moveInDate.toISOString(),
          }))
          .sort((a, b) => new Date(b.moveInDate).getTime() - new Date(a.moveInDate).getTime())

        const latestTenant = tenants[0]

        return {
          id: r.id,
          roomNumber: r.roomNumber,
          name: r.name,
          area,
          status: r.status,
          leasingStatus: r.leasingStatus,
          type: r.type,
          tenants,
          latestTenant,
          leaseEndDateForDisplay: latestTenant?.leaseEndDate ?? null,
        }
      })

      return {
        id: f.id,
        name: f.name,
        sort: f.sort,
        area: floorArea,
        rooms,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        building: {
          id: building.id,
          name: building.name,
        },
        summary: {
          totalArea,
          totalCount: floors.reduce((s, f) => s + f.rooms.length, 0),
          leasedArea,
          leasedCount,
          selfUseArea,
          selfUseCount,
          vacantArea,
          vacantCount,
        },
        floors,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
