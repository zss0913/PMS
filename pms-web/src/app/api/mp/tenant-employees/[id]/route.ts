import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'

const querySchema = z.object({
  tenantId: z.coerce.number().int().positive(),
})

const patchBodySchema = z
  .object({
    tenantId: z.number().int().positive(),
    status: z.enum(['active', 'disabled']).optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.isAdmin !== undefined, {
    message: '请指定 status 或 isAdmin',
  })

/** 更新成员状态（启用/禁用账号）或租客主体内管理员标记 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const { id } = await params
    const tenantUserId = parseInt(id, 10)
    if (isNaN(tenantUserId)) {
      return NextResponse.json({ success: false, message: '无效的用户 ID' }, { status: 400 })
    }

    const body = await request.json()
    const { tenantId, status, isAdmin } = patchBodySchema.parse(body)

    const effective = await resolveEffectiveTenantIds(user)
    if (!effective.includes(tenantId)) {
      return NextResponse.json({ success: false, message: '无权操作该租客主体' }, { status: 403 })
    }

    const admin = (user.relations ?? []).some(
      (r) => r.tenantId === tenantId && r.isAdmin === true
    )
    if (!admin) {
      return NextResponse.json(
        { success: false, message: '仅租客管理员可管理成员' },
        { status: 403 }
      )
    }

    const rel = await prisma.tenantUserRelation.findUnique({
      where: {
        tenantUserId_tenantId: { tenantUserId, tenantId },
      },
      include: { tenantUser: { select: { id: true, companyId: true, status: true } } },
    })
    if (!rel || rel.tenantUser.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '成员不存在' }, { status: 404 })
    }

    if (status !== undefined) {
      if (tenantUserId === user.id && status !== 'active') {
        return NextResponse.json({ success: false, message: '不能禁用本人账号' }, { status: 400 })
      }
      if (rel.isAdmin && status === 'disabled') {
        const adminActive = await prisma.tenantUserRelation.findMany({
          where: { tenantId, isAdmin: true },
          include: { tenantUser: { select: { id: true, status: true } } },
        })
        const otherActiveAdmin = adminActive.some(
          (x) => x.tenantUser.id !== tenantUserId && x.tenantUser.status === 'active'
        )
        if (!otherActiveAdmin) {
          return NextResponse.json(
            { success: false, message: '至少需要保留一名可用的管理员账号' },
            { status: 400 }
          )
        }
      }
      await prisma.tenantUser.update({
        where: { id: tenantUserId },
        data: { status },
      })
    }

    if (isAdmin !== undefined) {
      if (tenantUserId === user.id && !isAdmin) {
        return NextResponse.json({ success: false, message: '不能取消本人的管理员身份' }, { status: 400 })
      }
      if (rel.isAdmin && !isAdmin) {
        const adminCount = await prisma.tenantUserRelation.count({
          where: { tenantId, isAdmin: true },
        })
        if (adminCount <= 1) {
          return NextResponse.json(
            { success: false, message: '至少需要保留一名管理员' },
            { status: 400 }
          )
        }
      }
      await prisma.tenantUserRelation.update({
        where: { id: rel.id },
        data: { isAdmin },
      })
    }

    return NextResponse.json({ success: true, message: '已更新' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message || '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

/** 从指定租客主体移除成员（解除关联），id 为 tenantUserId */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const { id } = await params
    const tenantUserId = parseInt(id, 10)
    if (isNaN(tenantUserId)) {
      return NextResponse.json({ success: false, message: '无效的用户 ID' }, { status: 400 })
    }

    if (tenantUserId === user.id) {
      return NextResponse.json({ success: false, message: '不能移除本人' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const { tenantId } = querySchema.parse({
      tenantId: searchParams.get('tenantId'),
    })

    const effective = await resolveEffectiveTenantIds(user)
    if (!effective.includes(tenantId)) {
      return NextResponse.json({ success: false, message: '无权操作该租客主体' }, { status: 403 })
    }

    const admin = (user.relations ?? []).some(
      (r) => r.tenantId === tenantId && r.isAdmin === true
    )
    if (!admin) {
      return NextResponse.json(
        { success: false, message: '仅租客管理员可移除成员' },
        { status: 403 }
      )
    }

    const rel = await prisma.tenantUserRelation.findUnique({
      where: {
        tenantUserId_tenantId: { tenantUserId, tenantId },
      },
      include: { tenantUser: { select: { companyId: true } } },
    })
    if (!rel || rel.tenantUser.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '成员不存在' }, { status: 404 })
    }

    if (rel.isAdmin) {
      const adminCount = await prisma.tenantUserRelation.count({
        where: { tenantId, isAdmin: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: '至少需要保留一名管理员' },
          { status: 400 }
        )
      }
    }

    await prisma.tenantUserRelation.delete({
      where: { id: rel.id },
    })

    return NextResponse.json({ success: true, message: '已移除' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '请传入 tenantId 查询参数', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
