import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import * as bcrypt from 'bcryptjs'

const DEFAULT_PASSWORD = '123456'

const addSchema = z.object({
  users: z.array(
    z.object({
      phone: z.string().min(11, '手机号11位'),
      name: z.string().min(1, '姓名必填'),
      password: z.string().min(6).optional(),
    })
  ).min(1, '请至少添加一个员工'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    if (isNaN(tenantId)) {
      return NextResponse.json({ success: false, message: '无效租客ID' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
      select: { id: true, buildingId: true },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')?.trim()
    const phone = searchParams.get('phone')?.trim()
    const isAdmin = searchParams.get('isAdmin')

    const where: Record<string, unknown> = { tenantId }
    if (isAdmin === 'true') where.isAdmin = true
    if (isAdmin === 'false') where.isAdmin = false
    if (name || phone) {
      const tenantUserWhere: Record<string, unknown> = {}
      if (name) tenantUserWhere.name = { contains: name }
      if (phone) tenantUserWhere.phone = { contains: phone }
      where.tenantUser = tenantUserWhere
    }

    const relations = await prisma.tenantUserRelation.findMany({
      where,
      include: {
        tenantUser: {
          select: {
            id: true,
            phone: true,
            name: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const list = relations.map((r) => ({
      id: r.id,
      tenantUserId: r.tenantUserId,
      phone: r.tenantUser.phone,
      name: r.tenantUser.name,
      status: r.tenantUser.status,
      isAdmin: r.isAdmin,
      lastLoginAt: r.tenantUser.lastLoginAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({ success: true, data: list })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    if (isNaN(tenantId)) {
      return NextResponse.json({ success: false, message: '无效租客ID' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
      select: { id: true, buildingId: true },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = addSchema.parse(body)

    const hashedDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    const created: { phone: string; name: string }[] = []
    const errors: string[] = []

    for (const u of parsed.users) {
      try {
        const existingInThisTenant = await prisma.tenantUserRelation.findFirst({
          where: {
            tenantId,
            tenantUser: { phone: u.phone },
          },
        })
        if (existingInThisTenant) {
          errors.push(`${u.phone} 已是该租客员工`)
          continue
        }

        const hash = u.password ? await bcrypt.hash(u.password, 10) : hashedDefault
        const tenantUser = await prisma.tenantUser.create({
          data: {
            phone: u.phone,
            password: hash,
            name: u.name,
            companyId: user.companyId,
            status: 'active',
          },
        })

        await prisma.tenantUserRelation.create({
          data: {
            tenantUserId: tenantUser.id,
            tenantId,
            buildingId: tenant.buildingId,
            isAdmin: false,
          },
        })
        created.push({ phone: u.phone, name: u.name })
      } catch (err) {
        errors.push(`${u.phone}: ${err instanceof Error ? err.message : '添加失败'}`)
      }
    }

    const nothingAdded = created.length === 0 && errors.length > 0
    return NextResponse.json({
      success: !nothingAdded,
      data: { created: created.length, errors },
      message: nothingAdded
        ? errors.join('；')
        : `成功添加 ${created.length} 人${errors.length ? `，${errors.length} 条失败` : ''}`,
    })
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
