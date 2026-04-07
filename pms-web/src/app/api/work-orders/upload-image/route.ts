import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const MAX_IMAGE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO = 50 * 1024 * 1024 // 50MB（卫生吐槽/工单附件短视频）

type MediaExt = 'png' | 'jpg' | 'mp4'

function extFromFileName(name: string): MediaExt | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg'
  if (lower.endsWith('.mp4')) return 'mp4'
  return null
}

function extFromFile(file: File): MediaExt | null {
  const fromName = extFromFileName(file.name)
  if (fromName) return fromName
  const t = file.type.toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  if (t === 'video/mp4' || t === 'video/quicktime') return 'mp4'
  return null
}

function mimeOkExt(ext: string): boolean {
  return ext === 'png' || ext === 'jpg' || ext === 'mp4'
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

function mp4Magic(buf: Buffer): boolean {
  return buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp'
}

function mimeOkFile(file: File): boolean {
  if (!file.type) return true
  const t = file.type.toLowerCase()
  return (
    t === 'image/png' ||
    t === 'image/jpeg' ||
    t === 'image/jpg' ||
    t === 'video/mp4' ||
    t === 'video/quicktime'
  )
}

async function saveWorkOrderImage(
  user: NonNullable<Awaited<ReturnType<typeof getRequestAuthUser>>>,
  buf: Buffer,
  ext: MediaExt
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
    let ext: MediaExt

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
      const fromMagic = imageExtFromBuffer(buf)
      const fromMp4 = mp4Magic(buf) ? ('mp4' as const) : null
      const fromName =
        typeof body.fileName === 'string' ? extFromFileName(body.fileName) : null
      const guessed: MediaExt = (fromName as MediaExt) ?? fromMagic ?? fromMp4 ?? 'jpg'
      if (!mimeOkExt(guessed)) {
        return NextResponse.json(
          { success: false, message: '仅支持 PNG、JPG、JPEG、MP4 格式' },
          { status: 400 }
        )
      }
      ext = guessed
      const maxSz = ext === 'mp4' ? MAX_VIDEO : MAX_IMAGE
      if (buf.length > maxSz) {
        return NextResponse.json(
          {
            success: false,
            message: ext === 'mp4' ? '单个视频不能超过 50MB' : '单张图片不能超过 10MB',
          },
          { status: 400 }
        )
      }
    } else {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ success: false, message: '请选择图片文件' }, { status: 400 })
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, message: '文件为空' }, { status: 400 })
      }

      const extRaw = extFromFile(file)
      if (!extRaw || !mimeOkFile(file)) {
        return NextResponse.json(
          { success: false, message: '仅支持 PNG、JPG、JPEG、MP4 格式' },
          { status: 400 }
        )
      }
      ext = extRaw
      const maxSz = ext === 'mp4' ? MAX_VIDEO : MAX_IMAGE
      if (file.size > maxSz) {
        return NextResponse.json(
          {
            success: false,
            message: ext === 'mp4' ? '单个视频不能超过 50MB' : '单张图片不能超过 10MB',
          },
          { status: 400 }
        )
      }
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
