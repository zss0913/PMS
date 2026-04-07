import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { syncInspectionTaskProgress } from '@/lib/inspection-task-status'

const bodySchema = z.object({
  scannedTagId: z.string().min(1, '请提供读卡得到的标签编号'),
  remark: z.string().optional(),
  images: z.array(z.string()).max(12).optional(),
})

/** 员工端：提交单个 NFC 巡检点（读卡编号须与任务内检查项一致） */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const { id } = await params
  const taskId = parseInt(id, 10)
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ success: false, message: '无效的任务ID' }, { status: 400 })
  }

  const task = await prisma.inspectionTask.findFirst({
    where: { id: taskId, companyId: user.companyId },
  })
  if (!task) {
    return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
  }

  let userIds: number[] = []
  if (task.userIds) {
    try {
      userIds = JSON.parse(task.userIds) as number[]
      if (!Array.isArray(userIds)) userIds = []
    } catch {
      userIds = []
    }
  }
  if (userIds.length > 0 && !userIds.includes(user.id)) {
    return NextResponse.json({ success: false, message: '您不在该任务的巡检人员列表中' }, { status: 403 })
  }

  const norm = (s: string) => s.trim().toUpperCase().replace(/\s/g, '')
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
  }

  const scanned = norm(body.scannedTagId)
  const items = parseCheckItemsJson(task.checkItems)
  const tagRows = await prisma.nfcTag.findMany({
    where: { id: { in: items.map((i) => i.nfcTagId) }, companyId: user.companyId },
  })
  const byBusiness = new Map(tagRows.map((t) => [norm(t.tagId), t]))
  const matched = byBusiness.get(scanned)
  if (!matched) {
    return NextResponse.json(
      { success: false, message: '读卡编号与当前任务路线中的 NFC 不匹配' },
      { status: 400 }
    )
  }

  const inRoute = items.some((i) => i.nfcTagId === matched.id)
  if (!inRoute) {
    return NextResponse.json(
      { success: false, message: '该标签不属于本巡检任务的检查项' },
      { status: 400 }
    )
  }

  const dup = await prisma.inspectionRecord.findFirst({
    where: { taskId, companyId: user.companyId, tagId: matched.tagId },
  })
  if (dup) {
    return NextResponse.json({ success: false, message: '该巡检点已提交过' }, { status: 400 })
  }

  if (task.requirePhoto) {
    const imgs = body.images?.filter(Boolean) ?? []
    if (imgs.length === 0) {
      return NextResponse.json(
        { success: false, message: '本任务要求拍照，请先拍摄并上传现场照片' },
        { status: 400 }
      )
    }
  }

  const payload = {
    remark: body.remark?.trim() || undefined,
    images: body.images?.filter(Boolean) ?? [],
  }

  await prisma.inspectionRecord.create({
    data: {
      taskId,
      taskCode: task.code,
      inspectionType: task.inspectionType,
      tagId: matched.tagId,
      location: matched.location,
      checkedAt: new Date(),
      checkedBy: user.id,
      status: 'normal',
      checkItems: JSON.stringify(payload),
      companyId: user.companyId,
    },
  })

  await syncInspectionTaskProgress(prisma, taskId)

  const updated = await prisma.inspectionTask.findUnique({ where: { id: taskId } })
  const recordsAfter = await prisma.inspectionRecord.findMany({
    where: { taskId },
    select: { tagId: true },
  })
  const doneSet = new Set(recordsAfter.map((r) => r.tagId))
  let done = 0
  for (const it of items) {
    const t = tagRows.find((x) => x.id === it.nfcTagId)
    if (t && doneSet.has(t.tagId)) done += 1
  }

  return NextResponse.json({
    success: true,
    data: {
      tagId: matched.tagId,
      status: updated?.status,
      progress: { total: items.length, done },
    },
  })
}
