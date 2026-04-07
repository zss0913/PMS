import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6).max(72),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || (user.type !== 'tenant' && user.type !== 'employee')) {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { oldPassword, newPassword } = schema.parse(body)
    if (oldPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: '新密码不能与旧密码相同' },
        { status: 400 }
      )
    }

    if (user.type === 'tenant') {
      const row = await prisma.tenantUser.findFirst({
        where: { id: user.id, companyId: user.companyId },
      })
      if (!row) {
        return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 })
      }

      const ok = await bcrypt.compare(oldPassword, row.password)
      if (!ok) {
        return NextResponse.json({ success: false, message: '原密码错误' }, { status: 400 })
      }

      const hash = await bcrypt.hash(newPassword, 10)
      await prisma.tenantUser.update({
        where: { id: row.id },
        data: { password: hash },
      })

      return NextResponse.json({ success: true, message: '密码已更新' })
    }

    const row = await prisma.employee.findFirst({
      where: { id: user.id, companyId: user.companyId },
    })
    if (!row) {
      return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 })
    }

    const ok = await bcrypt.compare(oldPassword, row.password)
    if (!ok) {
      return NextResponse.json({ success: false, message: '原密码错误' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.employee.update({
      where: { id: row.id },
      data: { password: hash },
    })

    return NextResponse.json({ success: true, message: '密码已更新' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
