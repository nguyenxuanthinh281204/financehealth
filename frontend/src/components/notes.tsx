import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ClipboardEvent, type KeyboardEvent, type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, ArchiveRestore, Check, ChevronDown, ChevronRight, Copy, ListChecks, Palette, Pin, Plus, RotateCcw, Tag, Trash2, X,
} from 'lucide-react'
import { api } from '../api/client'
import type { Note, NoteColor, NoteInput, NoteItem, NoteLabel, NotesBoard } from '../api/types'
import { isoDate } from '../lib/format'
import { keys, useNotes } from '../lib/queries'
import { ErrorText } from './ui'
import { Toast } from './tasks'

/* ---------- Dữ liệu ---------- */

type Action = {
  method: 'post' | 'patch' | 'del'
  path: string
  body?: unknown
  /** Cập nhật giao diện ngay, trước khi máy chủ trả lời */
  optimistic?: (b: NotesBoard) => NotesBoard
}

export type ToastInfo = { text: string; undo?: () => void }

const byPosition = (a: Note, b: Note) => a.position - b.position || b.id - a.id

function withNote(board: NotesBoard, note: Note): NotesBoard {
  const exists = board.notes.some((n) => n.id === note.id)
  const notes = exists ? board.notes.map((n) => (n.id === note.id ? note : n)) : [...board.notes, note]
  return { ...board, notes: notes.sort(byPosition) }
}

/** Áp thay đổi lên một ghi chú theo đúng luật của máy chủ (lưu trữ thì bỏ ghim, ghim thì ra khỏi lưu trữ). */
export function withPatch(board: NotesBoard, id: number, input: NoteInput): NotesBoard {
  return {
    ...board,
    notes: board.notes.map((n) => {
      if (n.id !== id) return n
      const { trashed, ...rest } = input
      const next: Note = { ...n, ...rest }
      if (trashed !== undefined) next.trashedAt = trashed ? new Date().toISOString() : undefined
      if (input.archived) next.pinned = false
      if (input.pinned) next.archived = false
      return next
    }),
  }
}

/**
 * Thao tác ghi: ghi chú đơn lẻ trả về Note, thao tác trên nhãn/thùng rác trả về cả bảng.
 * Bấm liên tục nhiều lần: chỉ lấy kết quả của thao tác cuối để giao diện không nhảy lùi.
 */
export function useNoteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: keys.notes,
    mutationFn: ({ method, path, body }: Action) =>
      method === 'del' ? api.del<Note | NotesBoard | null>(path) : api[method]<Note | NotesBoard>(path, body),
    onMutate: async ({ optimistic }) => {
      await qc.cancelQueries({ queryKey: keys.notes })
      const prev = qc.getQueryData<NotesBoard>(keys.notes)
      if (prev && optimistic) qc.setQueryData(keys.notes, optimistic(prev))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.notes, ctx.prev)
      qc.invalidateQueries({ queryKey: keys.notes })
    },
    onSuccess: (res) => {
      if (!res) return
      const last = qc.isMutating({ mutationKey: keys.notes }) <= 1
      qc.setQueryData<NotesBoard>(keys.notes, (b) => {
        if ('notes' in res) return last || !b ? res : { ...b, labels: res.labels }
        if (!b) return b
        // Ghi chú mới (tạo, sao chép) luôn được thêm vào; ghi chú đã có chỉ cập nhật ở thao tác cuối
        return last || !b.notes.some((n) => n.id === res.id) ? withNote(b, res) : b
      })
    },
  })
}

export const newItem = (text = ''): NoteItem => ({ id: Math.random().toString(36).slice(2, 10), text, checked: false })

/** Bỏ dấu tiếng Việt để tìm "di cho" ra "Đi chợ". */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export function matches(note: Note, q: string, labels: NoteLabel[]) {
  const names = note.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? '')
  const hay = [note.title, note.body, ...note.items.map((i) => i.text), ...names].join('\n')
  return fold(hay).includes(fold(q.trim()))
}

export const isBlank = (n: Pick<Note, 'title' | 'body' | 'items'>) =>
  !n.title.trim() && !n.body.trim() && n.items.every((i) => !i.text.trim())

