import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Archive, Check, Lightbulb, Pencil, Search, Tag, Trash2, X } from 'lucide-react'
import type { Note, NoteLabel } from '../api/types'
import { useNotes } from '../lib/queries'
import { Masonry, NoteCard, NoteComposer, NoteModal, matches, useNoteAction, type ToastInfo } from '../components/notes'
import { Toast } from '../components/tasks'
import { Empty, ErrorText, Loading, Sheet } from '../components/ui'

type View = 'notes' | 'archive' | 'trash' | number

export default function Notes() {
  const notes = useNotes()
  const action = useNoteAction()
  const [params, setParams] = useSearchParams()
  const [autoOpen] = useState(() => params.get('moi') === '1')
  const [view, setView] = useState<View>('notes')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [editLabels, setEditLabels] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [toast, setToast] = useState<ToastInfo | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  // Đến từ nút "Ghi chú mới" ở màn Hôm nay: mở sẵn ô soạn, rồi bỏ tham số khỏi địa chỉ
  useEffect(() => {
    if (params.has('moi')) setParams({}, { replace: true })
  }, [params, setParams])

  const board = notes.data
  // Nhãn đang xem bị xóa thì quay về Ghi chú
  useEffect(() => {
    if (typeof view === 'number' && board && !board.labels.some((l) => l.id === view)) setView('notes')
  }, [board, view])

  if (notes.isLoading) return <Loading />
  if (notes.error || !board) return <ErrorText error={notes.error} />

  const live = board.notes.filter((n) => !n.trashedAt)
  const trash = board.notes.filter((n) => n.trashedAt)
  const searching = q.trim().length > 0
  const label = typeof view === 'number' ? board.labels.find((l) => l.id === view) : undefined
  const opened = openId != null ? board.notes.find((n) => n.id === openId) : undefined
  const card = (n: Note) => (
    <NoteCard key={n.id} note={n} labels={board.labels} onOpen={(x) => setOpenId(x.id)} onToast={setToast} />
  )
  const go = (v: View) => { setView(v); setQ(''); setConfirmEmpty(false) }

  let content
  if (searching) {
    const found = live.filter((n) => matches(n, q, board.labels))
    content = found.length === 0
      ? <Empty emoji="🔍" title="Không tìm thấy ghi chú nào">Thử từ khóa khác, không cần gõ dấu</Empty>
      : <Sections notes={found} card={card} withArchived />
  } else if (view === 'archive') {
    const archived = live.filter((n) => n.archived)
    content = archived.length === 0
      ? <Empty emoji="🗄️" title="Chưa có ghi chú lưu trữ">Ghi chú lưu trữ sẽ nằm ở đây, không hiện ở màn chính</Empty>
      : <Masonry notes={archived} render={card} />
  } else if (view === 'trash') {
    content = (
      <>
        <div className="row between wrap trash-bar">
          <span className="small muted">Ghi chú trong thùng rác sẽ tự xóa sau 7 ngày.</span>
          {trash.length > 0 && (
            <button className="btn ghost sm" style={{ color: 'var(--danger)' }} disabled={action.isPending}
              onClick={() => {
                if (!confirmEmpty) return setConfirmEmpty(true)
                setConfirmEmpty(false)
                action.mutate({ method: 'del', path: '/api/notes/trash', optimistic: (b) => ({ ...b, notes: b.notes.filter((n) => !n.trashedAt) }) })
              }}>
              {confirmEmpty ? `Xóa vĩnh viễn ${trash.length} ghi chú?` : 'Dọn sạch thùng rác'}
            </button>
          )}
        </div>
        {trash.length === 0
          ? <Empty emoji="🗑️" title="Thùng rác trống" />
          : <Masonry notes={trash} render={card} />}
      </>
    )
  } else {
    const shown = label ? live.filter((n) => n.labelIds.includes(label.id)) : live.filter((n) => !n.archived)
    content = shown.length === 0
      ? (label
        ? <Empty emoji="🏷️" title={`Chưa có ghi chú nào gắn nhãn “${label.name}”`}>Ghi chú tạo ở đây sẽ tự gắn nhãn này</Empty>
        : <Empty emoji="💡" title="Ghi chú bạn thêm sẽ xuất hiện ở đây">Bấm “Ghi chú...” phía trên để bắt đầu</Empty>)
      : <Sections notes={shown} card={card} withArchived={!!label} />
  }

  const title = searching ? 'Tìm kiếm' : view === 'archive' ? 'Lưu trữ' : view === 'trash' ? 'Thùng rác' : label ? label.name : 'Ghi chú'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="sub">{live.filter((n) => !n.archived).length} ghi chú</div>
        </div>
        <button className="icon-btn" onClick={() => setEditLabels(true)} aria-label="Sửa nhãn" title="Sửa nhãn"><Pencil size={18} /></button>
      </div>

      <label className="note-search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ghi chú" aria-label="Tìm ghi chú" enterKeyHint="search" />
        {q && <button type="button" className="icon-btn plain" onClick={() => setQ('')} aria-label="Xóa tìm kiếm"><X size={18} /></button>}
      </label>

      <div className="scroll-x" style={{ margin: '12px 0' }} role="tablist" aria-label="Mục ghi chú">
        <Chip on={!searching && view === 'notes'} onClick={() => go('notes')}><Lightbulb size={15} /> Ghi chú</Chip>
        {board.labels.map((l) => (
          <Chip key={l.id} on={!searching && view === l.id} onClick={() => go(l.id)}><Tag size={14} /> {l.name}</Chip>
        ))}
        <Chip on={!searching && view === 'archive'} onClick={() => go('archive')}><Archive size={15} /> Lưu trữ</Chip>
        <Chip on={!searching && view === 'trash'} onClick={() => go('trash')}><Trash2 size={15} /> Thùng rác</Chip>
      </div>

      {!searching && (view === 'notes' || label) && (
        <NoteComposer key={label?.id ?? 'all'} labels={board.labels} labelId={label?.id} autoOpen={autoOpen && view === 'notes'} />
      )}
      <ErrorText error={action.error} />
      {content}

      {opened && <NoteModal key={opened.id} note={opened} labels={board.labels} onClose={() => setOpenId(null)} onToast={setToast} />}
      {editLabels && <LabelsSheet labels={board.labels} onClose={() => setEditLabels(false)} />}
      {toast && <Toast text={toast.text} onUndo={toast.undo} onClose={closeToast} />}
    </>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`chip${on ? ' on' : ''}`} role="tab" aria-selected={on} onClick={onClick}>{children}</button>
}

