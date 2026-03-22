import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import {
  buildTenantTokenResponse,
  buildTenantTokenResponseForTenantId,
  tenantLoginInclude,
  type TenantUserWithLogin,
} from '@/lib/mp-tenant-token'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().min(11).max(20),
  password: z.string().min(6),
  type: z.enum(['tenant', 'employee']),
  /** 物业公司；未传且手机号跨公司时需先选公司 */
  companyId: z.number().int().positive().optional(),
  /** 多租客账号时优先使用该账号（与上次登录偏好一致）；无效时按最新创建账号登录 */
  tenantUserId: z.number().int().positive().optional(),
  /** 登录后默认进入的租客主体（须为该账号已关联的 tenantId） */
  activeTenantId: z.number().int().positive().optional(),
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

function pickTenantUserFromMatches(
  matches: TenantUserWithLogin[],
  preferredId?: number | null
): TenantUserWithLogin {
  if (preferredId != null && preferredId > 0) {
    const hit = matches.find((u) => u.id === preferredId)
    if (hit) return hit
  }
  const sorted = [...matches].sort((a, b) => {
    const d = b.createdAt.getTime() - a.createdAt.getTime()
    if (d !== 0) return d
    return b.id - a.id
  })
  return sorted[0]!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      phone,
      password,
      type,
      companyId: loginCompanyId,
      tenantUserId: loginTenantUserId,
      activeTenantId: loginActiveTenantId,
    } = schema.parse(body)

    if (type === 'tenant') {
      let list: TenantUserWithLogin[]
      if (loginCompanyId) {
        list = await prisma.tenantUser.findMany({
          where: { phone, companyId: loginCompanyId },
          include: tenantLoginInclude,
        })
      } else {
        list = await prisma.tenantUser.findMany({
          where: { phone },
          include: tenantLoginInclude,
        })
        const companyIds = [...new Set(list.map((x) => x.companyId))]
        if (companyIds.length > 1) {
          const byCompany = new Map<number, { companyId: number; companyName: string }>()
          for (const u of list) {
            if (!byCompany.has(u.companyId)) {
              byCompany.set(u.companyId, {
                companyId: u.companyId,
                companyName: u.company.name,
              })
            }
          }
          return NextResponse.json(
            {
              success: false,
              message: '该手机号在多个物业公司下存在账号，请选择要登录的公司',
              needCompany: true,
              companies: [...byCompany.values()],
            },
            { status: 400 }
          )
        }
      }

      if (list.length === 0) {
        return NextResponse.json(
          { success: false, message: '账号不存在' },
          { status: 401 }
        )
      }

      const matches: TenantUserWithLogin[] = []
      for (const u of list) {
        if (await bcrypt.compare(password, u.password)) matches.push(u)
      }
      if (matches.length === 0) {
        return NextResponse.json(
          { success: false, message: '密码错误' },
          { status: 401 }
        )
      }

      const tenantUser = pickTenantUserFromMatches(matches, loginTenantUserId)

      if (tenantUser.status !== 'active') {
        return NextResponse.json(
          { success: false, message: '账号已禁用' },
          { status: 401 }
        )
      }

      let out = await buildTenantTokenResponse(tenantUser)
      if (loginActiveTenantId != null && loginActiveTenantId > 0) {
        const scoped = await buildTenantTokenResponseForTenantId(
          tenantUser,
          loginActiveTenantId
        )
        if (scoped) out = scoped
      }
      return jsonWithAuthCookie({ success: true, token: out.token, user: out.user }, out.token)
    }

    const employee = await prisma.employee.findUnique({
      where: { phone },
      include: { role: true },
    })
    if (!employee) {
      return NextResponse.json(
        { success: false, message: '账号不存在' },
        { status: 401 }
      )
    }
    if (employee.status !== 'active') {
      return NextResponse.json(
        { success: false, message: '账号已禁用' },
        { status: 401 }
      )
    }
    const ok = await bcrypt.compare(password, employee.password)
    if (!ok) {
      return NextResponse.json(
        { success: false, message: '密码错误' },
        { status: 401 }
      )
    }
    const token = await createToken({
      id: employee.id,
      phone: employee.phone,
      name: employee.name,
      companyId: employee.companyId,
      type: 'employee',
      roleId: employee.roleId,
      projectId: employee.projectId,
      departmentId: employee.departmentId,
      dataScope: employee.role?.dataScope ?? 'all',
      isLeader: employee.isLeader,
    })
    return jsonWithAuthCookie(
      {
        success: true,
        token,
        user: {
          id: employee.id,
          name: employee.name,
          phone: employee.phone,
          type: 'employee',
          companyId: employee.companyId,
          roleId: employee.roleId,
        },
      },
      token
    )
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
