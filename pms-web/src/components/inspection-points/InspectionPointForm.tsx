'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  CATEGORY_TO_NFC_TYPE,
  INSPECTION_CATEGORIES,
  type InspectionCategory,
} from '@/lib/inspection-point-types'

type Building = { id: number; name: string }
type FloorOpt = { id: number; name: string; buildingId: number }
type DeviceOpt = { id: number; code: string; name: string; buildingId: number }
type NfcOpt = { id: number; tagId: string; location: string; inspectionType: string }

export function InspectionPointForm({
  pointId,
  buildings: buildingsProp,
  onClose,
  onSaved,
}: {
  pointId: number | null
  buildings: Building[]
  onClose: () => void
  onSaved: () => void
}) {
  const [buildings, setBuildings] = useState<Building[]>(buildingsProp)
  const [name, setName] = useState('')
  const [inspectionCategory, setInspectionCategory] = useState<InspectionCategory>('工程巡检')
  const [buildingId, setBuildingId] = useState(0)
  const [floorId, setFloorId] = useState<number | ''>('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [deviceIds, setDeviceIds] = useState<number[]>([])
  const [nfcTagId, setNfcTagId] = useState<number>(0)
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled')
  /** 当前所选楼宇下的楼层（由 GET /api/floors?buildingId= 加载） */
  const [buildingFloors, setBuildingFloors] = useState<FloorOpt[]>([])
  const [devices, setDevices] = useState<DeviceOpt[]>([])
  const [nfcList, setNfcList] = useState<NfcOpt[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(!!pointId)
  const [error, setError] = useState('')
  const [devicePickerOpen, setDevicePickerOpen] = useState(false)
  const [nfcPickerOpen, setNfcPickerOpen] = useState(false)
  const [nfcSearch, setNfcSearch] = useState('')
  const [nfcDraftId, setNfcDraftId] = useState(0)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceDraftIds, setDeviceDraftIds] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = pointId != null
  const isDeviceCategory = inspectionCategory === '设备巡检'
  const nfcTypeFilter = CATEGORY_TO_NFC_TYPE[inspectionCategory]

  useEffect(() => {
    let cancelled = false
    async function loadBuildings() {
      try {
        const res = await fetch('/api/buildings', { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.success && Array.isArray(json.data?.list)) {
          setBuildings(json.data.list)
        }
      } catch {
        /* ignore */
      }
    }
    void loadBuildings()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!buildingId) {
      setBuildingFloors([])
      return
    }
    let cancelled = false
    async function loadFloorsForBuilding() {
      try {
        const res = await fetch(`/api/floors?buildingId=${buildingId}`, { credentials: 'include' })
        const json = await res.json()
        if (cancelled) return
        if (json.success && Array.isArray(json.data)) {
          setBuildingFloors(
            json.data.map((f: { id: number; name: string; buildingId: number }) => ({
              id: f.id,
              name: f.name,
              buildingId: Number(f.buildingId),
            }))
          )
        } else {
          setBuildingFloors([])
        }
      } catch {
        if (!cancelled) setBuildingFloors([])
      }
    }
    void loadFloorsForBuilding()
    return () => {
      cancelled = true
    }
  }, [buildingId])

  useEffect(() => {
    let cancelled = false
    async function loadDevices() {
      try {
        const res = await fetch('/api/devices', { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.success && json.data?.list) {
          setDevices(json.data.list)
        }
      } catch {
        /* ignore */
      }
    }
    void loadDevices()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!buildingId) {
      setNfcList([])
      return
    }
    let cancelled = false
    async function loadNfc() {
      try {
        const q = new URLSearchParams({ buildingId: String(buildingId), status: 'active' })
        const res = await fetch(`/api/nfc-tags?${q}`, { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.success && json.data?.list) {
          setNfcList(json.data.list)
        }
      } catch {
        if (!cancelled) setNfcList([])
      }
    }
    void loadNfc()
    return () => {
      cancelled = true
    }
  }, [buildingId])

  useEffect(() => {
    setNfcTagId(0)
  }, [inspectionCategory, buildingId])

  useEffect(() => {
    if (!isDeviceCategory) {
      setDeviceIds([])
    }
  }, [isDeviceCategory])

  useEffect(() => {
    if (!pointId) {
      setLoadingDetail(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/inspection-points/${pointId}`, { credentials: 'include' })
        const json = await res.json()
        if (cancelled || !json.success || !json.data) return
        const d = json.data
        setName(d.name)
        setInspectionCategory(d.inspectionCategory as InspectionCategory)
        setBuildingId(d.buildingId)
        setFloorId(d.floorId ?? '')
        setLocation(d.location ?? '')
        setDescription(d.description ?? '')
        setImages(Array.isArray(d.images) ? d.images : [])
        setDeviceIds(d.deviceIds ?? [])
        setNfcTagId(d.nfcTagId ?? 0)
        setStatus(d.status === 'enabled' ? 'enabled' : 'disabled')
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [pointId])

  const devicesForBuilding = useMemo(
    () => devices.filter((d) => d.buildingId === buildingId),
    [devices, buildingId]
  )

  const nfcFiltered = useMemo(
    () => nfcList.filter((n) => n.inspectionType === nfcTypeFilter),
    [nfcList, nfcTypeFilter]
  )

  const nfcListForPicker = useMemo(() => {
    const q = nfcSearch.trim().toLowerCase()
    if (!q) return nfcFiltered
    return nfcFiltered.filter((n) => {
      const hay = `${n.tagId} ${n.location} ${n.inspectionType}`.toLowerCase()
      return hay.includes(q)
    })
  }, [nfcFiltered, nfcSearch])

  const nfcSummary = useMemo(() => {
    if (!nfcTagId) return '点击选择 NFC 标签'
    const n = nfcFiltered.find((x) => x.id === nfcTagId) ?? nfcList.find((x) => x.id === nfcTagId)
    return n ? `${n.tagId} · ${n.location}` : `已选 ID ${nfcTagId}`
  }, [nfcTagId, nfcFiltered, nfcList])

  const deviceSummary = useMemo(() => {
    if (deviceIds.length === 0) return '点击选择设备'
    const labels = deviceIds
      .map((id) => devices.find((d) => d.id === id))
      .filter(Boolean)
      .map((d) => `${d!.code} · ${d!.name}`)
    if (!labels.length) return '请选择设备'
    if (labels.length <= 2) return `已选 ${labels.length} 台：${labels.join('；')}`
    return `已选 ${labels.length} 台：${labels.slice(0, 2).join('；')} 等`
  }, [deviceIds, devices])

  const deviceListForPicker = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase()
    const base = devicesForBuilding
    if (!q) return base
    return base.filter((d) => {
      const hay = `${d.code} ${d.name}`.toLowerCase()
      return hay.includes(q)
    })
  }, [devicesForBuilding, deviceSearch])

  /** 与上传接口一致：PNG / JPG / WebP（部分浏览器 MIME 为空时靠扩展名判断） */
  function isAllowedImageFile(f: File): boolean {
    const t = (f.type || '').toLowerCase()
    if (
      t === 'image/png' ||
      t === 'image/jpeg' ||
      t === 'image/jpg' ||
      t === 'image/pjpeg' ||
      t === 'image/webp'
    ) {
      return true
    }
    if (
      t.startsWith('image/') &&
      (t.includes('png') || t.includes('jpeg') || t.includes('jpg') || t.includes('webp'))
    ) {
      return true
    }
    const n = f.name.toLowerCase()
    return /\.(png|jpe?g|webp)$/.test(n)
  }

  function revokeIfBlob(url: string) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }
  }

  async function uploadPickedFiles(files: File[]) {
    const picked = files.filter(isAllowedImageFile)
    if (picked.length === 0) {
      if (files.length > 0) {
        alert('请选择 PNG / JPG / WebP 图片（手机拍摄的 HEIC 需先转为 JPG）')
      }
      return
    }
    const blobUrls = picked.map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...blobUrls])
    setUploading(true)
    try {
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i]
        const blobUrl = blobUrls[i]
        try {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/inspection-points/upload-image', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          })
          let json: { success?: boolean; message?: string; data?: { url?: string } }
          try {
            json = await res.json()
          } catch {
            alert(`上传响应异常：${file.name}（HTTP ${res.status}）`)
            continue
          }
          if (json.success && json.data?.url) {
            revokeIfBlob(blobUrl)
            const serverUrl = json.data.url
            setImages((prev) => prev.map((u) => (u === blobUrl ? serverUrl : u)))
          } else {
            alert(
              json.message ||
                `「${file.name}」上传失败（HTTP ${res.status}）。缩略图仍保留，可删除后重试。`
            )
          }
        } catch {
          alert(`「${file.name}」上传出错，缩略图仍保留，请检查网络后删除重选。`)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const snapshot = input.files?.length ? Array.from(input.files) : []
    input.value = ''
    void uploadPickedFiles(snapshot)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('名称必填')
      return
    }
    if (!buildingId) {
      setError('请选择楼宇')
      return
    }
    if (isDeviceCategory && deviceIds.length === 0) {
      setError('设备巡检须关联至少一台设备')
      return
    }
    if (!isDeviceCategory && deviceIds.length > 0) {
      setError('仅设备巡检可关联设备')
      return
    }
    if (status === 'enabled' && (!nfcTagId || nfcTagId <= 0)) {
      setError('启用前须绑定 NFC')
      return
    }
    if (images.some((u) => u.startsWith('blob:'))) {
      setError(
        uploading
          ? '图片正在上传中，请稍候再保存'
          : '存在未成功上传到服务器的图片（本地预览）。请删除对应缩略图后重新选择文件，或检查是否已登录、网络是否正常。无需重启服务。'
      )
      return
    }

    const body = {
      name: name.trim(),
      buildingId,
      floorId: floorId === '' ? null : floorId,
      inspectionCategory,
      location: location.trim(),
      description: description.trim() || null,
      images: images.filter((u) => !u.startsWith('blob:')),
      deviceIds: isDeviceCategory ? deviceIds : [],
      nfcTagId: nfcTagId > 0 ? nfcTagId : null,
      status,
    }

    setLoading(true)
    try {
      const url = isEdit ? `/api/inspection-points/${pointId}` : '/api/inspection-points'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        onSaved()
      } else {
        setError(json.message || '保存失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 relative z-10">
          <h2 className="text-lg font-semibold">{isEdit ? '编辑巡检点' : '新建巡检点'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {loadingDetail ? (
          <div className="p-12 text-center text-slate-500">加载中…</div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="shrink-0 relative z-20 mx-4 mt-3 mb-0 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/30 px-3 py-2.5 text-red-700 dark:text-red-300 text-sm shadow-sm"
              >
                {error}
              </div>
            )}
            <form
              id="inspection-point-form"
              onSubmit={submit}
              className="flex-1 min-h-0 overflow-y-auto p-4 pt-3 space-y-4"
            >
            <div>
              <label className="block text-sm font-medium mb-1">名称 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">巡检类型 *</label>
              <select
                value={inspectionCategory}
                onChange={(e) => setInspectionCategory(e.target.value as InspectionCategory)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {INSPECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                每个巡检点仅绑定一个 NFC，且须与类型一致（工程/设备/安保/绿化）。仅「设备巡检」需关联设备。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">所属楼宇 *</label>
                <select
                  value={buildingId ? String(buildingId) : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setBuildingId(v ? parseInt(v, 10) : 0)
                    setFloorId('')
                    setDeviceIds([])
                    setNfcTagId(0)
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  required
                >
                  <option value="">请选择</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">楼层</label>
                <select
                  value={floorId}
                  onChange={(e) =>
                    setFloorId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="">不指定</option>
                  {buildingFloors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">位置</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="如：东侧通道"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">图片（可多张）</label>
              <p className="text-xs text-slate-500 mb-2">
                支持 PNG / JPG / WebP；选择后会立即显示缩略图（本地预览），上传成功后替换为服务器地址。手机 HEIC 需先导出为 JPG。
              </p>
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative w-20 h-20 rounded-lg border border-slate-200 overflow-hidden shrink-0 group">
                    <button
                      type="button"
                      onClick={() => setPreviewIdx(i)}
                      className="absolute inset-0 z-0"
                      aria-label="预览大图"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button
                      type="button"
                      className="absolute top-0 right-0 z-10 bg-black/60 text-white text-xs leading-none px-1.5 py-0.5 rounded-bl hover:bg-black/80"
                      onClick={() =>
                        setImages((prev) => {
                          const u = prev[i]
                          revokeIfBlob(u)
                          return prev.filter((_, j) => j !== i)
                        })
                      }
                      aria-label="删除"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="relative h-20 w-20 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                    multiple
                    className="sr-only"
                    disabled={uploading}
                    onChange={onPickFile}
                    aria-label="上传图片"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-700"
                    aria-label="选择图片上传"
                  >
                    {uploading ? (
                      <span className="text-xs text-slate-500">…</span>
                    ) : (
                      <Plus className="h-8 w-8 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {isDeviceCategory && (
              <div>
                <label className="block text-sm font-medium mb-1">关联设备 *</label>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceDraftIds([...deviceIds])
                    setDeviceSearch('')
                    setDevicePickerOpen(true)
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-600/80"
                >
                  {!buildingId ? '请先选择楼宇（点击打开设备列表）' : deviceSummary}
                </button>
                <p className="text-xs text-slate-500 mt-1">
                  须先选择上方「所属楼宇」。点击打开列表，支持按编号/名称搜索，可多选设备。
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'enabled' | 'disabled')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="disabled">禁用</option>
                <option value="enabled">启用</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                启用须已绑定 NFC。禁用状态下也可先绑定 NFC，便于后续再启用；禁用的巡检点不会出现在新建巡检计划中。
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                绑定 NFC{status === 'enabled' ? ' *' : '（可选，禁用时也可先绑定）'}
              </label>
              {!buildingId ? (
                <p className="text-sm text-slate-500">请先选择所属楼宇，再选择本楼宇下的 NFC。</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNfcDraftId(nfcTagId)
                    setNfcSearch('')
                    setNfcPickerOpen(true)
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-left text-sm"
                >
                  {nfcSummary}
                </button>
              )}
              <p className="text-xs text-slate-500 mt-1">
                仅列出与「{inspectionCategory}」对应的 NFC（{nfcTypeFilter}
                类）。点击打开列表，可搜索编号或位置；单选绑定。禁用时可不选。
              </p>
            </div>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || loadingDetail || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? '保存中…' : uploading ? '图片上传中…' : '保存'}
              </button>
            </div>
          </form>
          </>
        )}
      </div>

      {nfcPickerOpen && (
        <div
          className="fixed inset-0 z-[62] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setNfcPickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="font-medium">选择 NFC（单选）</span>
              <button
                type="button"
                onClick={() => setNfcPickerOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={nfcSearch}
                  onChange={(e) => setNfcSearch(e.target.value)}
                  placeholder="搜索编号、位置…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-2 overflow-y-auto flex-1 min-h-[200px] max-h-[50vh] space-y-1">
              {nfcFiltered.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">
                  当前楼宇下没有与「{inspectionCategory}」类型一致的启用 NFC，请先在 NFC 标签中维护。
                </p>
              ) : nfcListForPicker.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">无匹配项，请调整搜索关键词</p>
              ) : (
                nfcListForPicker.map((n) => (
                  <label
                    key={n.id}
                    className={`flex items-center gap-3 cursor-pointer text-sm rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/80 ${
                      nfcDraftId === n.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="nfcPick"
                      checked={nfcDraftId === n.id}
                      onChange={() => setNfcDraftId(n.id)}
                      className="shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{n.tagId}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {n.location}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNfcDraftId(0)
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 mr-auto"
              >
                清除选择
              </button>
              <button
                type="button"
                onClick={() => setNfcPickerOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setNfcTagId(nfcDraftId)
                  setNfcPickerOpen(false)
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {devicePickerOpen && (
        <div
          className="fixed inset-0 z-[62] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDevicePickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="font-medium">选择设备（多选）</span>
              <button
                type="button"
                onClick={() => setDevicePickerOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder="搜索设备编号、名称…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-2 overflow-y-auto flex-1 min-h-[200px] max-h-[50vh] space-y-1">
              {!buildingId ? (
                <p className="text-sm text-slate-500 p-2">
                  请先在表单上方选择「所属楼宇」，再返回此处选择本楼宇下的设备。
                </p>
              ) : devicesForBuilding.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">该楼宇下暂无设备，请先在设备管理中维护。</p>
              ) : deviceListForPicker.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">无匹配项，请调整搜索关键词</p>
              ) : (
                deviceListForPicker.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 cursor-pointer text-sm rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/80 ${
                      deviceDraftIds.includes(d.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={deviceDraftIds.includes(d.id)}
                      onChange={() =>
                        setDeviceDraftIds((prev) =>
                          prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                        )
                      }
                      className="shrink-0 rounded"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{d.code}</span>
                      <span className="text-slate-500 dark:text-slate-400"> · {d.name}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDeviceDraftIds([])}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 mr-auto"
              >
                清除选择
              </button>
              <button
                type="button"
                onClick={() => setDevicePickerOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceIds([...deviceDraftIds])
                  setDevicePickerOpen(false)
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {previewIdx !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewIdx(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-2xl z-10"
            onClick={() => setPreviewIdx(null)}
          >
            ×
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 text-white p-2 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewIdx((i) => (i === null ? 0 : (i - 1 + images.length) % images.length))
                }}
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                type="button"
                className="absolute right-4 text-white p-2 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewIdx((i) => (i === null ? 0 : (i + 1) % images.length))
                }}
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[previewIdx]}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
