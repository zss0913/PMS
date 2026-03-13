import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1, '账户名称不能为空').optional(),
  bankName: z.string().min(1, '开户行不能为空').optional(),
  accountNumber: z.string().min(1, '银行账号不能为空').optional(),
  accountHolder: z.string().optional(),
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
    const accountId = parseInt(id, 10)
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.account.findFirst({
      where: { id: accountId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '收款账户不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updated = await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.bankName !== undefined && { bankName: parsed.bankName }),
        ...(parsed.accountNumber !== undefined && { accountNumber: parsed.accountNumber }),
        ...(parsed.accountHolder !== undefined && { accountHolder: parsed.accountHolder || null }),
      },
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
    const accountId = parseInt(id, 10)
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.account.findFirst({
      where: { id: accountId, companyId: user.companyId },
      include: {
        _count: {
          select: { billRules: true, bills: true },
        },
      },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '收款账户不存在' },
        { status: 404 }
      )
    }

    const totalRefs = existing._count.billRules + existing._count.bills
    if (totalRefs > 0) {
      return NextResponse.json(
        { success: false, message: `该账户已被 ${totalRefs} 处引用，无法删除` },
        { status: 400 }
      )
    }

    await prisma.account.delete({ where: { id: accountId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
