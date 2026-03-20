import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  isAdmin: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; relationId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号操作' },
        { status: 403 }
      )
    }

    const tenantId = parseInt((await params).id, 10)
    const relationId = parseInt((await params).relationId, 10)
    if (isNaN(tenantId) || isNaN(relationId)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }

    const relation = await prisma.tenantUserRelation.findFirst({
      where: { id: relationId, tenantId },
      include: { tenant: { select: { companyId: true } }, tenantUser: true },
    })
    if (!relation || relation.tenant.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = patchSchema.parse(body)

    if (parsed.isAdmin !== undefined) {
      await prisma.tenantUserRelation.update({
        where: { id: relationId },
        data: { isAdmin: parsed.isAdmin },
      })
    }
    if (parsed.status !== undefined) {
      await prisma.tenantUser.update({
        where: { id: relation.tenantUserId },
        data: { status: parsed.status },
      })
    }

    return NextResponse.json({ success: true })
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
  { params }: { params: Promise<{ id: string; relationId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号操作' },
        { status: 403 }
      )
    }

    const tenantId = parseInt((await params).id, 10)
    const relationId = parseInt((await params).relationId, 10)
    if (isNaN(tenantId) || isNaN(relationId)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }

    const relation = await prisma.tenantUserRelation.findFirst({
      where: { id: relationId, tenantId },
      include: { tenant: { select: { companyId: true } } },
    })
    if (!relation || relation.tenant.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const tenantUserId = relation.tenantUserId

    await prisma.tenantUserRelation.delete({
      where: { id: relationId },
    })

    const remaining = await prisma.tenantUserRelation.count({
      where: { tenantUserId },
    })
    if (remaining === 0) {
      await prisma.tenantUser.delete({ where: { id: tenantUserId } }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
