import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  MAX_ATTACHMENTS_PER_BILL,
  DEFAULT_ATTACHMENT_PAGE_SIZE,
  MAX_UPLOAD_BYTES,
  billAttachmentDir,
  isAllowedBillAttachment,
} from '@/lib/bill-attachments'

/** 附件增删改不写入 BillActivityLog，账单操作日志中不出现附件记录 */

function sanitizeBaseName(name: string): string {
  const n = name.trim() || 'file'
  return n.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 180)
}

export async function GET(
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
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
      select: { id: true },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_ATTACHMENT_PAGE_SIZE), 10))
    )

    const total = await prisma.billAttachment.count({
      where: { billId, companyId: user.companyId },
    })

    const rows = await prisma.billAttachment.findMany({
      where: { billId, companyId: user.companyId },
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })

    const list = rows.map((r) => ({
      id: r.id,
      originalName: r.originalName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        list,
        total,
        maxCount: MAX_ATTACHMENTS_PER_BILL,
        page,
        pageSize,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function POST(
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
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
      select: { id: true },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const formData = await request.formData()
    const raw = formData.get('file')
    if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) {
      return NextResponse.json({ success: false, message: '请选择文件' }, { status: 400 })
    }
    const blob = raw as Blob
    const buf = Buffer.from(await blob.arrayBuffer())
    const sizeBytes = buf.length
    if (sizeBytes === 0) {
      return NextResponse.json({ success: false, message: '文件为空' }, { status: 400 })
    }
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, message: '单文件不超过 20MB' }, { status: 400 })
    }

    const originalName =
      raw instanceof File && raw.name ? raw.name : (formData.get('filename') as string) || 'file'
    const mimeType =
      (raw instanceof File && raw.type) || blob.type || 'application/octet-stream'

    const check = isAllowedBillAttachment(mimeType, originalName)
    if (!check.ok) {
      return NextResponse.json({ success: false, message: check.reason ?? '文件类型不允许' }, { status: 400 })
    }

    const count = await prisma.billAttachment.count({
      where: { billId, companyId: user.companyId },
    })
    if (count >= MAX_ATTACHMENTS_PER_BILL) {
      return NextResponse.json(
        { success: false, message: `每个账单最多 ${MAX_ATTACHMENTS_PER_BILL} 个附件` },
        { status: 400 }
      )
    }

    const safeBase = sanitizeBaseName(originalName)
    const extMatch = safeBase.match(/(\.[^.]+)$/)
    const ext = extMatch ? extMatch[1].toLowerCase() : ''
    const storedName = `${randomUUID()}${ext || ''}`
    const dir = billAttachmentDir(user.companyId, billId)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, storedName), buf)

    const row = await prisma.billAttachment.create({
      data: {
        billId,
        companyId: user.companyId,
        originalName,
        storedName,
        mimeType,
        sizeBytes,
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
