import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

const PAGE_SIZES = new Set([15, 30, 50, 100])

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用物业公司员工账号查看租客账号' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.trim()
    const accountName = searchParams.get('accountName')?.trim()
    const tenantName = searchParams.get('tenantName')?.trim()

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const rawSize = parseInt(searchParams.get('pageSize') ?? '15', 10)
    const pageSize = PAGE_SIZES.has(rawSize) ? rawSize : 15
    const skip = (page - 1) * pageSize

    const tenantUserWhere: Prisma.TenantUserWhereInput = {
      companyId: user.companyId,
    }
    if (phone) tenantUserWhere.phone = { contains: phone }
    if (accountName) tenantUserWhere.name = { contains: accountName }

    const tenantWhere: Prisma.TenantWhereInput = {
      companyId: user.companyId,
    }
    if (tenantName) tenantWhere.companyName = { contains: tenantName }

    const where: Prisma.TenantUserRelationWhereInput = {
      tenantUser: tenantUserWhere,
      tenant: tenantWhere,
    }

    const [total, rows] = await prisma.$transaction([
      prisma.tenantUserRelation.count({ where }),
      prisma.tenantUserRelation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ tenantUser: { createdAt: 'desc' } }, { id: 'desc' }],
        include: {
          tenantUser: {
            select: {
              id: true,
              phone: true,
              name: true,
              status: true,
              createdAt: true,
            },
          },
          tenant: {
            select: {
              id: true,
              companyName: true,
              building: { select: { name: true } },
            },
          },
        },
      }),
    ])

    const list = rows.map((r) => ({
      relationId: r.id,
      tenantId: r.tenantId,
      tenantUserId: r.tenantUserId,
      tenantName: r.tenant.companyName,
      buildingName: r.tenant.building?.name ?? '-',
      name: r.tenantUser.name,
      phone: r.tenantUser.phone,
      status: r.tenantUser.status,
      isAdmin: r.isAdmin,
      createdAt: r.tenantUser.createdAt.toISOString(),
      relationCreatedAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, total, page, pageSize },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
