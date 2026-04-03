'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImagePlus,
  Video,
  Undo2,
  Redo2,
} from 'lucide-react'
import type { Announcement } from './AnnouncementList'

type Building = { id: number; name: string }

export function AnnouncementForm({
  announcement,
  buildings,
  onClose,
}: {
  announcement: Announcement | null
  buildings: Building[]
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState<'all' | 'specified'>('all')
  const [buildingIds, setBuildingIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const editorRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)

  const isEdit = !!announcement

  const syncContentFromEditor = () => {
    const html = editorRef.current?.innerHTML ?? ''
    setContent(html)
  }

  const sanitizeHtml = (raw: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'text/html')
    doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove())

    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        const value = attr.value.trim().toLowerCase()
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }
        if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
          el.removeAttribute(attr.name)
        }
      }
    })

    return doc.body.innerHTML
  }

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    syncContentFromEditor()
  }

  const insertHtml = (html: string) => {
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    syncContentFromEditor()
  }

  const ensureHttpUrl = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  const insertLink = () => {
    const raw = window.prompt('请输入链接地址（支持 https://）')
    if (!raw) return
    const url = ensureHttpUrl(raw)
    if (!url) return
    runCommand('createLink', url)
  }

  const insertImageByUrl = () => {
    const raw = window.prompt('请输入图片地址')
    if (!raw) return
    const url = ensureHttpUrl(raw)
    if (!url) return
    insertHtml(`<p><img src="${url}" alt="公告图片" style="max-width: 100%; height: auto;" /></p>`)
  }

  const insertVideoByUrl = () => {
    const raw = window.prompt('请输入视频地址')
    if (!raw) return
    const url = ensureHttpUrl(raw)
    if (!url) return
    insertHtml(
      `<p><video controls src="${url}" style="max-width: 100%; width: 100%;"></video></p>`
    )
  }

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })

  const handleLocalImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      insertHtml(
        `<p><img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; height: auto;" /></p>`
      )
    } catch {
      setError('图片读取失败，请重试')
    }
  }

  const handleLocalVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      insertHtml(
        `<p><video controls src="${dataUrl}" style="max-width: 100%; width: 100%;"></video></p>`
      )
    } catch {
      setError('视频读取失败，请重试')
    }
  }

  const textPreview = content.replace(/<[^>]+>/g, '').trim()

  useEffect(() => {
    const nextContent = announcement?.content ?? ''
    if (announcement) {
      setTitle(announcement.title)
      setContent(nextContent)
      setScope((announcement.scope as 'all' | 'specified') || 'all')
      setBuildingIds(announcement.buildingIds ?? [])
    } else {
      setTitle('')
      setContent(nextContent)
      setScope('all')
      setBuildingIds([])
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = nextContent
    }
  }, [announcement])

  const toggleBuilding = (id: number) => {
    setBuildingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const cleanedContent = sanitizeHtml(content)
      const body: Record<string, unknown> = {
        title,
        content: cleanedContent,
        scope,
        buildingIds: scope === 'specified' ? buildingIds : [],
      }

      const url = isEdit ? `/api/announcements/${announcement!.id}` : '/api/announcements'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑公告' : '新增公告'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          id="announcement-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入公告标题"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">内容</label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700">
              <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('bold')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="加粗"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('italic')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="斜体"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('underline')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="下划线"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('insertUnorderedList')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="无序列表"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('insertOrderedList')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="有序列表"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('justifyLeft')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="左对齐"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('justifyCenter')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="居中"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('justifyRight')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="右对齐"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
                <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertLink()
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="插入链接"
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertImageByUrl()
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="插入图片链接"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    imageInputRef.current?.click()
                  }}
                  className="px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="上传图片"
                >
                  上传图
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertVideoByUrl()
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="插入视频链接"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    videoInputRef.current?.click()
                  }}
                  className="px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="上传视频"
                >
                  上传视频
                </button>
                <span className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('undo')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="撤销"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runCommand('redo')
                  }}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="重做"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                {!textPreview && (
                  <div className="absolute pointer-events-none left-3 top-2 text-sm text-slate-400">
                    请输入公告内容，可插入图片/视频并自由排版
                  </div>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncContentFromEditor}
                  className="min-h-[180px] p-3 outline-none leading-7"
                />
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLocalImage}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleLocalVideo}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              支持文字样式、列表、对齐、链接、图片和视频（可上传或插入链接）
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">发布范围</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'specified')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="all">全部楼宇</option>
              <option value="specified">指定楼宇</option>
            </select>
          </div>
          {scope === 'specified' && (
            <div>
              <label className="block text-sm font-medium mb-1">指定楼宇</label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
                {buildings.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={buildingIds.includes(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                    />
                    <span className="text-sm">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
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
            form="announcement-form"
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
