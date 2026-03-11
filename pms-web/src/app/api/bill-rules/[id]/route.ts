import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const FEE_TYPE_OPTIONS = ['物业费', '水电费', '租金', '其他'] as const

const updateSchema = z.object({
  name: z.string().min(1, '规则名称不能为空').optional(),
  feeType: z.enum(FEE_TYPE_OPTIONS).optional(),
  amount: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  discountRate: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  discountAmount: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  tenantIds: z.array(z.number()).optional(),
  buildingIds: z.array(z.number()).optional(),
  roomIds: z.array(z.number()).optional(),
  periodStartDate: z.string().optional(),
  periodEndDate: z.string().optional(),
  accountId: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const ruleId = parseInt(id, 10)
    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, message: '无效的规则ID' },
        { status: 400 }
      )
    }

    const rule = await prisma.billRule.findUnique({
      where: { id: ruleId },
    })
    if (!rule) {
      return NextResponse.json(
        { success: false, message: '规则不存在' },
        { status: 404 }
      )
    }

    if (rule.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该规则' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    if (parsed.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: parsed.accountId, companyId: user.companyId },
      })
      if (!account) {
        return NextResponse.json(
          { success: false, message: '收款账户不存在' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.feeType !== undefined) updateData.feeType = parsed.feeType
    if (parsed.amount !== undefined) updateData.amount = new Decimal(parsed.amount)
    if (parsed.discountRate !== undefined) updateData.discountRate = new Decimal(parsed.discountRate)
    if (parsed.discountAmount !== undefined) updateData.discountAmount = new Decimal(parsed.discountAmount)
    if (parsed.tenantIds !== undefined) updateData.tenantIds = JSON.stringify(parsed.tenantIds)
    if (parsed.buildingIds !== undefined) updateData.buildingIds = JSON.stringify(parsed.buildingIds)
    if (parsed.roomIds !== undefined) updateData.roomIds = JSON.stringify(parsed.roomIds)
    if (parsed.periodStartDate !== undefined) updateData.periodStartDate = new Date(parsed.periodStartDate)
    if (parsed.periodEndDate !== undefined) updateData.periodEndDate = new Date(parsed.periodEndDate)
    if (parsed.accountId !== undefined) updateData.accountId = parsed.accountId
    if (parsed.status !== undefined) updateData.status = parsed.status

    const updated = await prisma.billRule.update({
      where: { id: ruleId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const ruleId = parseInt(id, 10)
    if (isNaN(ruleId)) {
      return NextResponse.json(
        { success: false, message: '无效的规则ID' },
        { status: 400 }
      )
    }

    const rule = await prisma.billRule.findUnique({
      where: { id: ruleId },
      include: { _count: { select: { bills: true } } },
    })
    if (!rule) {
      return NextResponse.json(
        { success: false, message: '规则不存在' },
        { status: 404 }
      )
    }

    if (rule.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该规则' },
        { status: 403 }
      )
    }

    if (rule._count.bills > 0) {
      return NextResponse.json(
        { success: false, message: `该规则下已有 ${rule._count.bills} 条账单，无法删除` },
        { status: 400 }
      )
    }

    await prisma.billRule.delete({
      where: { id: ruleId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
