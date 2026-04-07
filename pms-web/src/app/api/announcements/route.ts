import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().optional().default(''),
  images: z.string().optional().nullable(),
  scope: z.enum(['all', 'specified']),
  buildingIds: z.array(z.number()).optional().default([]),
})

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
}

function normalizeStatus(
  s: string
): 'draft' | 'published' | 'offline' {
  if (s === 'published' || s === '已发布') return 'published'
  if (s === 'offline' || s === '已下架') return 'offline'
  return 'draft'
}

export async function GET() {
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

    const announcements = await prisma.announcement.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      images: a.images,
      scope: a.scope,
      buildingIds: parseJsonIds(a.buildingIds),
      publishTime: a.publishTime?.toISOString() ?? null,
      status: normalizeStatus(a.status),
      publisherName: a.publisherName,
      publisherId: a.publisherId,
      readCount: a.readCount,
      companyId: a.companyId,
      createdAt: a.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, buildings },
    })
  } catch (e) {
    console.error(e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        success: false,
        message:
          process.env.NODE_ENV === 'development'
            ? `服务器错误: ${detail}`
            : '服务器错误',
      },
      { status: 500 }
    )
  }
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

    const body = await request.json()
    const parsed = createSchema.parse(body)

    const announcement = await prisma.announcement.create({
      data: {
        title: parsed.title,
        content: parsed.content ?? '',
        images: parsed.images ?? null,
        scope: parsed.scope,
        buildingIds:
          parsed.scope === 'specified'
            ? JSON.stringify(parsed.buildingIds ?? [])
            : null,
        publishTime: null,
        status: 'draft',
        publisherName: user.name,
        publisherId: user.id,
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ success: true, data: announcement })
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
