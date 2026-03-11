import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createSchema = z.object({
  name: z.string().min(1, '楼宇名称必填'),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  manager: z.string().min(1, '负责人必填'),
  phone: z.string().min(1, '联系电话必填'),
  location: z.string().optional().nullable(),
  projectId: z.number().optional().nullable(),
})

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

    const building = await prisma.building.create({
      data: {
        name: parsed.name,
        area: new Decimal(parsed.area),
        manager: parsed.manager,
        phone: parsed.phone,
        location: parsed.location ?? null,
        projectId: parsed.projectId ?? null,
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ success: true, data: building })
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