export const NOTE_COLORS: { value: NoteColor; label: string }[] = [
  { value: 'default', label: 'Mặc định' },
  { value: 'red', label: 'Đỏ' },
  { value: 'orange', label: 'Cam' },
  { value: 'yellow', label: 'Vàng' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'teal', label: 'Xanh ngọc' },
  { value: 'blue', label: 'Xanh nhạt' },
  { value: 'darkblue', label: 'Xanh đậm' },
  { value: 'purple', label: 'Tím' },
  { value: 'pink', label: 'Hồng' },
  { value: 'brown', label: 'Nâu' },
  { value: 'gray', label: 'Xám' },
]

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
function editedLabel(iso: string) {
  const d = new Date(iso)
  const day = isoDate(d)
  const today = isoDate()
  const yesterday = isoDate(new Date(Date.now() - 86_400_000))
  if (day === today) return `Đã chỉnh sửa lúc ${time.format(d)}`
  if (day === yesterday) return `Đã chỉnh sửa hôm qua, ${time.format(d)}`
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  return `Đã chỉnh sửa ${d.getDate()}/${d.getMonth() + 1}${sameYear ? '' : `/${d.getFullYear()}`}`
}

/* ---------- Lưới masonry ---------- */

/** Ước lượng chiều cao thẻ để chia cột đều mà không cần đo DOM. */
function estimate(n: Note) {
  let h = 36
  if (n.title) h += 24 * Math.min(3, Math.ceil(n.title.length / 22))
  if (n.checklist) {
    const open = n.items.filter((i) => !i.checked).length
    h += Math.min(open, 8) * 28 + (open < n.items.length ? 26 : 0)
  } else if (n.body) {
    const lines = n.body.split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 26)), 0)
    h += Math.min(lines, 12) * 21
  }
  if (n.labelIds.length) h += 32
  return h
}

