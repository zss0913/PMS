import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  sendDay: z.number().int().min(1).max(28).optional(),
  sendTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式为 HH:mm').optional(),
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

    let setting = await prisma.autoReminderSetting.findUnique({
      where: { companyId: user.companyId },
    })

    if (!setting) {
      setting = await prisma.autoReminderSetting.create({
        data: {
          companyId: user.companyId,
          isEnabled: false,
          sendDay: 1,
          sendTime: '09:00',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: setting.id,
        isEnabled: setting.isEnabled,
        sendDay: setting.sendDay,
        sendTime: setting.sendTime,
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

export async function PUT(request: NextRequest) {
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
    const parsed = updateSchema.parse(body)

    let setting = await prisma.autoReminderSetting.findUnique({
      where: { companyId: user.companyId },
    })

    if (!setting) {
      setting = await prisma.autoReminderSetting.create({
        data: {
          companyId: user.companyId,
          isEnabled: parsed.isEnabled ?? false,
          sendDay: parsed.sendDay ?? 1,
          sendTime: parsed.sendTime ?? '09:00',
        },
      })
    } else {
      setting = await prisma.autoReminderSetting.update({
        where: { companyId: user.companyId },
        data: {
          ...(parsed.isEnabled !== undefined && { isEnabled: parsed.isEnabled }),
          ...(parsed.sendDay !== undefined && { sendDay: parsed.sendDay }),
          ...(parsed.sendTime !== undefined && { sendTime: parsed.sendTime }),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: setting.id,
        isEnabled: setting.isEnabled,
        sendDay: setting.sendDay,
        sendTime: setting.sendTime,
      },
    })
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
