import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '公司名称必填'),
  contact: z.string().min(1, '联系人必填'),
  phone: z.string().min(1, '联系电话必填'),
  address: z.string().optional().nullable(),
  wechatMchId: z.string().optional().nullable(),
  wechatMchSerialNo: z.string().optional().nullable(),
  wechatApiV3Key: z.string().optional().nullable(),
  wechatPrivateKeyPem: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: '仅超级管理员可新建物业公司' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const parsed = createSchema.parse(body)

    // 检查公司名称是否已存在
    const existing = await prisma.company.findFirst({
      where: { name: parsed.name },
    })
    if (existing) {
      return NextResponse.json({ success: false, message: '公司名称已存在请重新输入' }, { status: 400 })
    }

    const company = await prisma.company.create({
      data: {
        name: parsed.name,
        contact: parsed.contact,
        phone: parsed.phone,
        address: parsed.address ?? null,
        wechatMchId: parsed.wechatMchId ?? null,
        wechatMchSerialNo: parsed.wechatMchSerialNo ?? null,
        wechatApiV3Key: parsed.wechatApiV3Key ?? null,
        wechatPrivateKeyPem: parsed.wechatPrivateKeyPem ?? null,
        status: parsed.status,
      },
    })

    return NextResponse.json({ success: true, data: company })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message || '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
