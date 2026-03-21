import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function extFromFile(file: File): string | null {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg'
  const t = file.type.toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  return null
}

function mimeOk(file: File): boolean {
  if (!file.type) return true
  const t = file.type.toLowerCase()
  return t === 'image/png' || t === 'image/jpeg' || t === 'image/jpg'
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

    const ext = extFromFile(file)
    if (!ext || !mimeOk(file)) {
      return NextResponse.json(
        { success: false, message: '仅支持 PNG、JPG、JPEG 格式' },
        { status: 400 }
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const storedName = `${randomUUID()}.${ext}`
    const dir = join(process.cwd(), 'public', 'uploads', 'work-orders', String(user.companyId))
    await mkdir(dir, { recursive: true })
    const fullPath = join(dir, storedName)
    await writeFile(fullPath, buf)

    const url = `/uploads/work-orders/${user.companyId}/${storedName}`
    return NextResponse.json({
      success: true,
      data: { url, originalName: file.name },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '上传失败' }, { status: 500 })
  }
}
