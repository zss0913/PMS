import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录' },
      { status: 401 }
    )
  }

  if (user.type === 'tenant') {
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { id: user.id },
      include: {
        relations: true,
      },
    })
    if (!tenantUser) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      )
    }
    const relations = tenantUser.relations.map((r) => ({
      tenantId: r.tenantId,
      buildingId: r.buildingId,
      isAdmin: r.isAdmin,
    }))
    return NextResponse.json({
      success: true,
      user: {
        id: tenantUser.id,
        name: tenantUser.name,
        phone: tenantUser.phone,
        type: 'tenant',
        companyId: tenantUser.companyId,
        relations,
      },
    })
  }

  const employee = await prisma.employee.findUnique({
    where: { id: user.id },
    include: { role: true },
  })
  if (!employee) {
    return NextResponse.json(
      { success: false, message: '用户不存在' },
      { status: 404 }
    )
  }
  return NextResponse.json({
    success: true,
    user: {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      type: 'employee',
      companyId: employee.companyId,
      roleId: employee.roleId,
    },
  })
}
