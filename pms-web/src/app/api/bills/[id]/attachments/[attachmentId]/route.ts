import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { billAttachmentDir } from '@/lib/bill-attachments'

/** 删除附件不写入 BillActivityLog */

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; attachmentId: string }>
  }
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

    const { id, attachmentId } = await params
    const billId = parseInt(id, 10)
    const attId = parseInt(attachmentId, 10)
    if (isNaN(billId) || isNaN(attId)) {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
    }

    const att = await prisma.billAttachment.findFirst({
      where: { id: attId, billId, companyId: user.companyId },
    })
    if (!att) {
      return NextResponse.json({ success: false, message: '附件不存在' }, { status: 404 })
    }

    const fullPath = join(billAttachmentDir(user.companyId, billId), att.storedName)
    await prisma.billAttachment.delete({ where: { id: att.id } })
    try {
      await unlink(fullPath)
    } catch {
      /* 文件已不存在时忽略 */
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
