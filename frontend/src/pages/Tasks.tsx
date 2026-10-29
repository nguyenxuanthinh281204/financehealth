import { useCallback, useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Pencil, Plus, Star } from 'lucide-react'
import type { Task, TaskBoard } from '../api/types'
import { useTasks } from '../lib/queries'
import {
  ListSheet, QuickAdd, TaskRow, TaskSheet, Toast, childrenOf, groupByDue, openTopLevel, useTaskAction, useToggleTask, withOrder,
} from '../components/tasks'
import { Empty, ErrorText, Loading, Segmented } from '../components/ui'

const STARRED = 'starred'
type View = number | typeof STARRED
type Sort = 'manual' | 'date'

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* trình duyệt chặn storage */ } },
}

export default function Tasks() {
  const tasks = useTasks()
  const action = useTaskAction()
  const toggleTask = useToggleTask()
  const [view, setViewState] = useState<View>(() => {
    const v = store.get('fh.taskView')
    return v === STARRED ? STARRED : Number(v) || 0
  })
  const [sort, setSortState] = useState<Sort>(() => (store.get('fh.taskSort') === 'date' ? 'date' : 'manual'))
  const [editing, setEditing] = useState<Task | null>(null)
  const [listSheet, setListSheet] = useState<'new' | 'edit' | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  const setView = (v: View) => { setViewState(v); store.set('fh.taskView', String(v)); setConfirmClear(false) }
  const setSort = (s: Sort) => { setSortState(s); store.set('fh.taskSort', s) }

  const toggle = (t: Task, done: boolean) => {
    toggleTask(t, done)
    if (done) setToast({ text: `Đã hoàn thành “${t.title}”`, undo: () => toggleTask(t, false) })
  }

  const board = tasks.data
  if (tasks.isLoading) return <Loading />
  if (tasks.error || !board) return <ErrorText error={tasks.error} />

  const list = view === STARRED ? undefined : board.lists.find((l) => l.id === view) ?? board.lists[0]
  const today = board.today
  const live = editing && board.tasks.find((t) => t.id === editing.id)
  const openCount = (listId: number) => board.tasks.filter((t) => t.listId === listId && !t.completed).length
  const listName = (id: number) => board.lists.find((l) => l.id === id)?.name

  const add = (title: string) => action.mutate({
    method: 'post', path: '/api/tasks',
    body: list ? { listId: list.id, title } : { listId: board.lists[0].id, title, starred: true },
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Việc cần làm</h1>
          <div className="sub">{board.tasks.filter((t) => !t.completed).length} việc chưa xong</div>
        </div>
        {list && (
          <button className="icon-btn" onClick={() => setListSheet('edit')} aria-label={`Sửa danh sách ${list.name}`}><Pencil size={18} /></button>
        )}
      </div>

      <div className="scroll-x" style={{ marginBottom: 12 }} role="tablist" aria-label="Danh sách">
        <button className={`chip${view === STARRED ? ' on' : ''}`} role="tab" aria-selected={view === STARRED}
          onClick={() => setView(STARRED)} aria-label="Có gắn sao"><Star size={15} /></button>
        {board.lists.map((l) => (
          <button key={l.id} className={`chip${list?.id === l.id ? ' on' : ''}`} role="tab" aria-selected={list?.id === l.id}
            onClick={() => setView(l.id)}>
            {l.name} {openCount(l.id) > 0 && <span className="chip-count">{openCount(l.id)}</span>}
          </button>
        ))}
        <button className="chip" onClick={() => setListSheet('new')}><Plus size={15} /> Danh sách mới</button>
      </div>

      <div className="card">
        <QuickAdd placeholder={list ? 'Thêm việc' : 'Thêm việc gắn sao'} onAdd={add} />
        <ErrorText error={action.error} />
        {list
          ? <ListView board={board} listId={list.id} sort={sort} setSort={setSort} onOpen={setEditing} onToggle={toggle} />
          : <StarredView board={board} onOpen={setEditing} onToggle={toggle} listName={listName} />}
      </div>

      {list && (() => {
        const done = board.tasks
          .filter((t) => t.listId === list.id && t.completed && (t.parentId == null || !board.tasks.find((p) => p.id === t.parentId)?.completed))
          .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        if (done.length === 0) return null
        return (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row between">
              <button className="done-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
                <ChevronDown size={18} style={{ transform: showDone ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                Đã hoàn thành ({done.length})
              </button>
              {showDone && (
                <button className="btn ghost sm" disabled={action.isPending}
                  onClick={() => {
                    if (!confirmClear) return setConfirmClear(true)
                    setConfirmClear(false)
                    action.mutate({ method: 'del', path: `/api/task-lists/${list.id}/completed` })
                  }}>
                  {confirmClear ? 'Bấm lần nữa để xóa' : 'Xóa tất cả'}
                </button>
              )}
            </div>
            {showDone && (
              <div className="list" style={{ marginTop: 4 }}>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onOpen={setEditing} onToggle={toggle}
                    context={t.parentId != null ? `↳ ${board.tasks.find((p) => p.id === t.parentId)?.title}` : undefined} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {live && <TaskSheet key={live.id} task={live} board={board} onClose={() => setEditing(null)} onOpen={setEditing} />}
      {listSheet && (
        <ListSheet list={listSheet === 'edit' ? list : undefined} canDelete={board.lists.length > 1}
          onClose={() => setListSheet(null)}
          onSaved={(b) => {
            if (listSheet === 'new') {
              const known = new Set(board.lists.map((l) => l.id))
              const created = b.lists.find((l) => !known.has(l.id))
              if (created) setView(created.id)
            } else if (!b.lists.some((l) => l.id === list?.id)) setView(b.lists[0].id)
          }} />
      )}
      {toast && <Toast text={toast.text} onUndo={toast.undo} onClose={closeToast} />}
    </>
  )
}

type RowHandlers = { onOpen: (t: Task) => void; onToggle: (t: Task, done: boolean) => void }

function ListView({ board, listId, sort, setSort, ...h }: RowHandlers & {
  board: TaskBoard; listId: number; sort: Sort; setSort: (s: Sort) => void
}) {
  const top = openTopLevel(board, listId)
  const hasDue = top.some((t) => t.dueDate)
  return (
    <>
      {top.length > 1 && (
        <div style={{ margin: '4px 0 6px' }}>
          <Segmented value={sort} onChange={setSort}
            options={[{ value: 'manual', label: 'Thứ tự của tôi' }, { value: 'date', label: 'Theo ngày hạn' }]} />
        </div>
      )}
      {top.length === 0 ? (
        <Empty emoji="📝" title="Chưa có việc nào">Gõ vào ô phía trên rồi bấm Enter để thêm</Empty>
      ) : sort === 'date' && hasDue ? (
        groupByDue(top, board.today).map((g) => (
          <div key={g.key}>
            <div className={`group-label due-group ${g.tone}`}>{g.label}</div>
            {g.items.map((t) => <TaskBlock key={t.id} board={board} task={t} {...h} />)}
          </div>
        ))
      ) : (
        <Sortable ids={top.map((t) => t.id)} listId={listId}>
          {top.map((t) => <TaskBlock key={t.id} board={board} task={t} sortable {...h} />)}
        </Sortable>
      )}
    </>
  )
}

/** Việc chính kèm các việc con chưa xong ngay bên dưới; kéo việc chính thì việc con đi theo. */
function TaskBlock({ board, task, sortable, ...h }: RowHandlers & { board: TaskBoard; task: Task; sortable?: boolean }) {
  const subs = childrenOf(board, task.id).filter((s) => !s.completed)
  const s = useSortable({ id: task.id, disabled: !sortable })
  const style = sortable ? { transform: CSS.Translate.toString(s.transform), transition: s.transition } : undefined
  return (
    <div ref={s.setNodeRef} style={style} className={`task-block${s.isDragging ? ' dragging' : ''}`}>
      <TaskRow task={task} today={board.today} subCount={childrenOf(board, task.id).length} {...h}
        handle={sortable && <DragHandle {...s.attributes} {...s.listeners} />} />
      {subs.length > 0 && (
        <Sortable ids={subs.map((x) => x.id)} listId={task.listId} parentId={task.id}>
          {subs.map((x) => <SubRow key={x.id} task={x} today={board.today} sortable={sortable} {...h} />)}
        </Sortable>
      )}
    </div>
  )
}

function SubRow({ task, today, sortable, ...h }: RowHandlers & { task: Task; today: string; sortable?: boolean }) {
  const s = useSortable({ id: task.id, disabled: !sortable })
  return (
    <TaskRow task={task} today={today} sub {...h} rowRef={s.setNodeRef} dragging={s.isDragging}
      style={sortable ? { transform: CSS.Translate.toString(s.transform), transition: s.transition } : undefined}
      handle={sortable && <DragHandle {...s.attributes} {...s.listeners} />} />
  )
}

function DragHandle(props: Record<string, unknown>) {
  return <button type="button" className="drag-handle" aria-label="Kéo để sắp xếp" {...props}><GripVertical size={18} /></button>
}

/** Kéo thả trong một cấp (việc chính của danh sách, hoặc việc con của một việc). */
function Sortable({ ids, listId, parentId, children }: { ids: number[]; listId: number; parentId?: number; children: React.ReactNode }) {
  const action = useTaskAction()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)))
    action.mutate({ method: 'put', path: '/api/tasks/order', body: { listId, parentId, ids: next }, optimistic: (b) => withOrder(b, next) })
  }
  // Phần mô tả cho trình đọc màn hình đặt ở body để không chen vào giữa các dòng việc
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{ container: document.body }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  )
}

function StarredView({ board, listName, ...h }: RowHandlers & { board: TaskBoard; listName: (id: number) => string | undefined }) {
  const starred = board.tasks.filter((t) => t.starred && !t.completed)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.listId - b.listId || a.position - b.position)
  if (starred.length === 0) return <Empty emoji="⭐" title="Chưa có việc gắn sao">Bấm ngôi sao ở một việc để đưa vào đây</Empty>
  const parentTitle = (id?: number) => board.tasks.find((t) => t.id === id)?.title
  return (
    <div className="list">
      {starred.map((t) => (
        <TaskRow key={t.id} task={t} today={board.today} {...h}
          context={[listName(t.listId), t.parentId != null ? `↳ ${parentTitle(t.parentId)}` : null].filter(Boolean).join(' · ')} />
      ))}
    </div>
  )
}
