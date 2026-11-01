import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react'
import { api } from '../../api/client'
import type { StudyCard, StudyQueue } from '../../api/types'
import { keys, useStudy, useVocab } from '../../lib/queries'
import { DueCounts, SpeakButton, speak } from '../../components/vocab'
import { ErrorText, Loading } from '../../components/ui'

const RATINGS = [
  { value: 1, label: 'Quên', tone: 'again' },
  { value: 2, label: 'Khó', tone: 'hard' },
  { value: 3, label: 'Được', tone: 'good' },
  { value: 4, label: 'Dễ', tone: 'easy' },
] as const

const AUTO_KEY = 'fh.vocabAutoSpeak'
const store = {
  get: () => { try { return localStorage.getItem(AUTO_KEY) === '1' } catch { return false } },
  set: (v: boolean) => { try { localStorage.setItem(AUTO_KEY, v ? '1' : '0') } catch { /* trình duyệt chặn storage */ } },
}

/** Đưa thẻ đang xem lên đầu để câu trả lời của máy chủ không làm đổi thẻ trước mắt người học. */
function keepHead(queue: StudyCard[], headId?: number) {
  if (headId == null) return queue
  const i = queue.findIndex((s) => s.card.id === headId)
  return i <= 0 ? queue : [queue[i], ...queue.slice(0, i), ...queue.slice(i + 1)]
}

export default function Study() {
  const [params] = useSearchParams()
  const deckId = Number(params.get('bo')) || undefined
  const study = useStudy(deckId)
  const vocab = useVocab()
  const qc = useQueryClient()
  const [queue, setQueue] = useState<StudyCard[] | null>(null)
  const [nextAt, setNextAt] = useState<string | undefined>()
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [autoSpeak, setAutoSpeak] = useState(store.get)
  const pending = useRef(0)
  const headRef = useRef<number | undefined>(undefined)

  const loaded = useRef(false)
  useEffect(() => {
    if (study.data && !loaded.current) {
      loaded.current = true
      setQueue(study.data.queue)
      setNextAt(study.data.nextAt)
    }
  }, [study.data])
  // Rời trang thì làm mới số đếm ở danh sách bộ thẻ và màn Hôm nay
  useEffect(() => () => { qc.invalidateQueries({ queryKey: keys.vocab }) }, [qc])

  const review = useMutation({
    // Giảm bộ đếm trước onSuccess để biết đây có phải câu trả lời cuối cùng đang chờ không
    mutationFn: ({ cardId, rating }: { cardId: number; rating: number }) =>
      api.post<StudyQueue>(`/api/vocab/cards/${cardId}/review`, { rating, deckId }).finally(() => { pending.current-- }),
    onError: () => { reload() },
    onSuccess: (s) => {
      if (pending.current > 0) return
      setQueue(keepHead(s.queue, headRef.current))
      setNextAt(s.nextAt)
    },
  })

  async function reload() {
    const r = await study.refetch()
    setQueue(r.data?.queue ?? [])
    setNextAt(r.data?.nextAt)
  }

  const current = queue?.[0]
  headRef.current = current?.card.id
  const language = current?.language ?? 'en-US'

  useEffect(() => {
    if (current && autoSpeak) speak(current.card.term, current.language)
  }, [current, autoSpeak])

  const answer = useCallback((rating: number) => {
    if (!current) return
    pending.current++
    review.mutate({ cardId: current.card.id, rating })
    setQueue((q) => (q ? q.slice(1) : q))
    setRevealed(false)
    setDone((n) => n + 1)
  }, [current, review])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (revealed) answer(3)
        else setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        answer(Number(e.key))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, revealed, answer])

  const deckName = deckId ? vocab.data?.decks.find((d) => d.id === deckId)?.name : 'Tất cả bộ thẻ'
  const back = deckId ? `/tu-vung/${deckId}` : '/tu-vung'

  const head = (
    <div className="page-head">
      <div className="row" style={{ gap: 8, minWidth: 0 }}>
        <Link to={back} className="icon-btn plain" aria-label="Thoát"><ArrowLeft size={20} /></Link>
        <div style={{ minWidth: 0 }}>
          <h1 className="ellipsis" style={{ fontSize: 20 }}>{deckName ?? 'Ôn tập'}</h1>
          <div className="sub">Đã ôn {done} thẻ phiên này</div>
        </div>
      </div>
      <button className="icon-btn" onClick={() => { setAutoSpeak(!autoSpeak); store.set(!autoSpeak) }}
        aria-pressed={autoSpeak} aria-label="Tự đọc từ khi hiện thẻ" title="Tự đọc từ khi hiện thẻ">
        {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </div>
  )

  if (study.error) return <>{head}<ErrorText error={study.error} /></>
  if (!queue || (queue.length === 0 && pending.current > 0)) return <>{head}<Loading /></>

  if (!current) {
    const at = nextAt ? new Date(nextAt) : null
    return (
      <>
        {head}
        <div className="card study-done">
          <div className="em">🎉</div>
          <h2>{done > 0 ? 'Hoàn thành phiên ôn tập!' : 'Không còn thẻ nào cần học'}</h2>
          <p className="muted">
            {done > 0 ? `Bạn vừa ôn ${done} thẻ. ` : ''}
            {at ? `Còn thẻ đang học sẽ đến lượt lúc ${at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`
              : 'Hẹn bạn ngày mai với các thẻ đến hạn tiếp theo.'}
          </p>
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {at && <button className="btn secondary" onClick={() => { setQueue(null); reload() }}>Kiểm tra lại</button>}
            {deckId && <Link to={`/tu-vung/${deckId}/kiem-tra`} className="btn secondary">Luyện thêm</Link>}
            <Link to={back} className="btn">Xong</Link>
          </div>
        </div>
      </>
    )
  }

  const c = current.card
  const counts = {
    newCount: queue.filter((s) => s.card.state === 'NEW').length,
    learning: queue.filter((s) => s.card.state === 'LEARNING' || s.card.state === 'RELEARNING').length,
    due: queue.filter((s) => s.card.state === 'REVIEW').length,
  }
  const active = c.state === 'NEW' ? 'new' : c.state === 'REVIEW' ? 'due' : 'learn'

  return (
    <>
      {head}
      <div className="study-counts"><DueCounts {...counts} active={active} /></div>

      <div className="card study-card" onClick={() => !revealed && setRevealed(true)}>
        <div className="study-front">
          <div className="study-term" lang={language}>{c.term}</div>
          {c.pronunciation && <div className="muted">{c.pronunciation}</div>}
          <SpeakButton text={c.term} lang={language} size={22} />
        </div>
        {revealed && (
          <div className="study-back">
            <div className="study-meaning">{c.meaning}</div>
            {c.example && <div className="study-example" lang={language}>“{c.example}”</div>}
          </div>
        )}
      </div>

      <div className="study-actions">
        {revealed ? (
          <div className="rate-grid">
            {RATINGS.map((r, i) => (
              <button key={r.value} className={`rate-btn r-${r.tone}`} onClick={() => answer(r.value)}>
                <small>{current.intervals[i]}</small>
                {r.label}
              </button>
            ))}
          </div>
        ) : (
          <button className="btn block study-reveal" onClick={() => setRevealed(true)}>Hiện đáp án</button>
        )}
        <div className="small muted kbd-hint">Phím tắt: Space để lật thẻ, 1–4 để chấm (Space = Được)</div>
      </div>
      <ErrorText error={review.error} />
    </>
  )
}
