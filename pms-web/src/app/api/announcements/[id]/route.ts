import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  title: z.string().min(1, '标题不能为空').optional(),
  content: z.string().optional(),
  images: z.string().optional().nullable(),
  scope: z.enum(['all', 'specified']).optional(),
  buildingIds: z.array(z.number()).optional(),
  status: z.enum(['draft', 'published', 'offline']).optional(),
})

function normalizeStatus(
  s: string
): 'draft' | 'published' | 'offline' {
  if (s === 'published' || s === '已发布') return 'published'
  if (s === 'offline' || s === '已下架') return 'offline'
  return 'draft'
}

export async function PUT(
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
    const announcementId = parseInt(id, 10)
    if (isNaN(announcementId)) {
      return NextResponse.json(
        { success: false, message: '无效的公告ID' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
    })
    if (!announcement) {
      return NextResponse.json(
        { success: false, message: '公告不存在' },
        { status: 404 }
      )
    }

    if (announcement.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该公告' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)
    const currentStatus = normalizeStatus(announcement.status)

    if (currentStatus === 'offline') {
      return NextResponse.json(
        { success: false, message: '已下架公告不可再编辑或变更状态' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.title !== undefined) updateData.title = parsed.title
    if (parsed.content !== undefined) updateData.content = parsed.content
    if (parsed.images !== undefined) updateData.images = parsed.images
    if (parsed.scope !== undefined) {
      updateData.scope = parsed.scope
      if (parsed.scope === 'all') updateData.buildingIds = null
    }
    if (parsed.buildingIds !== undefined) {
      const scope = parsed.scope ?? announcement.scope
      updateData.buildingIds =
        scope === 'specified' ? JSON.stringify(parsed.buildingIds) : null
    }
    if (parsed.status !== undefined) {
      if (parsed.status === currentStatus) {
        updateData.status = parsed.status
      } else if (currentStatus === 'draft' && parsed.status === 'published') {
        updateData.status = 'published'
        updateData.publishTime = new Date()
        updateData.publisherName = user.name
        updateData.publisherId = user.id
      } else if (currentStatus === 'published' && parsed.status === 'offline') {
        updateData.status = 'offline'
      } else {
        return NextResponse.json(
          { success: false, message: '非法状态流转，仅支持 草稿->发布、发布->下架' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
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

export async function DELETE(
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
    const announcementId = parseInt(id, 10)
    if (isNaN(announcementId)) {
      return NextResponse.json(
        { success: false, message: '无效的公告ID' },
        { status: 400 }
      )
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
    })
    if (!announcement) {
      return NextResponse.json(
        { success: false, message: '公告不存在' },
        { status: 404 }
      )
    }

    if (announcement.companyId !== user.companyId) {
      return NextResponse.json(
        { success: false, message: '无权限操作该公告' },
        { status: 403 }
      )
    }

    await prisma.announcement.delete({
      where: { id: announcementId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
