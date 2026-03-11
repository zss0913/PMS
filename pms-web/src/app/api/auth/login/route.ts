import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().min(11).max(20),
  password: z.string().min(6),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password } = schema.parse(body)

    // 1. 尝试超级管理员
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { phone },
    })
    if (superAdmin) {
      const ok = await bcrypt.compare(password, superAdmin.password)
      if (!ok) {
        return NextResponse.json(
          { success: false, message: '密码错误' },
          { status: 401 }
        )
      }
      const token = await createToken({
        id: superAdmin.id,
        phone: superAdmin.phone,
        name: superAdmin.name,
        companyId: 0,
        type: 'super_admin',
      })
      const res = NextResponse.json({
        success: true,
        token,
        user: {
          id: superAdmin.id,
          name: superAdmin.name,
          phone: superAdmin.phone,
          type: 'super_admin',
          companyId: 0,
        },
      })
      res.cookies.set('pms_token', token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      return res
    }

    // 2. 尝试物业员工
    const employee = await prisma.employee.findUnique({
      where: { phone },
      include: { role: true },
    })
    if (employee) {
      if (employee.status !== 'active') {
        return NextResponse.json(
          { success: false, message: '账号已禁用，请联系系统管理员' },
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
      const res = NextResponse.json({
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
      res.cookies.set('pms_token', token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      return res
    }

    return NextResponse.json(
      { success: false, message: '账号不存在' },
      { status: 401 }
    )
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
