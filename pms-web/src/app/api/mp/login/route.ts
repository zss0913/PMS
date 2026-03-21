import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().min(11).max(20),
  password: z.string().min(6),
  type: z.enum(['tenant', 'employee']),
  /** 物业公司；未传且手机号跨公司时需先选公司 */
  companyId: z.number().int().positive().optional(),
  /** 同一手机号在同一公司下有多条租客账号时需指定 */
  tenantUserId: z.number().int().positive().optional(),
})

const tenantLoginInclude = {
  relations: {
    include: { tenant: { select: { id: true, companyName: true } } },
  },
  company: { select: { id: true, name: true } },
} satisfies Prisma.TenantUserInclude

type TenantUserWithLogin = Prisma.TenantUserGetPayload<{ include: typeof tenantLoginInclude }>

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

async function buildTenantTokenResponse(tenantUser: TenantUserWithLogin) {
  const relations = tenantUser.relations.map((r) => ({
    tenantId: r.tenantId,
    buildingId: r.buildingId,
    isAdmin: r.isAdmin,
  }))
  const token = await createToken({
    id: tenantUser.id,
    phone: tenantUser.phone,
    name: tenantUser.name,
    companyId: tenantUser.companyId,
    type: 'tenant',
    relations,
  })
  return {
    token,
    user: {
      id: tenantUser.id,
      name: tenantUser.name,
      phone: tenantUser.phone,
      type: 'tenant' as const,
      companyId: tenantUser.companyId,
      relations,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password, type, companyId: loginCompanyId, tenantUserId: loginTenantUserId } =
      schema.parse(body)

    if (type === 'tenant') {
      let tenantUser: TenantUserWithLogin | null = null

      if (loginTenantUserId) {
        const u = await prisma.tenantUser.findFirst({
          where: {
            id: loginTenantUserId,
            phone,
            ...(loginCompanyId ? { companyId: loginCompanyId } : {}),
          },
          include: tenantLoginInclude,
        })
        if (!u || !(await bcrypt.compare(password, u.password))) {
          return NextResponse.json(
            { success: false, message: '账号或密码错误' },
            { status: 401 }
          )
        }
        tenantUser = u
      } else {
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
        if (matches.length === 1) {
          tenantUser = matches[0]
        } else {
          return NextResponse.json(
            {
              success: false,
              message: '该手机号存在多个租客账号，请选择一个',
              needTenantUser: true,
              tenantUsers: matches.map((u) => ({
                id: u.id,
                name: u.name,
                companyId: u.companyId,
                companyName: u.company.name,
                tenants: u.relations.map((r) => ({
                  tenantId: r.tenantId,
                  companyName: r.tenant.companyName,
                })),
              })),
            },
            { status: 400 }
          )
        }
      }

      if (!tenantUser) {
        return NextResponse.json(
          { success: false, message: '账号不存在' },
          { status: 401 }
        )
      }
      if (tenantUser.status !== 'active') {
        return NextResponse.json(
          { success: false, message: '账号已禁用' },
          { status: 401 }
        )
      }

      const { token, user } = await buildTenantTokenResponse(tenantUser)
      return jsonWithAuthCookie({ success: true, token, user }, token)
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
