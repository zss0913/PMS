import { prisma } from '@/lib/prisma'

function normalizeStatus(
  s: string
): 'draft' | 'published' | 'offline' {
  if (s === 'published' || s === '已发布') return 'published'
  if (s === 'offline' || s === '已下架') return 'offline'
  return 'draft'
}

function formatTime(v: Date | null) {
  if (!v) return '-'
  return new Date(v).toLocaleString('zh-CN')
}

export default async function AnnouncementPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const nid = Number(id)
  if (!Number.isFinite(nid) || nid <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        无效公告ID
      </div>
    )
  }

  const row = await prisma.announcement.findUnique({
    where: { id: nid },
    include: { company: { select: { name: true } } },
  })

  if (!row) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        公告不存在
      </div>
    )
  }

  const status = normalizeStatus(row.status)
  const publishTime = row.publishTime || (status === 'draft' ? row.createdAt : null)

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-start justify-center overflow-x-hidden">
      <div className="w-full max-w-sm min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h1 className="text-lg font-semibold">公告预览</h1>
        </div>
        <div className="p-4">
          <h2 className="text-xl font-bold leading-8 break-words">{row.title}</h2>
          <div className="mt-3 text-xs text-slate-500 space-y-1">
            <p>物业公司：{row.company.name}</p>
            <p>发布人：{row.publisherName || '待发布'}</p>
            <p>发布时间：{formatTime(publishTime)}</p>
          </div>
          <div className="mt-4 min-w-0 text-sm leading-7 text-slate-700">
            <div
              className="prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_video]:max-w-full [&_table]:max-w-full"
              dangerouslySetInnerHTML={{ __html: row.content || '<p>（无内容）</p>' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
