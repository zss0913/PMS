import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { billAttachmentDir, previewKind } from '@/lib/bill-attachments'

/** 下载/预览附件不写入 BillActivityLog */

export async function GET(
  request: NextRequest,
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
    const buf = await readFile(fullPath)

    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === '1'
    const kind = previewKind(att.mimeType)
    const inline =
      !download && (kind === 'image' || kind === 'pdf' || kind === 'office' || kind === 'other')

    const encoded = encodeURIComponent(att.originalName).replace(/'/g, '%27')
    const disposition = inline
      ? `inline; filename*=UTF-8''${encoded}`
      : `attachment; filename*=UTF-8''${encoded}`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': att.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
