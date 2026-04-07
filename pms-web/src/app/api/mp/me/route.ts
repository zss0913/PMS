import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapTenantRelationsForToken } from '@/lib/mp-tenant-token'

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
        relations: {
          include: { tenant: { select: { id: true, companyName: true } } },
        },
      },
    })
    if (!tenantUser) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      )
    }

    const relationOptions = mapTenantRelationsForToken(tenantUser.relations)
    const jwtRels = user.relations ?? []

    let active = relationOptions.filter((row) =>
      jwtRels.some(
        (jr) => jr.tenantId === row.tenantId && jr.buildingId === row.buildingId
      )
    )
    if (active.length === 0) {
      active = relationOptions
    }

    return NextResponse.json({
      success: true,
      user: {
        id: tenantUser.id,
        name: tenantUser.name,
        phone: tenantUser.phone,
        type: 'tenant',
        companyId: tenantUser.companyId,
        relations: active,
      },
      relationOptions,
    })
  }

  const employee = await prisma.employee.findUnique({
    where: { id: user.id },
    include: {
      role: true,
      department: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, contact: true, phone: true, address: true } },
    },
  })
  if (!employee) {
    return NextResponse.json(
      { success: false, message: '用户不存在' },
      { status: 404 }
    )
  }

  const displayName = employee.name +
    (employee.department?.name ? ` (${employee.department.name})` : '')

  return NextResponse.json({
    success: true,
    user: {
      id: employee.id,
      name: employee.name,
      displayName,
      phone: employee.phone,
      type: 'employee',
      companyId: employee.companyId,
      companyName: employee.company?.name ?? '',
      companyContact: employee.company?.contact ?? '',
      companyPhone: employee.company?.phone ?? '',
      companyAddress: employee.company?.address ?? '',
      roleId: employee.roleId,
      roleName: employee.role?.name ?? '',
      projectId: employee.projectId,
      projectName: employee.project?.name ?? '',
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? '',
      position: employee.position,
      isLeader: employee.isLeader,
    },
  })
}
