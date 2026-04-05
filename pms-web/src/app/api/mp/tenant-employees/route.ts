import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'

const querySchema = z.object({
  tenantId: z.coerce.number().int().positive().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.parse({
      tenantId: searchParams.get('tenantId') || undefined,
    })

    const effective = await resolveEffectiveTenantIds(user)
    if (effective.length === 0) {
      return NextResponse.json({ success: true, list: [] })
    }

    let tenantId = parsed.tenantId
    if (tenantId == null) {
      if (effective.length !== 1) {
        return NextResponse.json(
          { success: false, message: '请指定 tenantId 查询参数' },
          { status: 400 }
        )
      }
      tenantId = effective[0]!
    }

    if (!effective.includes(tenantId)) {
      return NextResponse.json({ success: false, message: '无权查看该租客主体' }, { status: 403 })
    }

    const admin = (user.relations ?? []).some(
      (r) => r.tenantId === tenantId && r.isAdmin === true
    )
    if (!admin) {
      return NextResponse.json(
        { success: false, message: '仅租客管理员可查看成员列表' },
        { status: 403 }
      )
    }

    const rows = await prisma.tenantUserRelation.findMany({
      where: { tenantId },
      include: {
        tenantUser: {
          select: { id: true, name: true, phone: true, status: true, lastLoginAt: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    const list = rows.map((r) => ({
      relationId: r.id,
      tenantUserId: r.tenantUser.id,
      name: r.tenantUser.name,
      phone: r.tenantUser.phone,
      status: r.tenantUser.status,
      isAdmin: r.isAdmin,
      lastLoginAt: r.tenantUser.lastLoginAt,
    }))

    return NextResponse.json({ success: true, list })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
