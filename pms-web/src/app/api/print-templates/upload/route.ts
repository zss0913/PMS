import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB

function sanitizeFileName(name: string): string {
  const n = name.trim() || 'template.docx'
  const lower = n.toLowerCase()
  const base = lower.endsWith('.docx') ? n.slice(0, -5) : n
  return base.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120) + '.docx'
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
      return NextResponse.json({ success: false, message: '请选择 Word 文件' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, message: '文件为空' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, message: '文件大小不能超过 15MB' }, { status: 400 })
    }
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.docx')) {
      return NextResponse.json({ success: false, message: '仅支持 .docx 格式' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const safeName = sanitizeFileName(file.name)
    const storedName = `${randomUUID()}_${safeName}`
    const dir = join(process.cwd(), 'public', 'uploads', 'print-templates', String(user.companyId))
    await mkdir(dir, { recursive: true })
    const fullPath = join(dir, storedName)
    await writeFile(fullPath, buf)

    const templateUrl = `/uploads/print-templates/${user.companyId}/${storedName}`
    return NextResponse.json({
      success: true,
      data: { templateUrl, originalName: file.name },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '上传失败' }, { status: 500 })
  }
}
