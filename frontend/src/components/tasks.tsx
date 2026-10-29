import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlignLeft, Check, ChevronRight, CornerDownRight, ListTree, Plus, Star, X } from 'lucide-react'
import { api } from '../api/client'
import type { Task, TaskBoard, TaskInput, TaskListInfo } from '../api/types'
import { addDays, prettyDate, shortDate, weekStartOf } from '../lib/format'
import { keys, useTasks } from '../lib/queries'
import { ErrorText, Sheet } from './ui'

/* ---------- Dữ liệu ---------- */

type Action = {
  method: 'post' | 'patch' | 'put' | 'del'
  path: string
  body?: unknown
  /** Cập nhật giao diện ngay, trước khi máy chủ trả lời */
  optimistic?: (b: TaskBoard) => TaskBoard
}

/** Mọi thao tác ghi đều trả về toàn bộ bảng việc mới nhất. */
export function useTaskAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: keys.tasks,
    mutationFn: ({ method, path, body }: Action) =>
      method === 'del' ? api.del<TaskBoard>(path) : api[method]<TaskBoard>(path, body),
    onMutate: async ({ optimistic }) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      const prev = qc.getQueryData<TaskBoard>(keys.tasks)
      if (prev && optimistic) qc.setQueryData(keys.tasks, optimistic(prev))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.tasks, ctx.prev)
      qc.invalidateQueries({ queryKey: keys.tasks })
    },
    // Bấm liên tục nhiều việc: chỉ lấy kết quả của thao tác cuối để giao diện không nhảy lùi
    onSuccess: (b) => {
      if (qc.isMutating({ mutationKey: keys.tasks }) <= 1) qc.setQueryData(keys.tasks, b)
    },
  })
}

const byPosition = (a: Task, b: Task) => a.position - b.position || a.id - b.id

export function openTopLevel(board: TaskBoard, listId: number) {
  return board.tasks.filter((t) => t.listId === listId && t.parentId == null && !t.completed).sort(byPosition)
}

export function childrenOf(board: TaskBoard, parentId: number) {
  return board.tasks.filter((t) => t.parentId === parentId).sort(byPosition)
}

export function withCompleted(board: TaskBoard, task: Task, done: boolean): TaskBoard {
  const now = new Date().toISOString()
  return {
    ...board,
    tasks: board.tasks.map((x) => {
      if (x.id === task.id) return { ...x, completed: done, completedAt: done ? now : undefined }
      // Xong việc cha thì xong luôn việc con; mở lại việc con thì mở lại việc cha
      if (done && task.parentId == null && x.parentId === task.id) return { ...x, completed: true, completedAt: x.completedAt ?? now }
      if (!done && x.id === task.parentId) return { ...x, completed: false, completedAt: undefined }
      return x
    }),
  }
}

export function withTask(board: TaskBoard, id: number, patch: Partial<Task>): TaskBoard {
  return { ...board, tasks: board.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
}

export function withOrder(board: TaskBoard, ids: number[]): TaskBoard {
  const pos = new Map(ids.map((id, i) => [id, i]))
  return { ...board, tasks: board.tasks.map((x) => (pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x)) }
}

/** Tick hoặc bỏ tick một việc. */
export function useToggleTask() {
  const action = useTaskAction()
  return (task: Task, done: boolean) => {
    action.mutate({
      method: 'patch', path: `/api/tasks/${task.id}`, body: { completed: done },
      optimistic: (b) => withCompleted(b, task, done),
    })
  }
}

/* ---------- Ngày hạn ---------- */

const weekdayLong = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' })
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86_400_000)

export function dueInfo(due: string, today: string): { label: string; tone: 'overdue' | 'today' | '' } {
  const diff = dayDiff(due, today)
  if (diff < 0) return { label: diff === -1 ? 'Hôm qua' : shortDate(due), tone: 'overdue' }
  if (diff === 0) return { label: 'Hôm nay', tone: 'today' }
  if (diff === 1) return { label: 'Ngày mai', tone: '' }
  if (diff < 7) {
    const w = weekdayLong.format(new Date(due + 'T00:00:00'))
    return { label: w.charAt(0).toUpperCase() + w.slice(1), tone: '' }
  }
  return { label: due.slice(0, 4) === today.slice(0, 4) ? shortDate(due) : `${shortDate(due)}/${due.slice(0, 4)}`, tone: '' }
}

