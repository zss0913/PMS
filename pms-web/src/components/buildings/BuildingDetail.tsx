'use client'

import { useState } from 'react'
import { AppLink } from '@/components/AppLink'
import { Building2, Plus, Edit2, Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Floor = {
  id: number
  name: string
  sort: number
  area: number
}

type Building = {
  id: number
  name: string
  area: number
  manager: string
  phone: string
  location: string | null
  projectId: number | null
  project?: { id: number; name: string } | null
  floors: Floor[]
  _count?: { rooms: number }
}

export function BuildingDetail({ building }: { building: Building }) {
  const router = useRouter()
  const [floors, setFloors] = useState<Floor[]>(building.floors)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [loading, setLoading] = useState(false)

  // 单个添加表单
  const [singleName, setSingleName] = useState('')
  const [singleArea, setSingleArea] = useState('')

  // 批量添加表单
  const [batchStart, setBatchStart] = useState(1)
  const [batchEnd, setBatchEnd] = useState(10)
  const [batchPrefix, setBatchPrefix] = useState('')
  const [batchSuffix, setBatchSuffix] = useState('层')

  // 刷新数据
  const refreshFloors = async () => {
    try {
      const res = await fetch(`/api/floors?buildingId=${building.id}`)
      const data = await res.json()
      if (data.success) {
        setFloors(data.data)
        router.refresh()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // 添加单个楼层
  const handleAddSingle = async () => {
    if (!singleName.trim()) {
      alert('请输入楼层名称')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/floors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(building.id),
          name: singleName,
          area: Number(singleArea) || 0,
          sort: floors.length + 1,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setSingleName('')
        setSingleArea('')
        await refreshFloors()
      } else {
        alert(data.message || '添加失败')
      }
    } catch (e) {
      alert('添加失败')
    } finally {
      setLoading(false)
    }
  }

  // 批量添加楼层
  const handleBatchAdd = async () => {
    const start = Number(batchStart)
    const end = Number(batchEnd)
    if (isNaN(start) || isNaN(end)) {
      alert('请输入有效的楼层数字')
      return
    }
    if (end < start) {
      alert('结束楼层必须大于等于开始楼层')
      return
    }
    if (end - start > 50) {
      alert('一次最多添加50个楼层')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/floors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(building.id),
          startFloor: start,
          endFloor: end,
          prefix: batchPrefix,
          suffix: batchSuffix,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowBatchModal(false)
        await refreshFloors()
      } else {
        alert(data.message || '批量添加失败')
      }
    } catch (e) {
      alert('批量添加失败')
    } finally {
      setLoading(false)
    }
  }

  // 编辑楼层
  const handleEdit = async () => {
    if (!editingFloor || !editingFloor.name.trim()) {
      alert('请输入楼层名称')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/floors/${editingFloor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingFloor.name,
          area: Number(editingFloor.area) || 0,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowEditModal(false)
        setEditingFloor(null)
        await refreshFloors()
      } else {
        alert(data.message || '编辑失败')
      }
    } catch (e) {
      alert('编辑失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除楼层
  const handleDelete = async (floorId: number) => {
    if (!confirm('确定要删除该楼层吗？删除后不可恢复。')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/floors/${floorId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await refreshFloors()
      } else {
        alert(data.message || '删除失败')
      }
    } catch (e) {
      alert('删除失败')
    } finally {
      setLoading(false)
    }
  }

  // 移动楼层顺序
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === floors.length - 1) return

    const newFloors = [...floors]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newFloors[index], newFloors[targetIndex]] = [newFloors[targetIndex], newFloors[index]]
    setFloors(newFloors)

    // 保存新顺序
    await saveFloorOrder(newFloors)
  }

  // 拖拽状态
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, floorId: number) => {
    setDraggingId(floorId)
    e.dataTransfer.effectAllowed = 'move'
    // 设置拖拽图像
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
    dragImage.style.opacity = '0.8'
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 20)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  const handleDragOver = (e: React.DragEvent, floorId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingId !== floorId) {
      setDragOverId(floorId)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    setDragOverId(null)
    setDraggingId(null)

    if (draggingId === null || draggingId === targetId) return

    const fromIndex = floors.findIndex((f) => f.id === draggingId)
    const toIndex = floors.findIndex((f) => f.id === targetId)

    if (fromIndex === -1 || toIndex === -1) return

    const newFloors = [...floors]
    const [movedFloor] = newFloors.splice(fromIndex, 1)
    newFloors.splice(toIndex, 0, movedFloor)

    setFloors(newFloors)
    await saveFloorOrder(newFloors)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }

  const saveFloorOrder = async (newFloors: Floor[]) => {
    setLoading(true)
    try {
      const res = await fetch('/api/floors/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: building.id,
          floorIds: newFloors.map((f) => f.id),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.message || '排序调整失败')
        setFloors(floors) // 恢复原顺序
      }
    } catch (e) {
      alert('排序调整失败')
      setFloors(floors) // 恢复原顺序
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-center text-slate-600">处理中...</p>
          </div>
        </div>
      )}

      {/* 基本信息卡片 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            基本信息
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-slate-500">楼宇名称</label>
            <p className="font-medium">{building.name}</p>
          </div>
          <div>
            <label className="text-sm text-slate-500">面积(㎡)</label>
            <p className="font-medium">{building.area}</p>
          </div>
          <div>
            <label className="text-sm text-slate-500">负责人</label>
            <p className="font-medium">{building.manager}</p>
          </div>
          <div>
            <label className="text-sm text-slate-500">联系电话</label>
            <p className="font-medium">{building.phone}</p>
          </div>
          <div>
            <label className="text-sm text-slate-500">位置</label>
            <p className="font-medium">{building.location || '-'}</p>
          </div>
          <div>
            <label className="text-sm text-slate-500">所属项目</label>
            <p className="font-medium">{building.project?.name || '-'}</p>
          </div>
        </div>
      </div>

      {/* 楼层管理卡片 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">楼层管理</h2>
            <span className="text-sm text-slate-500">
              共 {floors.length} 层
              {building._count?.rooms != null && ` / ${building._count.rooms} 间房源`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"
            >
              <Plus className="w-4 h-4" />
              批量添加
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500"
            >
              <Plus className="w-4 h-4" />
              添加楼层
            </button>
            <AppLink
              href={`/rooms?buildingId=${building.id}`}
              className="text-sm text-blue-600 hover:underline px-3 py-1.5"
            >
              查看房源
            </AppLink>
          </div>
        </div>

        <div className="overflow-x-auto">
          {floors.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left p-4 font-medium w-12">排序</th>
                  <th className="text-left p-4 font-medium">楼层名称</th>
                  <th className="text-left p-4 font-medium">面积(㎡)</th>
                  <th className="text-left p-4 font-medium w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((f, index) => (
                  <tr
                    key={f.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, f.id)}
                    onDragOver={(e) => handleDragOver(e, f.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, f.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-move transition',
                      draggingId === f.id && 'opacity-50 bg-slate-100',
                      dragOverId === f.id && 'bg-blue-50 border-blue-300'
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                        <span className="text-sm text-slate-500">{index + 1}</span>
                      </div>
                    </td>
                    <td className="p-4">{f.name}</td>
                    <td className="p-4">{f.area || '-'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded disabled:opacity-30"
                          title="上移"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === floors.length - 1}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded disabled:opacity-30"
                          title="下移"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingFloor(f)
                            setShowEditModal(true)
                          }}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <p className="mb-4">暂无楼层数据</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
                >
                  批量创建楼层
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                >
                  添加单个楼层
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 添加单个楼层弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">添加楼层</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">楼层名称</label>
                <input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="如：1层、地下1层"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">楼层面积(㎡)</label>
                <input
                  type="number"
                  value={0}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">楼层面积根据本层所有房源面积自动计算，添加房源后自动更新</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleAddSingle}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量添加楼层弹窗 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">批量创建楼层</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">开始楼层</label>
                  <input
                    type="number"
                    value={batchStart}
                    onChange={(e) => setBatchStart(parseInt(e.target.value) || 0)}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                  <p className="text-xs text-slate-400 mt-1">负数表示地下</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">结束楼层</label>
                  <input
                    type="number"
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(parseInt(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">前缀</label>
                  <input
                    type="text"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    placeholder="如：第"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">后缀</label>
                  <input
                    type="text"
                    value={batchSuffix}
                    onChange={(e) => setBatchSuffix(e.target.value)}
                    placeholder="如：层"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  将创建 {Math.max(0, batchEnd - batchStart + 1)} 个楼层：
                  {batchStart > 0 && batchEnd > 0
                    ? `${batchPrefix}${batchStart}${batchSuffix} ~ ${batchPrefix}${batchEnd}${batchSuffix}`
                    : batchStart < 0 && batchEnd < 0
                    ? `${batchPrefix}B${Math.abs(batchStart)}${batchSuffix} ~ ${batchPrefix}B${Math.abs(batchEnd)}${batchSuffix}`
                    : '混合楼层'}
                </p>
                <p className="text-xs text-slate-400 mt-1">负数自动转为 B1、B2 格式</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleBatchAdd}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
              >
                批量创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑楼层弹窗 */}
      {showEditModal && editingFloor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">编辑楼层</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-500 mb-1">楼层名称</label>
                <input
                  type="text"
                  value={editingFloor.name}
                  onChange={(e) => setEditingFloor({ ...editingFloor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">楼层面积(㎡)</label>
                <input
                  type="number"
                  value={editingFloor.area}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">楼层面积根据本层所有房源面积自动计算，不可手动修改</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
