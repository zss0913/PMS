import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB（原始二进制大小）

function extFromFileName(name: string): 'png' | 'jpg' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg'
  return null
}

function extFromFile(file: File): 'png' | 'jpg' | null {
  const fromName = extFromFileName(file.name)
  if (fromName) return fromName
  const t = file.type.toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  return null
}

function mimeOkExt(ext: string): boolean {
  return ext === 'png' || ext === 'jpg'
}

function imageExtFromBuffer(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png'
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg'
  }
  return null
}

function mimeOkFile(file: File): boolean {
  if (!file.type) return true
  const t = file.type.toLowerCase()
  return t === 'image/png' || t === 'image/jpeg' || t === 'image/jpg'
}

async function saveWorkOrderImage(
  user: NonNullable<Awaited<ReturnType<typeof getRequestAuthUser>>>,
  buf: Buffer,
  ext: 'png' | 'jpg'
): Promise<string> {
  const storedName = `${randomUUID()}.${ext}`
  const dir = join(process.cwd(), 'public', 'uploads', 'work-orders', String(user.companyId))
  await mkdir(dir, { recursive: true })
  const fullPath = join(dir, storedName)
  await writeFile(fullPath, buf)
  return `/uploads/work-orders/${user.companyId}/${storedName}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }
    if (user.type !== 'employee' && user.type !== 'tenant') {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    const ct = request.headers.get('content-type') || ''
    let buf: Buffer
    let ext: 'png' | 'jpg'

    if (ct.includes('application/json')) {
      const body = (await request.json()) as { fileBase64?: string; fileName?: string }
      const b64 = body?.fileBase64
      if (typeof b64 !== 'string' || !b64.trim()) {
        return NextResponse.json({ success: false, message: '请选择图片文件' }, { status: 400 })
      }
      try {
        buf = Buffer.from(b64.replace(/\s/g, ''), 'base64')
      } catch {
        return NextResponse.json({ success: false, message: '图片数据无效' }, { status: 400 })
      }
      if (buf.length === 0) {
        return NextResponse.json({ success: false, message: '文件为空' }, { status: 400 })
      }
      if (buf.length > MAX_SIZE) {
        return NextResponse.json({ success: false, message: '单张图片不能超过 10MB' }, { status: 400 })
      }
      const fromMagic = imageExtFromBuffer(buf)
      const fromName =
        typeof body.fileName === 'string' ? extFromFileName(body.fileName) : null
      const guessed: 'png' | 'jpg' = fromMagic ?? fromName ?? 'jpg'
      if (!mimeOkExt(guessed)) {
        return NextResponse.json(
          { success: false, message: '仅支持 PNG、JPG、JPEG 格式' },
          { status: 400 }
        )
      }
      ext = guessed
    } else {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ success: false, message: '请选择图片文件' }, { status: 400 })
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, message: '文件为空' }, { status: 400 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ success: false, message: '单张图片不能超过 10MB' }, { status: 400 })
      }

      const extRaw = extFromFile(file)
      if (!extRaw || !mimeOkFile(file)) {
        return NextResponse.json(
          { success: false, message: '仅支持 PNG、JPG、JPEG 格式' },
          { status: 400 }
        )
      }
      ext = extRaw
      buf = Buffer.from(await file.arrayBuffer())
    }

    const url = await saveWorkOrderImage(user, buf, ext)
    return NextResponse.json({
      success: true,
      data: { url },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '上传失败' }, { status: 500 })
  }
}
