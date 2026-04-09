import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlatformMpSettingsView } from '@/lib/platform-wechat-mp'

const putSchema = z.object({
  tenantAppId: z.string().optional(),
  staffAppId: z.string().optional(),
  tenantAppSecret: z.string().optional(),
  staffAppSecret: z.string().optional(),
  clearTenantAppSecret: z.boolean().optional(),
  clearStaffAppSecret: z.boolean().optional(),
})

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'super_admin') {
      return NextResponse.json({ success: false, message: '仅超级管理员可查看' }, { status: 403 })
    }

    const data = await getPlatformMpSettingsView()
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'super_admin') {
      return NextResponse.json({ success: false, message: '仅超级管理员可保存' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = putSchema.parse(body)

    const existing = await prisma.platformMpSettings.findUnique({ where: { id: 1 } })

    const tenantAppId =
      parsed.tenantAppId !== undefined
        ? parsed.tenantAppId.trim() || null
        : (existing?.tenantAppId ?? null)
    const staffAppId =
      parsed.staffAppId !== undefined
        ? parsed.staffAppId.trim() || null
        : (existing?.staffAppId ?? null)

    let tenantAppSecret = existing?.tenantAppSecret ?? null
    if (parsed.clearTenantAppSecret) {
      tenantAppSecret = null
    } else if (parsed.tenantAppSecret !== undefined && parsed.tenantAppSecret.trim()) {
      tenantAppSecret = parsed.tenantAppSecret.trim()
    }

    let staffAppSecret = existing?.staffAppSecret ?? null
    if (parsed.clearStaffAppSecret) {
      staffAppSecret = null
    } else if (parsed.staffAppSecret !== undefined && parsed.staffAppSecret.trim()) {
      staffAppSecret = parsed.staffAppSecret.trim()
    }

    await prisma.platformMpSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        tenantAppId,
        staffAppId,
        tenantAppSecret,
        staffAppSecret,
      },
      update: {
        tenantAppId,
        staffAppId,
        tenantAppSecret,
        staffAppSecret,
      },
    })

    const data = await getPlatformMpSettingsView()
    return NextResponse.json({ success: true, data })
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
