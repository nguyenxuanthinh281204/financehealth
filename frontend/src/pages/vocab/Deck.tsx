import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Brain, ClipboardList, Layers, Plus, Search, Settings2, Upload } from 'lucide-react'
import type { VocabCard } from '../../api/types'
import { useDeckCards, useVocab } from '../../lib/queries'
import { CardSheet, DeckSheet, DueCounts, ImportSheet, SpeakButton, cardStatus, fold } from '../../components/vocab'
import { Empty, ErrorText, Loading } from '../../components/ui'

const PAGE = 100

export default function Deck() {
  const deckId = Number(useParams().deckId)
  const navigate = useNavigate()
  const data = useDeckCards(deckId)
  const vocab = useVocab()
  const [sheet, setSheet] = useState<'add' | 'import' | 'settings' | null>(null)
  const [editing, setEditing] = useState<VocabCard | null>(null)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    const cards = data.data?.cards ?? []
    const q = fold(query)
    return q ? cards.filter((c) => fold(`${c.term} ${c.meaning} ${c.example ?? ''}`).includes(q)) : cards
  }, [data.data, query])

  if (data.isLoading) return <Loading />
  if (data.error || !data.data) {
    return (
      <>
        <ErrorText error={data.error} />
        <Link to="/tu-vung" className="btn secondary" style={{ marginTop: 12 }}>Về danh sách bộ thẻ</Link>
      </>
    )
  }
  const { deck, cards } = data.data
  const todo = deck.newCount + deck.learning + deck.due
  const decks = vocab.data?.decks ?? [deck]
  const learned = deck.total - deck.unseen

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Link to="/tu-vung" className="icon-btn plain" aria-label="Quay lại"><ArrowLeft size={20} /></Link>
          <div style={{ minWidth: 0 }}>
            <h1 className="ellipsis">{deck.name}</h1>
            <div className="sub">{deck.total} thẻ · đã học {learned} · nhớ lâu {deck.mature}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setSheet('settings')} aria-label="Cài đặt bộ thẻ"><Settings2 size={18} /></button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <div>
            <div className="small muted">Hôm nay</div>
            <DueCounts newCount={deck.newCount} learning={deck.learning} due={deck.due} />
          </div>
          <button className="btn" disabled={!todo} onClick={() => navigate(`/tu-vung/on-tap?bo=${deck.id}`)}>
            <Brain size={18} /> {todo ? `Ôn tập (${todo})` : 'Xong hôm nay'}
          </button>
        </div>
        <div className="mode-grid">
          <button className="mode-btn" disabled={cards.length === 0} onClick={() => navigate(`/tu-vung/${deck.id}/the-ghi-nho`)}>
            <Layers size={20} /> <span>Thẻ ghi nhớ</span><small>Lật thẻ, tự đánh giá</small>
          </button>
          <button className="mode-btn" disabled={cards.length < 2} onClick={() => navigate(`/tu-vung/${deck.id}/kiem-tra`)}>
            <ClipboardList size={20} /> <span>Kiểm tra</span><small>Trắc nghiệm & gõ đáp án</small>
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>Ôn tập theo lịch lặp lại ngắt quãng; hai chế độ luyện không làm thay đổi lịch ôn.</div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Thẻ ({cards.length})</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn secondary sm" onClick={() => setSheet('import')}><Upload size={15} /> Nhập</button>
            <button className="btn sm" onClick={() => setSheet('add')}><Plus size={15} /> Thêm</button>
          </div>
        </div>
        {cards.length > 8 && (
          <label className="vocab-search">
            <Search size={18} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} placeholder="Tìm từ hoặc nghĩa" aria-label="Tìm thẻ" />
          </label>
        )}
        {cards.length === 0 ? (
          <Empty emoji="✍️" title="Bộ thẻ còn trống">Bấm Thêm để nhập từng từ, hoặc Nhập để dán cả danh sách.</Empty>
        ) : filtered.length === 0 ? (
          <Empty emoji="🔍" title="Không tìm thấy thẻ nào" />
        ) : (
          <div className="list">
            {filtered.slice(0, limit).map((c) => {
              const st = cardStatus(c)
              return (
                <div key={c.id} className="vocab-row" role="button" tabIndex={0} onClick={() => setEditing(c)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditing(c)}>
                  <div className="grow">
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <b className="vocab-term" lang={deck.language}>{c.term}</b>
                      {c.pronunciation && <span className="small muted">{c.pronunciation}</span>}
                    </div>
                    <div className="vocab-meaning">{c.meaning}</div>
                  </div>
                  <span className={`state-badge s-${st.tone}`}>{st.label}</span>
                  <SpeakButton text={c.term} lang={deck.language} size={18} />
                </div>
              )
            })}
          </div>
        )}
        {filtered.length > limit && (
          <button className="btn ghost block" onClick={() => setLimit(limit + PAGE)}>Hiện thêm ({filtered.length - limit})</button>
        )}
      </div>

      {sheet === 'settings' && <DeckSheet deck={deck} onClose={() => setSheet(null)} onDeleted={() => navigate('/tu-vung', { replace: true })} />}
      {sheet === 'import' && <ImportSheet deck={deck} onClose={() => setSheet(null)} />}
      {sheet === 'add' && <CardSheet deckId={deck.id} decks={decks} language={deck.language} onClose={() => setSheet(null)} />}
      {editing && (
        <CardSheet key={editing.id} deckId={deck.id} card={editing} decks={decks} language={deck.language} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
