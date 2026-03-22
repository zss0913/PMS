import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTenantTokenResponse, tenantLoginInclude } from '@/lib/mp-tenant-token'
import { z } from 'zod'

const schema = z.object({
  tenantUserId: z.number().int().positive(),
})

function jsonWithAuthCookie(body: object, token: string) {
  const res = NextResponse.json(body)
  res.cookies.set('pms_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })
  return res
}

/** 同手机号下切换到另一租客端账号（须已关联至少一个租客主体），无需重新输入密码 */
export async function POST(request: NextRequest) {
  try {
    const meJwt = await getMpAuthUser(request)
    if (!meJwt || meJwt.type !== 'tenant') {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantUserId } = schema.parse(body)

    const current = await prisma.tenantUser.findFirst({
      where: { id: meJwt.id, status: 'active' },
      include: tenantLoginInclude,
    })
    if (!current) {
      return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 })
    }

    if (tenantUserId === current.id) {
      return NextResponse.json(
        { success: false, message: '当前已是该账号' },
        { status: 400 }
      )
    }

    const target = await prisma.tenantUser.findFirst({
      where: {
        id: tenantUserId,
        phone: current.phone,
        status: 'active',
      },
      include: tenantLoginInclude,
    })

    if (!target || target.relations.length === 0) {
      return NextResponse.json(
        { success: false, message: '不可切换到该账号（需已关联租客）' },
        { status: 400 }
      )
    }

    const { token, user } = await buildTenantTokenResponse(target)
    return jsonWithAuthCookie({ success: true, token, user }, token)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
