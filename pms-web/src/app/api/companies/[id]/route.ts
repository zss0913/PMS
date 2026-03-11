import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1, '公司名称必填'),
  contact: z.string().min(1, '联系人必填'),
  phone: z.string().min(1, '联系电话必填'),
  address: z.string().optional().nullable(),
  appId: z.string().optional().nullable(),
  appSecret: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: '仅超级管理员可查看公司详情' },
        { status: 403 }
      )
    }
    const { id } = await params
    const companyId = parseInt(id, 10)
    if (isNaN(companyId)) {
      return NextResponse.json({ success: false, message: '无效的公司ID' }, { status: 400 })
    }
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company) {
      return NextResponse.json({ success: false, message: '公司不存在' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        contact: company.contact,
        phone: company.phone,
        address: company.address,
        appId: company.appId,
        appSecret: company.appSecret,
        status: company.status,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: '仅超级管理员可编辑物业公司' },
        { status: 403 }
      )
    }
    const { id } = await params
    const companyId = parseInt(id, 10)
    if (isNaN(companyId)) {
      return NextResponse.json({ success: false, message: '无效的公司ID' }, { status: 400 })
    }
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '公司不存在' }, { status: 404 })
    }
    const body = await request.json()
    const parsed = updateSchema.parse(body)

    await prisma.company.update({
      where: { id: companyId },
      data: {
        name: parsed.name,
        contact: parsed.contact,
        phone: parsed.phone,
        address: parsed.address ?? null,
        appId: parsed.appId ?? null,
        appSecret: parsed.appSecret ?? null,
        status: parsed.status,
      },
    })

    return NextResponse.json({ success: true })
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
