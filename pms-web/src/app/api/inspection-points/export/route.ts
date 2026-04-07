import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { isValidInspectionCategory } from '@/lib/inspection-point-types'

function csvEscape(s: string | number | null | undefined): string {
  const t = s == null ? '' : String(s)
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function parseImagesJson(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return ''
    return arr.filter((x): x is string => typeof x === 'string').join('; ')
  } catch {
    return ''
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl
    const q = (searchParams.get('q') || '').trim()
    const buildingId = searchParams.get('buildingId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where: Prisma.InspectionPointWhereInput = { companyId: user.companyId }
    if (buildingId && /^\d+$/.test(buildingId)) {
      where.buildingId = parseInt(buildingId, 10)
    }
    if (status === 'enabled' || status === 'disabled') {
      where.status = status
    }
    if (category && isValidInspectionCategory(category)) {
      where.inspectionCategory = category
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { location: { contains: q } },
        { description: { contains: q } },
      ]
    }

    const rows = await prisma.inspectionPoint.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        building: { select: { name: true } },
        floor: { select: { name: true } },
        nfcTag: { select: { tagId: true } },
        devices: { include: { device: { select: { code: true, name: true } } } },
      },
    })

    const header = [
      'ID',
      '名称',
      '巡检类型',
      '楼宇',
      '楼层',
      '位置',
      '状态',
      '关联设备',
      'NFC',
      '图片',
      '描述',
      '创建时间',
    ]

    const lines = [header.join(',')]
    for (const p of rows) {
      const devStr = p.devices.map((d) => `${d.device.code}`).join(';')
      lines.push(
        [
          p.id,
          csvEscape(p.name),
          csvEscape(p.inspectionCategory),
          csvEscape(p.building.name),
          csvEscape(p.floor?.name ?? ''),
          csvEscape(p.location),
          p.status === 'enabled' ? '启用' : '禁用',
          csvEscape(devStr),
          csvEscape(p.nfcTag?.tagId ?? ''),
          csvEscape(parseImagesJson(p.images)),
          csvEscape(p.description ?? ''),
          p.createdAt.toISOString(),
        ].join(',')
      )
    }

    const csv = '\uFEFF' + lines.join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inspection-points-${Date.now()}.csv"`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
