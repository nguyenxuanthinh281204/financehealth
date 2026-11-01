import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Flame, Plus } from 'lucide-react'
import { useVocab } from '../../lib/queries'
import { DeckSheet, DueCounts, langInfo } from '../../components/vocab'
import { Empty, ErrorText, Loading } from '../../components/ui'

export default function Decks() {
  const vocab = useVocab()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(params.get('moi') === '1')
  useEffect(() => {
    if (params.has('moi')) setParams({}, { replace: true })
  }, [params, setParams])

  if (vocab.isLoading) return <Loading />
  if (vocab.error || !vocab.data) return <ErrorText error={vocab.error} />
  const o = vocab.data
  const sum = (k: 'newCount' | 'learning' | 'due') => o.decks.reduce((s, d) => s + d[k], 0)
  const left = sum('newCount') + sum('learning') + sum('due')
  const totalCards = o.decks.reduce((s, d) => s + d.total, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Từ vựng</h1>
          <div className="sub">{o.decks.length} bộ · {totalCards} thẻ</div>
        </div>
        <button className="btn sm" onClick={() => setCreating(true)}><Plus size={16} /> Bộ mới</button>
      </div>

      {o.decks.length > 0 && (
        <div className="card vocab-hero" style={{ marginBottom: 12 }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 18 }}>
              <div className="stat">
                <div className="label">Cần học hôm nay</div>
                <div className="value">{left}</div>
              </div>
              <div className="stat">
                <div className="label">Đã ôn hôm nay</div>
                <div className="value">{o.reviewedToday}</div>
              </div>
              <div className="stat">
                <div className="label">Chuỗi ngày</div>
                <div className="value row" style={{ gap: 4 }}><Flame size={20} color="var(--spend)" /> {o.streak}</div>
              </div>
            </div>
            <Link to="/tu-vung/on-tap" className={`btn${left ? '' : ' secondary'}`} aria-disabled={!left}>
              {left ? 'Ôn tất cả' : 'Đã học xong hôm nay'}
            </Link>
          </div>
        </div>
      )}

      {o.decks.length === 0 ? (
        <div className="card">
          <Empty emoji="🗂️" title="Chưa có bộ thẻ nào">
            Tạo một bộ, thêm từ hoặc dán cả danh sách từ Quizlet/Anki/Excel, rồi ôn mỗi ngày.
          </Empty>
          <button className="btn block" onClick={() => setCreating(true)}><Plus size={18} /> Tạo bộ thẻ</button>
        </div>
      ) : (
        <div className="grid grid-md-2">
          {o.decks.map((d) => {
            const todo = d.newCount + d.learning + d.due
            const lang = langInfo(d.language)
            return (
              <div key={d.id} className="card deck-card">
                <Link to={`/tu-vung/${d.id}`} className="deck-card-main">
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <h2 className="ellipsis">{d.name}</h2>
                      <div className="small muted ellipsis">{lang.flag} {lang.label} · {d.total} thẻ{d.description ? ` · ${d.description}` : ''}</div>
                    </div>
                    <ChevronRight size={18} className="muted" />
                  </div>
                  <div className="deck-progress" aria-label={`${d.mature} thẻ đã nhớ lâu, ${d.total - d.unseen} thẻ đã học`}>
                    <i className="p-mature" style={{ width: `${d.total ? (d.mature / d.total) * 100 : 0}%` }} />
                    <i className="p-young" style={{ width: `${d.total ? ((d.total - d.unseen - d.mature) / d.total) * 100 : 0}%` }} />
                  </div>
                </Link>
                <div className="row between">
                  <DueCounts newCount={d.newCount} learning={d.learning} due={d.due} />
                  <button className="btn sm" disabled={!todo} onClick={() => navigate(`/tu-vung/on-tap?bo=${d.id}`)}>
                    {todo ? 'Học' : 'Xong hôm nay'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {o.decks.length > 0 && (
        <div className="small muted legend-row">
          <span><b className="c-new">●</b> Thẻ mới</span>
          <span><b className="c-learn">●</b> Đang học</span>
          <span><b className="c-due">●</b> Cần ôn</span>
        </div>
      )}

      {creating && (
        <DeckSheet onClose={() => setCreating(false)} onSaved={(next) => {
          const known = new Set(o.decks.map((d) => d.id))
          const created = next.decks.find((d) => !known.has(d.id))
          if (created) navigate(`/tu-vung/${created.id}`)
        }} />
      )}
    </>
  )
}
