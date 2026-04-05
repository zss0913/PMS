import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  buildTenantTokenResponseForTenantId,
  tenantLoginInclude,
} from '@/lib/mp-tenant-token'

const schema = z.object({
  code: z.string().min(4).max(64),
  phone: z.string().min(11).max(20),
  password: z.string().min(6),
  name: z.string().max(50).optional(),
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

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code: rawCode, phone, password, name } = schema.parse(body)
    const code = normalizeCode(rawCode)

    const invite = await prisma.tenantInviteCode.findUnique({
      where: { code },
      include: { tenant: { select: { id: true, buildingId: true, companyId: true } } },
    })

    if (!invite || invite.companyId !== invite.tenant.companyId) {
      return NextResponse.json({ success: false, message: '邀请码无效' }, { status: 400 })
    }
    if (invite.usedAt != null) {
      return NextResponse.json({ success: false, message: '邀请码已使用' }, { status: 400 })
    }
    if (invite.expiresAt != null && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, message: '邀请码已过期' }, { status: 400 })
    }

    const tenantId = invite.tenantId
    const companyId = invite.companyId
    const buildingId = invite.tenant.buildingId

    const existing = await prisma.tenantUser.findFirst({
      where: { phone, companyId },
      orderBy: { id: 'desc' },
      include: tenantLoginInclude,
    })

    let tenantUser = existing

    if (tenantUser) {
      const ok = await bcrypt.compare(password, tenantUser.password)
      if (!ok) {
        return NextResponse.json({ success: false, message: '密码错误' }, { status: 401 })
      }
    } else {
      const hash = await bcrypt.hash(password, 10)
      const displayName = (name && name.trim()) || `用户${phone.slice(-4)}`
      tenantUser = await prisma.tenantUser.create({
        data: {
          phone,
          password: hash,
          name: displayName,
          companyId,
          status: 'active',
        },
        include: tenantLoginInclude,
      })
    }

    if (tenantUser.status !== 'active') {
      return NextResponse.json({ success: false, message: '账号已禁用' }, { status: 403 })
    }

    const dup = await prisma.tenantUserRelation.findUnique({
      where: {
        tenantUserId_tenantId: { tenantUserId: tenantUser.id, tenantId },
      },
    })
    if (dup) {
      return NextResponse.json(
        { success: false, message: '您已是该租客主体成员，请直接登录' },
        { status: 400 }
      )
    }

    const claimTime = new Date()
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.tenantInviteCode.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gte: claimTime } }],
        },
        data: {
          usedAt: claimTime,
          usedByTenantUserId: tenantUser!.id,
        },
      })

      if (claimed.count !== 1) {
        throw new Error('邀请码已使用或已过期')
      }

      await tx.tenantUserRelation.create({
        data: {
          tenantUserId: tenantUser!.id,
          tenantId,
          buildingId,
          isAdmin: false,
        },
      })
    })

    const fresh = await prisma.tenantUser.findUnique({
      where: { id: tenantUser.id },
      include: tenantLoginInclude,
    })
    if (!fresh) {
      return NextResponse.json({ success: false, message: '用户数据异常' }, { status: 500 })
    }

    const scoped = await buildTenantTokenResponseForTenantId(fresh, tenantId)
    if (!scoped) {
      return NextResponse.json({ success: false, message: '加入失败，请重试' }, { status: 500 })
    }

    return jsonWithAuthCookie(
      { success: true, token: scoped.token, user: scoped.user },
      scoped.token
    )
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    if (e instanceof Error && e.message === '邀请码已使用或已过期') {
      return NextResponse.json({ success: false, message: e.message }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
