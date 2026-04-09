'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import {
  COMPANY_ADMIN_ROLE_CODE,
  DATA_SCOPE_OPTIONS,
  MENU_OPTIONS,
  MENU_BUTTON_OPTIONS,
  eligibleButtonKeysForMenus,
  menuButtonKey,
  serializeButtonPermissionKeysForSave,
} from '@/lib/menu-config'
import type { Role } from './RoleList'

type Company = { id: number; name: string }

function MenuButtonSelectAllRow({
  allChecked,
  indeterminate,
  onChange,
}: {
  allChecked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>按钮权限（全选/取消）</span>
    </label>
  )
}

function parseStoredButtonKeys(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === '') return null
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    return arr.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

export function RoleForm({
  role,
  companies,
  isSuperAdmin,
  onClose,
}: {
  role: Role | null
  companies: Company[]
  isSuperAdmin: boolean
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [dataScope, setDataScope] = useState<string>('all')
  const [menuIds, setMenuIds] = useState<number[]>([])
  const [checkedButtons, setCheckedButtons] = useState<Set<string>>(() => new Set())
  const [companyId, setCompanyId] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!role
  const isCompanyAdminRole = role?.code === COMPANY_ADMIN_ROLE_CODE

  const eligibleKeys = useMemo(() => eligibleButtonKeysForMenus(menuIds), [menuIds])

  useEffect(() => {
    if (role) {
      setName(role.name)
      setCode(role.code)
      setDataScope(role.dataScope)
      const mids = role.menuIds || []
      setMenuIds(mids)
      setCompanyId(role.companyId)
      const eligible = new Set(eligibleButtonKeysForMenus(mids))
      const explicit = parseStoredButtonKeys(role.buttonPermissionKeys)
      if (explicit === null) {
        setCheckedButtons(new Set(eligible))
      } else {
        setCheckedButtons(new Set(explicit.filter((k) => eligible.has(k))))
      }
    } else {
      setName('')
      setCode('')
      setDataScope('all')
      setMenuIds([])
      setCheckedButtons(new Set(eligibleButtonKeysForMenus([])))
      setCompanyId(companies[0]?.id ?? 0)
    }
  }, [role, companies])

  const toggleMenu = (id: number) => {
    if (menuIds.length === 0) {
      setMenuIds(MENU_OPTIONS.map((m) => m.id).filter((x) => x !== id))
    } else if (menuIds.includes(id)) {
      const nextMenus = menuIds.filter((x) => x !== id)
      setMenuIds(nextMenus)
      const keysForMenu = (MENU_BUTTON_OPTIONS[id] ?? []).map((b) => menuButtonKey(id, b.id))
      setCheckedButtons((prev) => {
        const n = new Set(prev)
        for (const k of keysForMenu) n.delete(k)
        return n
      })
    } else {
      setMenuIds([...menuIds, id])
      const keysForMenu = (MENU_BUTTON_OPTIONS[id] ?? []).map((b) => menuButtonKey(id, b.id))
      setCheckedButtons((prev) => {
        const n = new Set(prev)
        for (const k of keysForMenu) n.add(k)
        return n
      })
    }
  }

  const isAllMenus = menuIds.length === 0 || menuIds.length === MENU_OPTIONS.length
  const toggleAllMenus = () => {
    setMenuIds([])
    setCheckedButtons(new Set(eligibleButtonKeysForMenus([])))
  }

  const toggleButton = (key: string) => {
    setCheckedButtons((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const toggleAllButtonsForMenu = (menuId: number, checked: boolean) => {
    const keys = (MENU_BUTTON_OPTIONS[menuId] ?? []).map((b) => menuButtonKey(menuId, b.id))
    setCheckedButtons((prev) => {
      const n = new Set(prev)
      for (const k of keys) {
        if (checked) n.add(k)
        else n.delete(k)
      }
      return n
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const serialized = serializeButtonPermissionKeysForSave(menuIds, checkedButtons)
      const buttonPermissionKeys =
        serialized === null ? null : (JSON.parse(serialized) as string[])

      const body: Record<string, unknown> = {
        name,
        code,
        dataScope,
        menuIds,
        buttonPermissionKeys,
      }
      if (isSuperAdmin && !isEdit) {
        body.companyId = companyId
      }

      const url = isEdit ? `/api/roles/${role!.id}` : '/api/roles'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const menuAllowed = (id: number) => menuIds.length === 0 || menuIds.includes(id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? '编辑角色' : '新增角色'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="role-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">角色名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入角色名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">角色编码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="如 admin、manager"
              required
              disabled={isEdit}
            />
            {isEdit && (
              <p className="mt-1 text-xs text-slate-500">编辑时角色编码不可修改</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">数据权限</label>
            <select
              value={dataScope}
              onChange={(e) => setDataScope(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {DATA_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && !isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">所属公司</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                <option value={0}>请选择公司</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCompanyAdminRole ? (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20 p-3 text-sm text-emerald-900 dark:text-emerald-100">
              系统管理员角色（编码 <code className="font-mono">{COMPANY_ADMIN_ROLE_CODE}</code>
              ）默认拥有<strong>全部菜单与按钮权限</strong>，无需在此配置。其他角色可由系统管理员按需分配菜单与按钮权限。
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">菜单权限</label>
                <div className="text-xs text-slate-500 mb-2">
                  不勾选菜单则默认拥有全部菜单；勾选后为「仅下列菜单」。每个菜单下可单独勾选按钮权限。
                </div>
                {!isAllMenus && (
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={toggleAllMenus}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      恢复为全部菜单
                    </button>
                  </div>
                )}
                <div className="max-h-[min(52vh,420px)] overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-2">
                  {MENU_OPTIONS.map((m) => {
                    const buttons = MENU_BUTTON_OPTIONS[m.id] ?? []
                    const menuOn = menuAllowed(m.id)
                    const btnKeys = buttons.map((b) => menuButtonKey(m.id, b.id))
                    const checkedCount = btnKeys.filter((k) => checkedButtons.has(k)).length
                    const allBtn = buttons.length > 0 && checkedCount === buttons.length
                    const someBtn = checkedCount > 0 && !allBtn

                    return (
                      <div
                        key={m.id}
                        className="rounded-lg border border-slate-100 dark:border-slate-600/80 p-2 bg-slate-50/50 dark:bg-slate-700/20"
                      >
                        <div className="flex items-start gap-2">
                          <label className="flex items-center gap-2 cursor-pointer shrink-0 pt-0.5">
                            <input
                              type="checkbox"
                              checked={menuIds.length === 0 || menuIds.includes(m.id)}
                              onChange={() => toggleMenu(m.id)}
                            />
                            <span className="text-sm font-medium">{m.label}</span>
                          </label>
                        </div>
                        {menuOn && buttons.length > 0 && (
                          <div className="mt-2 ml-6 pl-2 border-l-2 border-slate-200 dark:border-slate-600 space-y-2">
                            <MenuButtonSelectAllRow
                              allChecked={allBtn}
                              indeterminate={someBtn}
                              onChange={(checked) => toggleAllButtonsForMenu(m.id, checked)}
                            />
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {buttons.map((b) => {
                                const key = menuButtonKey(m.id, b.id)
                                return (
                                  <label
                                    key={b.id}
                                    className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checkedButtons.has(key)}
                                      onChange={() => toggleButton(key)}
                                    />
                                    <span>{b.label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="role-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
