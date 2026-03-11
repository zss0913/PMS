import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(11).optional(),
  password: z.string().min(6).optional(),
  projectId: z.number().nullable().optional(),
  departmentId: z.number().nullable().optional(),
  position: z.enum(['保安', '维修工', '保洁', '管理员', '其他']).optional(),
  isLeader: z.boolean().optional(),
  businessTypes: z.array(z.string()).nullable().optional(),
  roleId: z.number().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }
    const companyId = user.companyId
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '员工不存在' }, { status: 404 })
    }
    if (companyId > 0 && existing.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
    const body = await request.json()
    const parsed = updateSchema.parse(body)
    if (parsed.phone && parsed.phone !== existing.phone) {
      const dup = await prisma.employee.findUnique({ where: { phone: parsed.phone } })
      if (dup) {
        return NextResponse.json({ success: false, message: '该手机号已存在' }, { status: 400 })
      }
    }
    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.phone !== undefined) updateData.phone = parsed.phone
    if (parsed.projectId !== undefined) updateData.projectId = parsed.projectId
    if (parsed.departmentId !== undefined) updateData.departmentId = parsed.departmentId
    if (parsed.position !== undefined) updateData.position = parsed.position
    if (parsed.isLeader !== undefined) updateData.isLeader = parsed.isLeader
    if (parsed.businessTypes !== undefined) {
      updateData.businessTypes = parsed.businessTypes ? JSON.stringify(parsed.businessTypes) : null
    }
    if (parsed.roleId !== undefined) updateData.roleId = parsed.roleId
    if (parsed.password && parsed.password.length >= 6) {
      updateData.password = await bcrypt.hash(parsed.password, 10)
    }
    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }
    const companyId = user.companyId
    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '员工不存在' }, { status: 404 })
    }
    if (companyId > 0 && existing.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
