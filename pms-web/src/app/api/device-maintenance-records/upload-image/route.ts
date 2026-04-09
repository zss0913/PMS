import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const MAX_IMAGE = 10 * 1024 * 1024

function extFromFileName(name: string): 'png' | 'jpg' | 'webp' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg'
  if (lower.endsWith('.webp')) return 'webp'
  return null
}

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

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: '请选择图片' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_IMAGE) {
      return NextResponse.json({ success: false, message: '图片须小于 10MB' }, { status: 400 })
    }
    const ext = extFromFileName(file.name) || 'jpg'
    if (ext !== 'png' && ext !== 'jpg' && ext !== 'webp') {
      return NextResponse.json({ success: false, message: '仅支持 PNG、JPG、WebP' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const storedName = `${randomUUID()}.${ext}`
    const dir = join(process.cwd(), 'public', 'uploads', 'device-maintenance', String(user.companyId))
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, storedName), buf)
    const url = `/uploads/device-maintenance/${user.companyId}/${storedName}`

    return NextResponse.json({ success: true, data: { url } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '上传失败' }, { status: 500 })
  }
}
