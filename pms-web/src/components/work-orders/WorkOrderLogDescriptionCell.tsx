import type { WorkOrderActivityLogDTO } from '@/lib/work-order-activity-log-db'

type ChangeEntry = { field: string; label: string; from: string; to: string }

function parseChanges(json: string | null): ChangeEntry[] {
  if (!json?.trim()) return []
  try {
    const v = JSON.parse(json) as unknown
    return Array.isArray(v) ? (v as ChangeEntry[]) : []
  } catch {
    return []
  }
}

export function WorkOrderLogDescriptionCell({ log }: { log: WorkOrderActivityLogDTO }) {
  const changes = parseChanges(log.changesJson)

  return (
    <>
      {log.summary ? (
        <p className="text-slate-800 dark:text-slate-200 mb-1">{log.summary}</p>
      ) : null}
      {changes.length > 0 && (
        <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
          {changes.map((c) => (
            <li key={c.field}>
              <span className="font-medium text-slate-700 dark:text-slate-300">{c.label}</span>
              ：{c.from} → {c.to}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
