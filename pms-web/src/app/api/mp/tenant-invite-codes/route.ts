import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'

const schema = z.object({
  tenantId: z.number().int().positive(),
  /** 可选，默认 30 天 */
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = randomBytes(12)
  let s = ''
  for (let i = 0; i < 12; i++) s += chars[buf[i]! % chars.length]
  return s
}

export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tenantId, expiresInDays } = schema.parse(body)

    const effective = await resolveEffectiveTenantIds(user)
    if (!effective.includes(tenantId)) {
      return NextResponse.json(
        { success: false, message: '无权为该租客主体生成邀请码' },
        { status: 403 }
      )
    }

    const admin = (user.relations ?? []).some(
      (r) => r.tenantId === tenantId && r.isAdmin === true
    )
    if (!admin) {
      return NextResponse.json(
        { success: false, message: '仅租客管理员可生成邀请码' },
        { status: 403 }
      )
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    const days = expiresInDays ?? 30
    const expiresAt = new Date(Date.now() + days * 86400000)

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = genCode()
      try {
        const row = await prisma.tenantInviteCode.create({
          data: {
            code,
            tenantId,
            companyId: user.companyId,
            createdByTenantUserId: user.id,
            expiresAt,
          },
        })
        return NextResponse.json({
          success: true,
          data: {
            id: row.id,
            code: row.code,
            expiresAt: row.expiresAt?.toISOString() ?? null,
            tenantId: row.tenantId,
          },
        })
      } catch {
        continue
      }
    }

    return NextResponse.json(
      { success: false, message: '生成失败，请稍后重试' },
      { status: 503 }
    )
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