/** Xếp ghi chú vào cột thấp nhất, theo thứ tự trái sang phải như Keep. */
export function Masonry({ notes, render, maxCols = 6 }: { notes: Note[]; render: (n: Note) => ReactNode; maxCols?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(2)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (w: number) => {
      const min = w < 600 ? 130 : 220
      setCols(Math.min(maxCols, Math.max(1, Math.floor((w + 12) / (min + 12)))))
    }
    measure(el.clientWidth)
    const ro = new ResizeObserver(([e]) => measure(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxCols])
  const columns = useMemo(() => {
    const out = Array.from({ length: cols }, () => ({ h: 0, items: [] as Note[] }))
    for (const n of notes) {
      const c = out.reduce((a, b) => (b.h < a.h ? b : a))
      c.items.push(n)
      c.h += estimate(n)
    }
    return out
  }, [notes, cols])
  return (
    <div ref={ref} className="masonry" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {columns.map((c, i) => <div key={i} className="masonry-col">{c.items.map(render)}</div>)}
    </div>
  )
}

/* ---------- Thẻ ghi chú ---------- */

export function NoteCard({ note, labels, onOpen, onToast }: {
  note: Note; labels: NoteLabel[]; onOpen: (n: Note) => void; onToast?: (t: ToastInfo) => void
}) {
  const action = useNoteAction()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const trashed = !!note.trashedAt
  const patch = (body: NoteInput) =>
    action.mutate({ method: 'patch', path: `/api/notes/${note.id}`, body, optimistic: (b) => withPatch(b, note.id, body) })
  const toggleItem = (item: NoteItem) =>
    patch({ items: note.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) })
  const open = note.items.filter((i) => !i.checked)
  const doneCount = note.items.length - open.length
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

  return (
    <article className={`note-card note-c-${note.color}${note.pinned ? ' pinned' : ''}`} tabIndex={0}
      aria-label={note.title || 'Ghi chú'} onClick={() => onOpen(note)}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(note) }}>
      {!trashed && (
        <button type="button" className={`note-pin${note.pinned ? ' on' : ''}`} aria-pressed={note.pinned}
          aria-label={note.pinned ? 'Bỏ ghim' : 'Ghim'} onClick={stop(() => patch({ pinned: !note.pinned }))}>
          <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
        </button>
      )}
      {note.title && <h3 className="note-card-title">{note.title}</h3>}
      {note.checklist ? (
        <div className="note-card-items">
          {open.slice(0, 8).map((i) => (
            <div key={i.id} className="note-card-item">
              <button type="button" className="note-check" role="checkbox" aria-checked={false} disabled={trashed}
                aria-label={`Đánh dấu: ${i.text}`} onClick={stop(() => toggleItem(i))} />
              <span>{i.text}</span>
            </div>
          ))}
          {open.length > 8 && <div className="note-card-more">…</div>}
          {doneCount > 0 && <div className="note-card-more">+ {doneCount} mục đã đánh dấu</div>}
        </div>
      ) : note.body ? (
        <div className="note-card-body">{note.body}</div>
      ) : null}
      {isBlank(note) && <div className="note-card-body muted">Ghi chú trống</div>}
      {note.labelIds.length > 0 && (
        <div className="note-labels">
          {note.labelIds.slice(0, 3).map((id) => <span key={id} className="note-label">{labels.find((l) => l.id === id)?.name}</span>)}
          {note.labelIds.length > 3 && <span className="note-label">+{note.labelIds.length - 3}</span>}
        </div>
      )}
      <div className="note-card-actions">
        {trashed ? (
          <>
            <button type="button" className="note-act" aria-label="Khôi phục" title="Khôi phục"
              onClick={stop(() => patch({ trashed: false }))}><RotateCcw size={16} /></button>
            <button type="button" className={`note-act${confirmDelete ? ' danger' : ''}`} title="Xóa vĩnh viễn"
              aria-label={confirmDelete ? 'Bấm lần nữa để xóa vĩnh viễn' : 'Xóa vĩnh viễn'}
              onClick={stop(() => {
                if (!confirmDelete) return setConfirmDelete(true)
                action.mutate({
                  method: 'del', path: `/api/notes/${note.id}`,
                  optimistic: (b) => ({ ...b, notes: b.notes.filter((n) => n.id !== note.id) }),
                })
              })}>
              <Trash2 size={16} />{confirmDelete && <span>Xóa?</span>}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="note-act" aria-label={note.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
              title={note.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
              onClick={stop(() => {
                patch({ archived: !note.archived })
                onToast?.({ text: note.archived ? 'Đã bỏ lưu trữ' : 'Đã lưu trữ ghi chú', undo: () => patch({ archived: note.archived, pinned: note.pinned }) })
              })}>
              {note.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </button>
            <button type="button" className="note-act" aria-label="Xóa" title="Xóa"
              onClick={stop(() => {
                patch({ trashed: true })
                onToast?.({ text: 'Đã chuyển vào thùng rác', undo: () => patch({ trashed: false }) })
              })}>
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

/* ---------- Ô soạn thảo ---------- */

type Draft = Pick<Note, 'title' | 'body' | 'checklist' | 'items' | 'color' | 'pinned' | 'archived' | 'labelIds'>

const toDraft = (n: Note): Draft => ({
  title: n.title, body: n.body, checklist: n.checklist, items: n.items, color: n.color,
  pinned: n.pinned, archived: n.archived, labelIds: n.labelIds,
})

const emptyDraft = (labelId?: number, checklist = false): Draft => ({
  title: '', body: '', checklist, items: [], color: 'default', pinned: false, archived: false,
  labelIds: labelId ? [labelId] : [],
})

/** Các trường đã đổi so với lần lưu trước; null nếu không có gì. */
function diff(a: Draft, b: Draft): NoteInput | null {
  const out: NoteInput = {}
  if (a.title !== b.title) out.title = b.title
  if (a.body !== b.body) out.body = b.body
  if (a.checklist !== b.checklist) out.checklist = b.checklist
  if (JSON.stringify(a.items) !== JSON.stringify(b.items)) out.items = b.items
  if (a.color !== b.color) out.color = b.color
  if (a.pinned !== b.pinned) out.pinned = b.pinned
  if (a.archived !== b.archived) out.archived = b.archived
  if (a.labelIds.join() !== b.labelIds.join()) out.labelIds = b.labelIds
  return Object.keys(out).length ? out : null
}

/** Chuyển qua lại giữa ghi chú chữ và danh sách đánh dấu, mỗi dòng là một mục. */
function convert(d: Draft): Partial<Draft> {
  if (d.checklist) return { checklist: false, body: d.items.map((i) => i.text).join('\n'), items: [] }
  return { checklist: true, body: '', items: d.body.split('\n').filter((l) => l.trim()).map((l) => newItem(l)) }
}

/** Ô nhập tự giãn theo nội dung. */
function AutoText({ value, onChange, className, placeholder, maxLength, autoFocus, readOnly, onKeyDown, onPaste, inputRef, label }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number
  autoFocus?: boolean; readOnly?: boolean; label?: string
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void
  inputRef?: (el: HTMLTextAreaElement | null) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea ref={(el) => { ref.current = el; inputRef?.(el) }} rows={1} className={className} value={value}
      placeholder={placeholder} maxLength={maxLength} autoFocus={autoFocus} readOnly={readOnly} aria-label={label ?? placeholder}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} />
  )
}

function ChecklistEditor({ items, onChange, readOnly, autoFocus }: {
  items: NoteItem[]; onChange: (items: NoteItem[]) => void; readOnly?: boolean; autoFocus?: boolean
}) {
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const [focus, setFocus] = useState<{ id: string; at: number | 'end' } | null>(null)
  const [showDone, setShowDone] = useState(true)
  const [draft, setDraft] = useState('')
  useLayoutEffect(() => {
    if (!focus) return
    const el = refs.current.get(focus.id)
    if (el) {
      el.focus()
      const p = focus.at === 'end' ? el.value.length : focus.at
      el.setSelectionRange(p, p)
    }
    setFocus(null)
  }, [focus])

  const open = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)
  const update = (id: string, patch: Partial<NoteItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const insertAfter = (id: string, added: NoteItem[], focusAt: number | 'end' = 0) => {
    const next = [...items]
    next.splice(next.findIndex((i) => i.id === id) + 1, 0, ...added)
    onChange(next)
    setFocus({ id: added[added.length - 1].id, at: focusAt })
  }

  const onKey = (item: NoteItem, group: NoteItem[]) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      // Enter giữa dòng thì tách phần sau con trỏ thành mục mới
      e.preventDefault()
      const at = el.selectionStart
      const tail = item.text.slice(at)
      const next = items.map((i) => (i.id === item.id ? { ...i, text: i.text.slice(0, at) } : i))
      const added = { ...newItem(tail), checked: item.checked }
      next.splice(next.findIndex((i) => i.id === item.id) + 1, 0, added)
      onChange(next)
      setFocus({ id: added.id, at: 0 })
    } else if (e.key === 'Backspace' && item.text === '') {
      e.preventDefault()
      const idx = group.findIndex((i) => i.id === item.id)
      onChange(items.filter((i) => i.id !== item.id))
      const prev = group[idx - 1]
      if (prev) setFocus({ id: prev.id, at: 'end' })
    }
  }
  // Dán nhiều dòng thì mỗi dòng thành một mục
  const onPaste = (item: NoteItem) => (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const lines = e.clipboardData.getData('text').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return
    e.preventDefault()
    const el = e.currentTarget
    const head = item.text.slice(0, el.selectionStart) + lines[0]
    const tail = item.text.slice(el.selectionEnd)
    const added = lines.slice(1).map((l) => ({ ...newItem(l), checked: item.checked }))
    added[added.length - 1].text += tail
    const next = items.map((i) => (i.id === item.id ? { ...i, text: head } : i))
    next.splice(next.findIndex((i) => i.id === item.id) + 1, 0, ...added)
    onChange(next)
    setFocus({ id: added[added.length - 1].id, at: 'end' })
  }

  const row = (item: NoteItem, group: NoteItem[]) => (
    <div key={item.id} className={`check-item${item.checked ? ' checked' : ''}`}>
      <button type="button" className={`note-check${item.checked ? ' on' : ''}`} role="checkbox" aria-checked={item.checked}
        disabled={readOnly} aria-label={item.text || 'Mục'} onClick={() => update(item.id, { checked: !item.checked })}>
        {item.checked && <Check size={12} strokeWidth={3} />}
      </button>
      <AutoText className="check-item-input" value={item.text} maxLength={1000} readOnly={readOnly} label="Nội dung mục"
        inputRef={(el) => { if (el) refs.current.set(item.id, el); else refs.current.delete(item.id) }}
        onChange={(v) => update(item.id, { text: v.replace(/\n/g, ' ') })} onKeyDown={onKey(item, group)} onPaste={onPaste(item)} />
      {!readOnly && (
        <button type="button" className="check-item-del" aria-label="Xóa mục" onClick={() => onChange(items.filter((i) => i.id !== item.id))}>
          <X size={16} />
        </button>
      )}
    </div>
  )

  return (
    <div className="checklist-editor">
      {open.map((i) => row(i, open))}
      {!readOnly && (
        <div className="check-item add">
          <Plus size={18} />
          <AutoText className="check-item-input" value={draft} placeholder="Mục danh sách" maxLength={1000} autoFocus={autoFocus && items.length === 0}
            onChange={(v) => {
              if (!v.trim()) return setDraft(v)
              // Gõ vào dòng "thêm" thì tạo mục mới ngay, con trỏ chuyển sang mục đó
              const added = newItem(v.replace(/\n/g, ' '))
              const lastOpen = open[open.length - 1]
              if (lastOpen) insertAfter(lastOpen.id, [added], 'end')
              else { onChange([added, ...items]); setFocus({ id: added.id, at: 'end' }) }
              setDraft('')
            }} />
        </div>
      )}
      {done.length > 0 && (
        <>
          <button type="button" className="done-toggle small" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            <ChevronDown size={16} style={{ transform: showDone ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
            {done.length} mục đã đánh dấu
          </button>
          {showDone && done.map((i) => row(i, done))}
        </>
      )}
    </div>
  )
}

function NoteFields({ draft, change, labels, readOnly, autoFocus, pin }: {
  draft: Draft; change: (p: Partial<Draft>, now?: boolean) => void; labels: NoteLabel[]
  readOnly?: boolean; autoFocus?: boolean; pin?: ReactNode
}) {
  return (
    <>
      <div className="note-title-row">
        <AutoText className="note-title-input" value={draft.title} placeholder="Tiêu đề" maxLength={200} readOnly={readOnly}
          onChange={(v) => change({ title: v.replace(/\n/g, ' ') })} />
        {pin}
      </div>
      {draft.checklist ? (
        <ChecklistEditor items={draft.items} readOnly={readOnly} autoFocus={autoFocus} onChange={(items) => change({ items })} />
      ) : (
        <AutoText className="note-body-input" value={draft.body} placeholder="Ghi chú..." maxLength={20000} readOnly={readOnly}
          autoFocus={autoFocus} onChange={(body) => change({ body })} />
      )}
      {draft.labelIds.length > 0 && (
        <div className="note-labels">
          {draft.labelIds.map((id) => (
            <span key={id} className="note-label">
              {labels.find((l) => l.id === id)?.name}
              {!readOnly && (
                <button type="button" aria-label="Bỏ nhãn" onClick={() => change({ labelIds: draft.labelIds.filter((x) => x !== id) }, true)}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function PinButton({ pinned, onClick }: { pinned: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`note-pin static${pinned ? ' on' : ''}`} aria-pressed={pinned} aria-label={pinned ? 'Bỏ ghim' : 'Ghim'}
      title={pinned ? 'Bỏ ghim' : 'Ghim'} onClick={onClick}>
      <Pin size={18} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  )
}

/** Nút mở bảng chọn nhỏ (màu, nhãn); bấm ra ngoài thì đóng. */
function PopButton({ icon, label, up, children }: { icon: ReactNode; label: string; up?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div className="pop-anchor" ref={ref}>
      <button type="button" className="note-act" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>{icon}</button>
      {open && <div className={`popover${up ? ' up' : ''}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

function ColorPicker({ value, onPick }: { value: NoteColor; onPick: (c: NoteColor) => void }) {
  return (
    <div className="note-colors" role="radiogroup" aria-label="Màu nền">
      {NOTE_COLORS.map((c) => (
        <button key={c.value} type="button" role="radio" aria-checked={value === c.value} aria-label={c.label} title={c.label}
          className={`note-swatch note-c-${c.value}${value === c.value ? ' on' : ''}`} onClick={() => onPick(c.value)}>
          {value === c.value && <Check size={14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}

function LabelPicker({ labels, selected, onToggle, onCreate, busy }: {
  labels: NoteLabel[]; selected: number[]; onToggle: (id: number) => void; onCreate: (name: string) => void; busy?: boolean
}) {
  const [q, setQ] = useState('')
  const name = q.trim()
  const shown = labels.filter((l) => fold(l.name).includes(fold(name)))
  const exact = labels.some((l) => fold(l.name) === fold(name))
  return (
    <div className="label-picker">
      <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Gắn nhãn</div>
      <input className="input sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập tên nhãn" maxLength={50}
        autoFocus aria-label="Tìm hoặc tạo nhãn"
        onKeyDown={(e) => { if (e.key === 'Enter' && name && !exact) { e.preventDefault(); onCreate(name); setQ('') } }} />
      <div className="label-options">
        {shown.map((l) => (
          <label key={l.id} className="label-option">
            <input type="checkbox" checked={selected.includes(l.id)} onChange={() => onToggle(l.id)} />
            <span className="ellipsis">{l.name}</span>
          </label>
        ))}
        {labels.length === 0 && !name && <div className="small muted" style={{ padding: '6px 2px' }}>Chưa có nhãn nào</div>}
      </div>
      {name && !exact && (
        <button type="button" className="label-create" disabled={busy} onClick={() => { onCreate(name); setQ('') }}>
          <Plus size={16} /> Tạo nhãn “{name}”
        </button>
      )}
    </div>
  )
}

function NoteToolbar({ draft, change, labels, up, children }: {
  draft: Draft; change: (p: Partial<Draft>, now?: boolean) => void; labels: NoteLabel[]; up?: boolean; children?: ReactNode
}) {
  const action = useNoteAction()
  const createLabel = async (name: string) => {
    const board = await action.mutateAsync({ method: 'post', path: '/api/note-labels', body: { name } }) as NotesBoard
    const created = board.labels.find((l) => fold(l.name) === fold(name))
    if (created) change({ labelIds: [...draft.labelIds, created.id] }, true)
  }
  return (
    <div className="note-toolbar">
      <PopButton icon={<Palette size={18} />} label="Đổi màu nền" up={up}>
        {() => <ColorPicker value={draft.color} onPick={(color) => change({ color }, true)} />}
      </PopButton>
      <PopButton icon={<Tag size={18} />} label="Gắn nhãn" up={up}>
        {() => (
          <>
            <LabelPicker labels={labels} selected={draft.labelIds} busy={action.isPending} onCreate={createLabel}
              onToggle={(id) => change({
                labelIds: draft.labelIds.includes(id) ? draft.labelIds.filter((x) => x !== id) : [...draft.labelIds, id],
              }, true)} />
            <ErrorText error={action.error} />
          </>
        )}
      </PopButton>
      <button type="button" className={`note-act${draft.checklist ? ' on' : ''}`} aria-pressed={draft.checklist}
        aria-label={draft.checklist ? 'Bỏ ô đánh dấu' : 'Hiện ô đánh dấu'} title={draft.checklist ? 'Bỏ ô đánh dấu' : 'Hiện ô đánh dấu'}
        onClick={() => change(convert(draft), true)}>
        <ListChecks size={18} />
      </button>
      {children}
    </div>
  )
}

/** Thanh "Ghi chú..." ở đầu trang: bấm vào thì mở rộng, bấm ra ngoài hoặc Đóng thì lưu. */
export function NoteComposer({ labels, labelId, autoOpen }: { labels: NoteLabel[]; labelId?: number; autoOpen?: boolean }) {
  const action = useNoteAction()
  const [open, setOpen] = useState(!!autoOpen)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(labelId))
  const draftRef = useRef(draft)
  const ref = useRef<HTMLDivElement>(null)
  const change = (p: Partial<Draft>) => { draftRef.current = { ...draftRef.current, ...p }; setDraft(draftRef.current) }
  const start = (checklist: boolean) => {
    draftRef.current = emptyDraft(labelId, checklist)
    setDraft(draftRef.current)
    setOpen(true)
  }
  const close = useCallback(() => {
    const d = draftRef.current
    if (!isBlank(d)) {
      action.mutate({ method: 'post', path: '/api/notes', body: { ...d, items: d.items.filter((i) => i.text.trim()) } })
    }
    draftRef.current = emptyDraft(labelId)
    setDraft(draftRef.current)
    setOpen(false)
  }, [action, labelId])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, close])

  if (!open) {
    return (
      <div className="note-composer collapsed">
        <button type="button" className="grow note-composer-open" onClick={() => start(false)}>Ghi chú...</button>
        <button type="button" className="note-act" aria-label="Tạo danh sách" title="Tạo danh sách" onClick={() => start(true)}>
          <ListChecks size={20} />
        </button>
      </div>
    )
  }
  return (
    <div ref={ref} className={`note-composer note-c-${draft.color}`}
      onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
      <NoteFields draft={draft} change={change} labels={labels} autoFocus
        pin={<PinButton pinned={draft.pinned} onClick={() => change({ pinned: !draft.pinned })} />} />
      <NoteToolbar draft={draft} change={change} labels={labels}>
        <div className="grow" />
        <button type="button" className="btn ghost sm" onClick={close}>Đóng</button>
      </NoteToolbar>
      <ErrorText error={action.error} />
    </div>
  )
}

/** Mở một ghi chú để sửa: tự lưu sau khi ngừng gõ và khi đóng. */
export function NoteModal({ note, labels, onClose, onToast }: {
  note: Note; labels: NoteLabel[]; onClose: () => void; onToast?: (t: ToastInfo) => void
}) {
  const action = useNoteAction()
  const [draft, setDraft] = useState<Draft>(() => toDraft(note))
  const draftRef = useRef(draft)
  const saved = useRef(draft)
  const timer = useRef<number>(undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const trashed = !!note.trashedAt

  const save = useCallback(() => {
    window.clearTimeout(timer.current)
    const body = diff(saved.current, draftRef.current)
    if (!body || note.trashedAt) return
    saved.current = draftRef.current
    action.mutate({ method: 'patch', path: `/api/notes/${note.id}`, body, optimistic: (b) => withPatch(b, note.id, body) })
  }, [action, note.id, note.trashedAt])
  const saveRef = useRef(save)
  saveRef.current = save

  const change = (p: Partial<Draft>, now = false) => {
    draftRef.current = { ...draftRef.current, ...p }
    setDraft(draftRef.current)
    window.clearTimeout(timer.current)
    if (now) save()
    else timer.current = window.setTimeout(save, 700)
  }
  const close = useCallback(() => { saveRef.current(); onClose() }, [onClose])
  const patchNow = (body: NoteInput) =>
    action.mutate({ method: 'patch', path: `/api/notes/${note.id}`, body, optimistic: (b) => withPatch(b, note.id, body) })

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      // Rời trang khi đang gõ dở vẫn lưu
      saveRef.current()
    }
  }, [close])

  return (
    <div className="overlay" onClick={close}>
      <div className={`note-modal note-c-${draft.color}`} role="dialog" aria-modal="true" aria-label={draft.title || 'Ghi chú'}
        onClick={(e) => e.stopPropagation()}>
        <div className="note-modal-scroll">
          {trashed && <div className="small muted" style={{ marginBottom: 8 }}>Không sửa được ghi chú trong thùng rác.</div>}
          <NoteFields draft={draft} change={change} labels={labels} readOnly={trashed}
            pin={!trashed && <PinButton pinned={draft.pinned} onClick={() => change({ pinned: !draft.pinned, archived: draft.pinned ? draft.archived : false }, true)} />} />
          <div className="note-edited">{editedLabel(note.updatedAt)}</div>
        </div>
        <ErrorText error={action.error} />
        {trashed ? (
          <div className="note-toolbar">
            <button type="button" className="btn ghost sm" onClick={() => { patchNow({ trashed: false }); onClose() }}>
              <RotateCcw size={16} /> Khôi phục
            </button>
            <button type="button" className="btn ghost sm" style={{ color: 'var(--danger)' }}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true)
                action.mutate({
                  method: 'del', path: `/api/notes/${note.id}`,
                  optimistic: (b) => ({ ...b, notes: b.notes.filter((n) => n.id !== note.id) }),
                })
                onClose()
              }}>
              <Trash2 size={16} /> {confirmDelete ? 'Bấm lần nữa để xóa' : 'Xóa vĩnh viễn'}
            </button>
            <div className="grow" />
            <button type="button" className="btn ghost sm" onClick={onClose}>Đóng</button>
          </div>
        ) : (
          <NoteToolbar draft={draft} change={change} labels={labels} up>
            <button type="button" className="note-act" aria-label={draft.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'} title={draft.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
              onClick={() => {
                const was = { archived: draft.archived, pinned: draft.pinned }
                change({ archived: !draft.archived, pinned: draft.archived ? draft.pinned : false }, true)
                onClose()
                onToast?.({ text: was.archived ? 'Đã bỏ lưu trữ' : 'Đã lưu trữ ghi chú', undo: () => patchNow(was) })
              }}>
              {draft.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>
            <button type="button" className="note-act" aria-label="Xóa" title="Xóa"
              onClick={() => {
                save()
                patchNow({ trashed: true })
                onClose()
                onToast?.({ text: 'Đã chuyển vào thùng rác', undo: () => patchNow({ trashed: false }) })
              }}>
              <Trash2 size={18} />
            </button>
            <button type="button" className="note-act" aria-label="Tạo bản sao" title="Tạo bản sao"
              onClick={() => {
                save()
                action.mutate({ method: 'post', path: `/api/notes/${note.id}/copy` })
                onClose()
                onToast?.({ text: 'Đã tạo bản sao' })
              }}>
              <Copy size={18} />
            </button>
            <div className="grow" />
            <button type="button" className="btn ghost sm" onClick={close}>Đóng</button>
          </NoteToolbar>
        )}
      </div>
    </div>
  )
}

/* ---------- Thẻ ở màn Hôm nay ---------- */

export function TodayNotesCard() {
  const notes = useNotes()
  const [openId, setOpenId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastInfo | null>(null)
  const closeToast = useCallback(() => setToast(null), [])
  const board = notes.data
  if (!board) return null
  const live = board.notes.filter((n) => !n.trashedAt && !n.archived)
  const pinned = live.filter((n) => n.pinned)
  const shown = (pinned.length ? pinned : live).slice(0, 4)
  const opened = openId != null ? board.notes.find((n) => n.id === openId) : undefined

  return (
    <div className="card">
      <div className="card-head">
        <h2>{pinned.length ? 'Ghi chú đã ghim' : 'Ghi chú'}</h2>
        <Link to="/ghi-chu" className="small">Tất cả <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
      </div>
      {shown.length === 0 ? (
        <div className="small muted" style={{ padding: '0 0 8px' }}>Ghi lại ý tưởng, danh sách đi chợ, mật khẩu wifi...</div>
      ) : (
        <Masonry notes={shown} maxCols={2}
          render={(n) => <NoteCard key={n.id} note={n} labels={board.labels} onOpen={(x) => setOpenId(x.id)} onToast={setToast} />} />
      )}
      <Link to="/ghi-chu?moi=1" className="btn secondary block" style={{ marginTop: 12 }}><Plus size={18} /> Ghi chú mới</Link>
      {opened && <NoteModal key={opened.id} note={opened} labels={board.labels} onClose={() => setOpenId(null)} onToast={setToast} />}
      {toast && <Toast text={toast.text} onUndo={toast.undo} onClose={closeToast} />}
    </div>
  )
}
