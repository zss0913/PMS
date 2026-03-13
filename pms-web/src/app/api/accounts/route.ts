import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '账户名称不能为空'),
  bankName: z.string().min(1, '开户行不能为空'),
  accountNumber: z.string().min(1, '银行账号不能为空'),
  accountHolder: z.string().optional(),
})

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

    const accounts = await prisma.account.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
    })

    const list = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      accountHolder: a.accountHolder,
    }))

    return NextResponse.json({ success: true, data: list })
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, message: '请求体格式错误' },
        { status: 400 }
      )
    }
    const parsed = createSchema.parse(body)

    const companyId = Number(user.companyId)
    if (!companyId || companyId <= 0) {
      return NextResponse.json(
        { success: false, message: '无效的公司信息，请使用员工账号登录' },
        { status: 400 }
      )
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company) {
      return NextResponse.json(
        { success: false, message: '所属公司不存在，请重新登录' },
        { status: 400 }
      )
    }

    const created = await prisma.account.create({
      data: {
        name: parsed.name,
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber,
        accountHolder: parsed.accountHolder || null,
        companyId,
      },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error('[accounts POST]', e)
    const msg = e instanceof Error ? e.message : '服务器错误'
    return NextResponse.json(
      { success: false, message: process.env.NODE_ENV === 'development' ? msg : '服务器错误' },
      { status: 500 }
    )
  }
}
