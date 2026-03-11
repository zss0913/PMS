import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const FEE_TYPE_OPTIONS = ['物业费', '水电费', '租金', '其他'] as const

const createSchema = z.object({
  name: z.string().min(1, '规则名称不能为空'),
  code: z.string().optional(),
  feeType: z.enum(FEE_TYPE_OPTIONS),
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  discountRate: z.union([z.number(), z.string()]).optional().transform((v) => Number(v ?? 0)),
  discountAmount: z.union([z.number(), z.string()]).optional().transform((v) => Number(v ?? 0)),
  tenantIds: z.array(z.number()).optional().default([]),
  buildingIds: z.array(z.number()).optional().default([]),
  roomIds: z.array(z.number()).optional().default([]),
  periodStartDate: z.string().min(1, '账期开始日期必填'),
  periodEndDate: z.string().min(1, '账期结束日期必填'),
  accountId: z.number().int().min(1, '请选择收款账户'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const rules = await prisma.billRule.findMany({
      where: { companyId: user.companyId },
      include: {
        account: { select: { id: true, name: true, bankName: true, accountNumber: true } },
      },
      orderBy: { id: 'desc' },
    })

    const tenants = await prisma.tenant.findMany({
      where: { companyId: user.companyId },
      select: { id: true, companyName: true },
      orderBy: { id: 'asc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const rooms = await prisma.room.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, roomNumber: true, buildingId: true },
      orderBy: { id: 'asc' },
    })

    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, bankName: true, accountNumber: true },
      orderBy: { id: 'asc' },
    })

    const list = rules.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      feeType: r.feeType,
      amount: Number(r.amount),
      discountRate: Number(r.discountRate),
      discountAmount: Number(r.discountAmount),
      tenantIds: parseJsonIds(r.tenantIds),
      buildingIds: parseJsonIds(r.buildingIds),
      roomIds: parseJsonIds(r.roomIds),
      periodStartDate: r.periodStartDate.toISOString().slice(0, 10),
      periodEndDate: r.periodEndDate.toISOString().slice(0, 10),
      accountId: r.accountId,
      account: r.account,
      status: r.status,
      companyId: r.companyId,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        list,
        tenants,
        buildings,
        rooms,
        accounts,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createSchema.parse(body)

    let code = parsed.code?.trim()
    if (!code) {
      const count = await prisma.billRule.count({ where: { companyId: user.companyId } })
      code = `BR${String(count + 1).padStart(4, '0')}`
    }
    const codeExists = await prisma.billRule.findFirst({
      where: { code, companyId: user.companyId },
    })
    if (codeExists) {
      return NextResponse.json(
        { success: false, message: '规则编号已存在' },
        { status: 400 }
      )
    }

    const account = await prisma.account.findFirst({
      where: { id: parsed.accountId, companyId: user.companyId },
    })
    if (!account) {
      return NextResponse.json(
        { success: false, message: '收款账户不存在' },
        { status: 400 }
      )
    }

    const rule = await prisma.billRule.create({
      data: {
        name: parsed.name,
        code,
        feeType: parsed.feeType,
        amount: new Decimal(parsed.amount),
        discountRate: new Decimal(parsed.discountRate ?? 0),
        discountAmount: new Decimal(parsed.discountAmount ?? 0),
        tenantIds: JSON.stringify(parsed.tenantIds ?? []),
        buildingIds: JSON.stringify(parsed.buildingIds ?? []),
        roomIds: JSON.stringify(parsed.roomIds ?? []),
        periodStartDate: new Date(parsed.periodStartDate),
        periodEndDate: new Date(parsed.periodEndDate),
        accountId: parsed.accountId,
        companyId: user.companyId,
        status: parsed.status ?? 'active',
      },
    })

    return NextResponse.json({ success: true, data: rule })
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
