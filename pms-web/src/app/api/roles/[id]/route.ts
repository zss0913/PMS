import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { COMPANY_ADMIN_ROLE_CODE } from '@/lib/menu-config'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1, '角色名称不能为空').optional(),
  code: z.string().min(1, '角色编码不能为空').optional(),
  dataScope: z.enum(['all', 'project', 'department', 'self']).optional(),
  menuIds: z.array(z.number()).optional(),
  buttonPermissionKeys: z.array(z.string()).nullable().optional(),
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

    const { id } = await params
    const roleId = parseInt(id, 10)
    if (isNaN(roleId)) {
      return NextResponse.json(
        { success: false, message: '无效的角色ID' },
        { status: 400 }
      )
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
    })
    if (!role) {
      return NextResponse.json(
        { success: false, message: '角色不存在' },
        { status: 404 }
      )
    }

    if (user.companyId > 0 && role.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该角色' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    if (parsed.code && parsed.code !== role.code) {
      const codeExists = await prisma.role.findFirst({
        where: { code: parsed.code, companyId: role.companyId },
      })
      if (codeExists) {
        return NextResponse.json(
          { success: false, message: '该公司下角色编码已存在' },
          { status: 400 }
        )
      }
    }

    const isCompanyAdmin = role.code === COMPANY_ADMIN_ROLE_CODE
    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.code && { code: parsed.code }),
        ...(parsed.dataScope && { dataScope: parsed.dataScope }),
        ...(!isCompanyAdmin &&
          parsed.menuIds !== undefined && {
            menuIds: JSON.stringify(parsed.menuIds),
          }),
        ...(!isCompanyAdmin &&
          parsed.buttonPermissionKeys !== undefined && {
            buttonPermissionKeys:
              parsed.buttonPermissionKeys === null
                ? null
                : JSON.stringify(parsed.buttonPermissionKeys),
          }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const roleId = parseInt(id, 10)
    if (isNaN(roleId)) {
      return NextResponse.json(
        { success: false, message: '无效的角色ID' },
        { status: 400 }
      )
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { employees: true } } },
    })
    if (!role) {
      return NextResponse.json(
        { success: false, message: '角色不存在' },
        { status: 404 }
      )
    }

    if (user.companyId > 0 && role.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该角色' },
        { status: 403 }
      )
    }

    if (role._count.employees > 0) {
      return NextResponse.json(
        { success: false, message: `该角色下有 ${role._count.employees} 个员工，无法删除` },
        { status: 400 }
      )
    }

    await prisma.role.delete({
      where: { id: roleId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