/** Đã ghim / Khác (/ Đã lưu trữ khi xem theo nhãn hoặc tìm kiếm). */
function Sections({ notes, card, withArchived }: { notes: Note[]; card: (n: Note) => React.ReactNode; withArchived?: boolean }) {
  const pinned = notes.filter((n) => n.pinned && !n.archived)
  const others = notes.filter((n) => !n.pinned && !n.archived)
  const archived = withArchived ? notes.filter((n) => n.archived) : []
  const groups = [
    { key: 'pinned', label: 'Đã ghim', items: pinned },
    { key: 'others', label: 'Khác', items: others },
    { key: 'archived', label: 'Đã lưu trữ', items: archived },
  ].filter((g) => g.items.length > 0)
  const showHeads = groups.length > 1 || pinned.length > 0
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="note-section">
          {showHeads && <div className="group-label">{g.label}</div>}
          <Masonry notes={g.items} render={card} />
        </section>
      ))}
    </>
  )
}

/* ---------- Sửa nhãn ---------- */

function LabelsSheet({ labels, onClose }: { labels: NoteLabel[]; onClose: () => void }) {
  const action = useNoteAction()
  const [name, setName] = useState('')
  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    action.mutate({ method: 'post', path: '/api/note-labels', body: { name: name.trim() } }, { onSuccess: () => setName('') })
  }
  return (
    <Sheet title="Sửa nhãn" onClose={onClose}>
      <form className="label-edit-row" onSubmit={create}>
        <Tag size={18} className="muted" />
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tạo nhãn mới" maxLength={50}
          aria-label="Tên nhãn mới" autoFocus />
        <button className="icon-btn" disabled={!name.trim() || action.isPending} aria-label="Tạo nhãn"><Check size={18} /></button>
      </form>
      {labels.map((l) => <LabelRow key={l.id} label={l} />)}
      <ErrorText error={action.error} />
      {labels.length === 0 && <div className="small muted" style={{ padding: '8px 2px' }}>Nhãn giúp gom ghi chú theo chủ đề: Nhà, Công việc, Đi chợ...</div>}
      <button className="btn block" style={{ marginTop: 16 }} onClick={onClose}>Xong</button>
    </Sheet>
  )
}

function LabelRow({ label }: { label: NoteLabel }) {
  const action = useNoteAction()
  const [name, setName] = useState(label.name)
  const [confirm, setConfirm] = useState(false)
  const dirty = name.trim() !== label.name && name.trim() !== ''
  const save = () => {
    if (!dirty) return setName(label.name)
    action.mutate({ method: 'patch', path: `/api/note-labels/${label.id}`, body: { name: name.trim() } },
      { onError: () => setName(label.name) })
  }
  return (
    <div className="label-edit-row">
      <button type="button" className={`icon-btn plain${confirm ? ' danger-text' : ''}`} disabled={action.isPending}
        aria-label={confirm ? `Bấm lần nữa để xóa nhãn ${label.name}` : `Xóa nhãn ${label.name}`}
        title={confirm ? 'Bấm lần nữa để xóa (ghi chú vẫn giữ nguyên)' : 'Xóa nhãn'}
        onClick={() => (confirm ? action.mutate({ method: 'del', path: `/api/note-labels/${label.id}` }) : setConfirm(true))}>
        <Trash2 size={18} />
      </button>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} aria-label="Tên nhãn"
        onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
      {dirty && <button type="button" className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={save} aria-label="Lưu tên nhãn"><Check size={18} /></button>}
      <ErrorText error={action.error} />
    </div>
  )
}
