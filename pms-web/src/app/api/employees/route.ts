import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  phone: z.string().min(11, '请输入正确手机号'),
  password: z.string().min(6, '密码至少6位'),
  projectId: z.number().nullable().optional(),
  departmentId: z.number().nullable().optional(),
  position: z.enum(['保安', '维修工', '保洁', '管理员', '其他']),
  isLeader: z.boolean().optional(),
  businessTypes: z.array(z.string()).optional(),
  roleId: z.number(),
  companyId: z.number().optional(), // 超级管理员创建时必传
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const companyId = user.companyId
    const where = companyId > 0 ? { companyId } : {}
    const employees = await prisma.employee.findMany({
      where,
      include: {
        project: { select: { name: true } },
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    })
    return NextResponse.json({ success: true, data: employees })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const body = await request.json()
    const parsed = createSchema.parse(body)
    let companyId = user.companyId
    if (companyId <= 0) {
      if (parsed.companyId && parsed.companyId > 0) {
        companyId = parsed.companyId
      } else {
        return NextResponse.json({ success: false, message: '超级管理员创建员工需指定公司' }, { status: 400 })
      }
    }
    const existing = await prisma.employee.findUnique({ where: { phone: parsed.phone } })
    if (existing) {
      return NextResponse.json({ success: false, message: '该手机号已存在' }, { status: 400 })
    }
    const hashedPassword = await bcrypt.hash(parsed.password, 10)
    const employee = await prisma.employee.create({
      data: {
        name: parsed.name,
        phone: parsed.phone,
        password: hashedPassword,
        projectId: parsed.projectId ?? null,
        departmentId: parsed.departmentId ?? null,
        position: parsed.position,
        isLeader: parsed.isLeader ?? false,
        businessTypes: parsed.businessTypes ? JSON.stringify(parsed.businessTypes) : null,
        roleId: parsed.roleId,
        companyId,
        status: 'active',
      },
      include: {
        project: { select: { name: true } },
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    })
    return NextResponse.json({ success: true, data: employee })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
