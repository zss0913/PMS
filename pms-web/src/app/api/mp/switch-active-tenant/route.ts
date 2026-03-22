import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildTenantTokenResponseForTenantId,
  tenantLoginInclude,
} from '@/lib/mp-tenant-token'
import { z } from 'zod'

const schema = z.object({
  tenantId: z.number().int().positive(),
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

/** 同一租客账号下切换「当前所属租客主体」（收窄 JWT 中的 relations） */
export async function POST(request: NextRequest) {
  try {
    const meJwt = await getMpAuthUser(request)
    if (!meJwt || meJwt.type !== 'tenant') {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId } = schema.parse(body)

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { id: meJwt.id, status: 'active' },
      include: tenantLoginInclude,
    })
    if (!tenantUser) {
      return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 })
    }

    const built = await buildTenantTokenResponseForTenantId(tenantUser, tenantId)
    if (!built) {
      return NextResponse.json(
        { success: false, message: '未关联该租客，无法切换' },
        { status: 400 }
      )
    }

    const { token, user } = built
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