/** Nhóm việc theo ngày hạn cho chế độ "Theo ngày". */
export function groupByDue(tasks: Task[], today: string) {
  const groups = new Map<string, { label: string; tone: string; items: Task[] }>()
  const sorted = [...tasks].sort((a, b) =>
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || byPosition(a, b))
  for (const t of sorted) {
    let key: string, label: string, tone = ''
    if (!t.dueDate) { key = 'none'; label = 'Không có ngày' }
    else if (t.dueDate < today) { key = 'overdue'; label = 'Quá hạn'; tone = 'overdue' }
    else { key = t.dueDate; label = prettyDate(t.dueDate); tone = t.dueDate === today ? 'today' : '' }
    if (!groups.has(key)) groups.set(key, { label, tone, items: [] })
    groups.get(key)!.items.push(t)
  }
  return [...groups.entries()].map(([key, g]) => ({ key, ...g }))
}

/* ---------- Thành phần ---------- */

/** Vòng tròn tick: hiện dấu tick một nhịp rồi mới chuyển việc xuống phần đã hoàn thành. */
export function TaskCheck({ task, onToggle, small }: { task: Task; onToggle: (t: Task, done: boolean) => void; small?: boolean }) {
  const [pending, setPending] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const on = task.completed || pending
  return (
    <button type="button" className={`task-check${on ? ' on' : ''}${small ? ' sm' : ''}`} aria-pressed={on}
      aria-label={task.completed ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`}
      onClick={(e) => {
        e.stopPropagation()
        if (task.completed) return onToggle(task, false)
        if (pending) return
        setPending(true)
        timer.current = window.setTimeout(() => { setPending(false); onToggle(task, true) }, 320)
      }}>
      <Check size={small ? 12 : 14} strokeWidth={3} />
    </button>
  )
}

export function StarButton({ task }: { task: Task }) {
  const action = useTaskAction()
  return (
    <button type="button" className={`star-btn${task.starred ? ' on' : ''}`} aria-pressed={task.starred}
      aria-label={task.starred ? 'Bỏ gắn sao' : 'Gắn sao'}
      onClick={(e) => {
        e.stopPropagation()
        action.mutate({
          method: 'patch', path: `/api/tasks/${task.id}`, body: { starred: !task.starred },
          optimistic: (b) => withTask(b, task.id, { starred: !task.starred }),
        })
      }}>
      <Star size={18} fill={task.starred ? 'currentColor' : 'none'} />
    </button>
  )
}

export function TaskRow({ task, today, onOpen, onToggle, sub, context, subCount, handle, rowRef, style, dragging }: {
  task: Task; today: string; onOpen: (t: Task) => void; onToggle: (t: Task, done: boolean) => void
  sub?: boolean
  /** Dòng phụ: tên danh sách hoặc việc cha, dùng ở màn Hôm nay và mục gắn sao */
  context?: string
  subCount?: number
  handle?: ReactNode; rowRef?: Ref<HTMLDivElement>; style?: CSSProperties; dragging?: boolean
}) {
  const due = task.dueDate && !task.completed ? dueInfo(task.dueDate, today) : null
  return (
    <div ref={rowRef} style={style}
      className={`task-row${sub ? ' sub' : ''}${task.completed ? ' done' : ''}${dragging ? ' dragging' : ''}`}>
      <TaskCheck task={task} onToggle={onToggle} small={sub} />
      <button type="button" className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title">{task.title}</span>
        {task.notes && <span className="task-notes">{task.notes}</span>}
        {(due || context || (subCount ?? 0) > 0) && (
          <span className="task-meta">
            {due && <span className={`due-chip ${due.tone}`}>{due.label}</span>}
            {(subCount ?? 0) > 0 && <span><ListTree size={12} /> {subCount}</span>}
            {context && <span className="ellipsis">{context}</span>}
          </span>
        )}
      </button>
      {!task.completed && <StarButton task={task} />}
      {handle}
    </div>
  )
}

/** Ô nhập nhanh: gõ tên rồi Enter. */
export function QuickAdd({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (title: string) => void; disabled?: boolean }) {
  const [title, setTitle] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title.trim())
    setTitle('')
  }
  return (
    <form className="quick-add" onSubmit={submit}>
      <Plus size={20} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={200}
        aria-label={placeholder} disabled={disabled} enterKeyHint="done" />
      {title.trim() && <button className="btn sm">Thêm</button>}
    </form>
  )
}

/** Thông báo ngắn ở cuối màn hình, kèm nút Hoàn tác. */
export function Toast({ text, onUndo, onClose }: { text: string; onUndo?: () => void; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4500)
    return () => window.clearTimeout(t)
  }, [text, onClose])
  return (
    <div className="toast" role="status">
      <span className="grow">{text}</span>
      {onUndo && <button type="button" onClick={() => { onUndo(); onClose() }}>Hoàn tác</button>}
    </div>
  )
}

/* ---------- Sheet sửa việc ---------- */

function nextMonday(today: string) {
  return addDays(weekStartOf(today), 7)
}

export function TaskSheet({ task, board, onClose, onOpen }: {
  task: Task; board: TaskBoard; onClose: () => void; onOpen: (t: Task) => void
}) {
  const action = useTaskAction()
  const toggle = useToggleTask()
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [due, setDue] = useState(task.dueDate ?? '')
  const [listId, setListId] = useState(task.listId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const today = board.today
  const parent = task.parentId != null ? board.tasks.find((t) => t.id === task.parentId) : undefined
  const subtasks = task.parentId == null ? childrenOf(board, task.id) : []
  const openSubs = subtasks.filter((t) => !t.completed)
  const doneSubs = subtasks.filter((t) => t.completed)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const body: TaskInput = { title: title.trim(), notes }
    if (due) body.dueDate = due
    else if (task.dueDate) body.clearDue = true
    if (listId !== task.listId) body.listId = listId
    action.mutate({ method: 'patch', path: `/api/tasks/${task.id}`, body }, { onSuccess: onClose })
  }
  const remove = () =>
    action.mutate({
      method: 'del', path: `/api/tasks/${task.id}`,
      optimistic: (b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== task.id && t.parentId !== task.id) }),
    }, { onSuccess: onClose })
  const addSub = (t: string) =>
    action.mutate({ method: 'post', path: '/api/tasks', body: { parentId: task.id, title: t } })

  const quick = [
    { label: 'Hôm nay', value: today },
    { label: 'Ngày mai', value: addDays(today, 1) },
    { label: 'Tuần sau', value: nextMonday(today) },
  ]

  return (
    <Sheet title={task.parentId != null ? 'Việc con' : 'Chi tiết việc'} onClose={onClose}>
      <div className="form">
        <form id="task-form" className="form" onSubmit={save}>
          {parent && (
            <button type="button" className="parent-link" onClick={() => onOpen(parent)}>
              <CornerDownRight size={14} /> Thuộc: <b className="ellipsis">{parent.title}</b>
            </button>
          )}
          <input className="input task-title-input" value={title} onChange={(e) => setTitle(e.target.value)}
            maxLength={200} required aria-label="Tên việc" />
          <label className="field"><span><AlignLeft size={13} style={{ verticalAlign: -2 }} /> Ghi chú</span>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000}
              placeholder="Thêm chi tiết" rows={3} />
          </label>
          <div className="field"><span>Ngày hạn</span>
            <div className="chips">
              {quick.map((q) => (
                <button key={q.label} type="button" className={`chip${due === q.value ? ' on' : ''}`}
                  onClick={() => setDue(due === q.value ? '' : q.value)}>{q.label}</button>
              ))}
              <input type="date" className="chip date-chip" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Chọn ngày" />
              {due && (
                <button type="button" className="chip" onClick={() => setDue('')} aria-label="Bỏ ngày hạn"><X size={14} /> Bỏ ngày</button>
              )}
            </div>
            {due && <div className="small muted">{prettyDate(due)}</div>}
          </div>
          {task.parentId == null && board.lists.length > 1 && (
            <label className="field"><span>Danh sách</span>
              <select className="input" value={listId} onChange={(e) => setListId(Number(e.target.value))}>
                {board.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
        </form>

        {task.parentId == null && (
          <div className="field"><span>Việc con</span>
            <div className="subtask-box">
              {[...openSubs, ...doneSubs].map((s) => (
                <TaskRow key={s.id} task={s} today={today} sub onOpen={onOpen} onToggle={toggle} />
              ))}
              <QuickAdd placeholder="Thêm việc con" onAdd={addSub} />
            </div>
          </div>
        )}

        <ErrorText error={action.error} />
        <button className="btn block" form="task-form" disabled={action.isPending || !title.trim()}>Lưu</button>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn secondary grow" onClick={() => toggle(task, !task.completed)}>
            {task.completed ? 'Đánh dấu chưa xong' : 'Hoàn thành'}
          </button>
          <button type="button" className="btn danger grow" disabled={action.isPending}
            onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}>
            {confirmDelete ? (subtasks.length ? `Xóa cả ${subtasks.length} việc con?` : 'Bấm lần nữa để xóa') : 'Xóa'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/* ---------- Sheet danh sách ---------- */

export function ListSheet({ list, canDelete, onClose, onSaved }: {
  list?: TaskListInfo; canDelete: boolean; onClose: () => void; onSaved?: (board: TaskBoard) => void
}) {
  const action = useTaskAction()
  const [name, setName] = useState(list?.name ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    action.mutate(list
      ? { method: 'patch', path: `/api/task-lists/${list.id}`, body: { name: name.trim() } }
      : { method: 'post', path: '/api/task-lists', body: { name: name.trim() } },
    { onSuccess: (b) => { onSaved?.(b); onClose() } })
  }
  return (
    <Sheet title={list ? 'Đổi tên danh sách' : 'Danh sách mới'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus
          placeholder="Công việc, đi chợ, học tập..." aria-label="Tên danh sách" />
        <ErrorText error={action.error} />
        <button className="btn block" disabled={action.isPending || !name.trim()}>{list ? 'Lưu' : 'Tạo danh sách'}</button>
        {list && (
          canDelete ? (
            <button type="button" className="btn danger block" disabled={action.isPending}
              onClick={() => confirmDelete
                ? action.mutate({ method: 'del', path: `/api/task-lists/${list.id}` }, { onSuccess: (b) => { onSaved?.(b); onClose() } })
                : setConfirmDelete(true)}>
              {confirmDelete ? 'Xóa danh sách và mọi việc trong đó?' : 'Xóa danh sách'}
            </button>
          ) : <div className="small muted">Cần giữ lại ít nhất một danh sách.</div>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Thẻ ở màn Hôm nay ---------- */

export function TodayTasksCard() {
  const tasks = useTasks()
  const action = useTaskAction()
  const toggle = useToggleTask()
  const [editing, setEditing] = useState<Task | null>(null)
  const board = tasks.data
  if (!board) return null
  const { today } = board
  const due = board.tasks
    .filter((t) => !t.completed && t.dueDate && t.dueDate <= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || byPosition(a, b))
  const doneToday = board.tasks.filter((t) => t.completed && t.dueDate === today).length
  const total = due.length + doneToday
  const title = (id?: number) => board.tasks.find((t) => t.id === id)?.title
  const listName = (id: number) => board.lists.find((l) => l.id === id)?.name
  const live = editing && board.tasks.find((t) => t.id === editing.id)

  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2>Việc cần làm</h2>
        <Link to="/viec-can-lam" className="small">Tất cả <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
      </div>
      {total > 0 && (
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <div className="bar grow"><i style={{ width: `${(doneToday / total) * 100}%` }} /></div>
          <span className="small tnum muted"><b style={{ color: 'var(--text)' }}>{doneToday}</b>/{total}</span>
        </div>
      )}
      {due.length === 0 ? (
        <div className="small muted" style={{ padding: '8px 0' }}>
          {doneToday > 0 ? 'Xong hết việc hôm nay rồi 🎉' : 'Không có việc nào đến hạn hôm nay.'}
        </div>
      ) : (
        <div className="list">
          {due.map((t) => (
            <TaskRow key={t.id} task={t} today={today} onOpen={setEditing} onToggle={toggle}
              context={t.parentId != null ? `↳ ${title(t.parentId)}` : board.lists.length > 1 ? listName(t.listId) : undefined} />
          ))}
        </div>
      )}
      <QuickAdd placeholder="Thêm việc cho hôm nay" disabled={action.isPending}
        onAdd={(t) => action.mutate({ method: 'post', path: '/api/tasks', body: { listId: board.lists[0].id, title: t, dueDate: today } })} />
      <ErrorText error={action.error} />
      {live && <TaskSheet key={live.id} task={live} board={board} onClose={() => setEditing(null)} onOpen={setEditing} />}
    </div>
  )
}
