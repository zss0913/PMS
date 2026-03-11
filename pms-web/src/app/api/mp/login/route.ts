import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().min(11).max(20),
  password: z.string().min(6),
  type: z.enum(['tenant', 'employee']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password, type } = schema.parse(body)

    if (type === 'tenant') {
      const tenantUser = await prisma.tenantUser.findUnique({
        where: { phone },
        include: {
          relations: {
            include: { tenant: { select: { id: true, companyName: true } } },
          },
        },
      })
      if (!tenantUser) {
        return NextResponse.json(
          { success: false, message: '账号不存在' },
          { status: 401 }
        )
      }
      if (tenantUser.status !== 'active') {
        return NextResponse.json(
          { success: false, message: '账号已禁用' },
          { status: 401 }
        )
      }
      const ok = await bcrypt.compare(password, tenantUser.password)
      if (!ok) {
        return NextResponse.json(
          { success: false, message: '密码错误' },
          { status: 401 }
        )
      }
      const relations = tenantUser.relations.map((r) => ({
        tenantId: r.tenantId,
        buildingId: r.buildingId,
        isAdmin: r.isAdmin,
      }))
      const token = await createToken({
        id: tenantUser.id,
        phone: tenantUser.phone,
        name: tenantUser.name,
        companyId: tenantUser.companyId,
        type: 'tenant',
        relations,
      })
      return NextResponse.json({
        success: true,
        token,
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
      where: { phone },
      include: { role: true },
    })
    if (!employee) {
      return NextResponse.json(
        { success: false, message: '账号不存在' },
        { status: 401 }
      )
    }
    if (employee.status !== 'active') {
      return NextResponse.json(
        { success: false, message: '账号已禁用' },
        { status: 401 }
      )
    }
    const ok = await bcrypt.compare(password, employee.password)
    if (!ok) {
      return NextResponse.json(
        { success: false, message: '密码错误' },
        { status: 401 }
      )
    }
    const token = await createToken({
      id: employee.id,
      phone: employee.phone,
      name: employee.name,
      companyId: employee.companyId,
      type: 'employee',
      roleId: employee.roleId,
      projectId: employee.projectId,
      departmentId: employee.departmentId,
      dataScope: employee.role?.dataScope ?? 'all',
      isLeader: employee.isLeader,
    })
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: employee.id,
        name: employee.name,
        phone: employee.phone,
        type: 'employee',
        companyId: employee.companyId,
        roleId: employee.roleId,
      },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
