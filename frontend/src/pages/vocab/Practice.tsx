import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw, Shuffle, Undo2, X } from 'lucide-react'
import type { VocabCard } from '../../api/types'
import { useDeckCards } from '../../lib/queries'
import { SpeakButton, fold, grade, shuffle } from '../../components/vocab'
import { ErrorText, Loading, Ring, Segmented } from '../../components/ui'

export default function Practice() {
  const { deckId, mode } = useParams()
  const id = Number(deckId)
  const data = useDeckCards(id)
  if (mode !== 'the-ghi-nho' && mode !== 'kiem-tra') return <Navigate to={`/tu-vung/${id}`} replace />
  if (data.isLoading) return <Loading />
  if (data.error || !data.data) return <ErrorText error={data.error} />
  const { deck, cards } = data.data
  const title = mode === 'the-ghi-nho' ? 'Thẻ ghi nhớ' : 'Kiểm tra'

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Link to={`/tu-vung/${id}`} className="icon-btn plain" aria-label="Thoát"><ArrowLeft size={20} /></Link>
          <div style={{ minWidth: 0 }}>
            <h1 className="ellipsis" style={{ fontSize: 20 }}>{title}</h1>
            <div className="sub ellipsis">{deck.name}</div>
          </div>
        </div>
      </div>
      {cards.length === 0
        ? <div className="card"><div className="muted">Bộ thẻ chưa có thẻ nào.</div></div>
        : mode === 'the-ghi-nho'
          ? <Flashcards cards={cards} language={deck.language} />
          : <Quiz cards={cards} language={deck.language} />}
    </>
  )
}

/* ---------- Thẻ ghi nhớ (lật thẻ, vuốt trái/phải) ---------- */

function Flashcards({ cards, language }: { cards: VocabCard[]; language: string }) {
  const [shuffled, setShuffled] = useState(false)
  const [front, setFront] = useState<'term' | 'meaning'>('term')
  const [deck, setDeck] = useState(cards)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [marks, setMarks] = useState<boolean[]>([])
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)

  const restart = (list: VocabCard[], mix = shuffled) => {
    setDeck(mix ? shuffle(list) : list)
    setIndex(0); setMarks([]); setFlipped(false)
  }
  const mark = useCallback((known: boolean) => {
    if (index >= deck.length) return
    setMarks((m) => [...m, known])
    setIndex((i) => i + 1)
    setFlipped(false)
    setDrag(0)
  }, [index, deck.length])
  const undo = () => {
    if (index === 0) return
    setMarks((m) => m.slice(0, -1)); setIndex(index - 1); setFlipped(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setFlipped((f) => !f) }
      else if (e.key === 'ArrowLeft') mark(false)
      else if (e.key === 'ArrowRight') mark(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mark])

  const known = marks.filter(Boolean).length
  if (index >= deck.length) {
    const unknown = deck.filter((_, i) => !marks[i])
    return (
      <div className="card study-done">
        <Ring value={known} max={deck.length} size={120}>
          <div className="big">{Math.round((known / deck.length) * 100)}%</div>
        </Ring>
        <h2>Đã thuộc {known}/{deck.length} thẻ</h2>
        <p className="muted">{unknown.length ? `Còn ${unknown.length} thẻ chưa thuộc, học lại ngay cho nhớ.` : 'Thuộc hết rồi, tuyệt vời!'}</p>
        <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {unknown.length > 0 && <button className="btn" onClick={() => restart(unknown)}>Học lại {unknown.length} thẻ chưa thuộc</button>}
          <button className="btn secondary" onClick={() => restart(cards)}><RotateCcw size={16} /> Làm lại từ đầu</button>
        </div>
      </div>
    )
  }

  const c = deck[index]
  const faces = { term: <TermFace card={c} language={language} />, meaning: <MeaningFace card={c} language={language} /> }
  const onDown = (e: PointerEvent) => { start.current = e.clientX }
  const onMove = (e: PointerEvent) => { if (start.current != null) setDrag(e.clientX - start.current) }
  const onUp = () => {
    const dx = drag
    start.current = null
    if (Math.abs(dx) > 90) mark(dx > 0)
    else { if (Math.abs(dx) < 6) setFlipped((f) => !f); setDrag(0) }
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className={`chip${shuffled ? ' on' : ''}`} onClick={() => { const s = !shuffled; setShuffled(s); restart(cards, s) }}>
            <Shuffle size={15} /> Trộn
          </button>
          <button className="chip" onClick={() => { setFront(front === 'term' ? 'meaning' : 'term'); setFlipped(false) }}>
            Mặt trước: {front === 'term' ? 'Từ' : 'Nghĩa'}
          </button>
        </div>
        <span className="small muted tnum">{index + 1}/{deck.length}</span>
      </div>
      <div className="bar" style={{ marginBottom: 14 }}><i style={{ width: `${(index / deck.length) * 100}%` }} /></div>

      <div className={`flip-wrap${drag > 40 ? ' lean-right' : drag < -40 ? ' lean-left' : ''}`}
        style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)`, transition: start.current == null ? 'transform .2s' : 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; setDrag(0) }}
        role="button" tabIndex={0} aria-label="Lật thẻ">
        <div className={`flip-card${flipped ? ' flipped' : ''}`}>
          <div className="flip-face">{faces[front]}</div>
          <div className="flip-face flip-back">{faces[front === 'term' ? 'meaning' : 'term']}</div>
        </div>
        <span className="swipe-tag tag-left">Chưa thuộc</span>
        <span className="swipe-tag tag-right">Đã thuộc</span>
      </div>

      <div className="flash-actions">
        <button className="round-btn r-again" onClick={() => mark(false)} aria-label="Chưa thuộc"><X size={24} /></button>
        <button className="icon-btn" onClick={undo} disabled={index === 0} aria-label="Quay lại thẻ trước"><Undo2 size={18} /></button>
        <button className="round-btn r-good" onClick={() => mark(true)} aria-label="Đã thuộc"><Check size={24} /></button>
      </div>
      <div className="small muted kbd-hint">Chạm để lật · vuốt phải nếu đã thuộc, trái nếu chưa · phím Space, ← →</div>
    </>
  )
}

function TermFace({ card, language }: { card: VocabCard; language: string }) {
  return (
    <>
      <div className="study-term" lang={language}>{card.term}</div>
      {card.pronunciation && <div className="muted">{card.pronunciation}</div>}
      <span onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <SpeakButton text={card.term} lang={language} size={22} />
      </span>
    </>
  )
}

function MeaningFace({ card, language }: { card: VocabCard; language: string }) {
  return (
    <>
      <div className="study-meaning">{card.meaning}</div>
      {card.example && <div className="study-example" lang={language}>“{card.example}”</div>}
    </>
  )
}

/* ---------- Kiểm tra (trắc nghiệm + tự luận) ---------- */

type Kind = 'choice' | 'write' | 'mixed'
type Dir = 'term' | 'meaning' | 'both'
interface Question { card: VocabCard; ask: 'term' | 'meaning'; type: 'choice' | 'write'; options: string[] }
interface Result { q: Question; correct: boolean; given: string }

const answerOf = (q: Question) => (q.ask === 'term' ? q.card.meaning : q.card.term)

function buildQuiz(cards: VocabCard[], kind: Kind, dir: Dir, count: number): Question[] {
  return shuffle(cards).slice(0, count).map((card, i) => {
    const ask: Question['ask'] = dir === 'both' ? (i % 2 ? 'meaning' : 'term') : dir
    const type: Question['type'] = kind === 'mixed' ? (Math.random() < 0.5 ? 'choice' : 'write') : kind
    const field = ask === 'term' ? 'meaning' : 'term'
    const correct = card[field]
    const seen = new Set([fold(correct)])
    const wrong: string[] = []
    for (const other of shuffle(cards)) {
      if (wrong.length >= 3) break
      const v = other[field]
      if (!seen.has(fold(v))) { seen.add(fold(v)); wrong.push(v) }
    }
    return { card, ask, type, options: shuffle([correct, ...wrong]) }
  })
}

function Quiz({ cards, language }: { cards: VocabCard[]; language: string }) {
  const [kind, setKind] = useState<Kind>('mixed')
  const [dir, setDir] = useState<Dir>('term')
  const [count, setCount] = useState(Math.min(10, cards.length))
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [results, setResults] = useState<Result[]>([])

  const start = (qs: Question[]) => { setQuestions(qs); setResults([]) }
  const counts = useMemo(() => [...new Set([10, 20, cards.length].filter((n) => n <= cards.length))], [cards.length])

  if (!questions) {
    return (
      <div className="card form">
        <div className="field"><span>Kiểu câu hỏi</span>
          <Segmented value={kind} onChange={setKind}
            options={[{ value: 'choice', label: 'Trắc nghiệm' }, { value: 'write', label: 'Tự luận' }, { value: 'mixed', label: 'Kết hợp' }]} />
        </div>
        <div className="field"><span>Hỏi bằng</span>
          <Segmented value={dir} onChange={setDir}
            options={[{ value: 'term', label: 'Từ → Nghĩa' }, { value: 'meaning', label: 'Nghĩa → Từ' }, { value: 'both', label: 'Cả hai' }]} />
        </div>
        <div className="field"><span>Số câu</span>
          <div className="chips">
            {counts.map((n) => (
              <button key={n} type="button" className={`chip${count === n ? ' on' : ''}`} onClick={() => setCount(n)}>
                {n === cards.length && n > 20 ? `Tất cả (${n})` : n}
              </button>
            ))}
          </div>
        </div>
        <button className="btn block" onClick={() => start(buildQuiz(cards, kind, dir, count))}>Bắt đầu</button>
      </div>
    )
  }

  if (results.length >= questions.length) {
    const right = results.filter((r) => r.correct).length
    const wrong = results.filter((r) => !r.correct)
    return (
      <>
        <div className="card study-done">
          <Ring value={right} max={results.length} size={120} color={right / results.length >= 0.8 ? 'var(--primary)' : 'var(--spend)'}>
            <div className="big">{Math.round((right / results.length) * 100)}%</div>
          </Ring>
          <h2>Đúng {right}/{results.length} câu</h2>
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {wrong.length > 0 && (
              <button className="btn" onClick={() => start(buildQuiz(wrong.map((r) => r.q.card), kind, dir, wrong.length))}>
                Làm lại {wrong.length} câu sai
              </button>
            )}
            <button className="btn secondary" onClick={() => setQuestions(null)}><RotateCcw size={16} /> Bài mới</button>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginBottom: 6 }}>Cần ôn thêm</h2>
            <div className="list">
              {wrong.map((r, i) => (
                <div key={i} className="vocab-row static">
                  <div className="grow">
                    <b className="vocab-term" lang={language}>{r.q.card.term}</b>
                    <div className="vocab-meaning">{r.q.card.meaning}</div>
                    {r.given && <div className="small danger-text">Bạn trả lời: {r.given}</div>}
                  </div>
                  <SpeakButton text={r.q.card.term} lang={language} size={18} />
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  const q = questions[results.length]
  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="small muted">Câu {results.length + 1}/{questions.length}</span>
        <span className="small tnum"><b className="c-due">{results.filter((r) => r.correct).length}</b> đúng · <b className="danger-text">{results.filter((r) => !r.correct).length}</b> sai</span>
      </div>
      <div className="bar" style={{ marginBottom: 14 }}><i style={{ width: `${(results.length / questions.length) * 100}%` }} /></div>
      <QuestionView key={results.length} q={q} language={language} onDone={(r) => setResults((rs) => [...rs, r])} />
    </>
  )
}

function QuestionView({ q, language, onDone }: { q: Question; language: string; onDone: (r: Result) => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [verdict, setVerdict] = useState<'exact' | 'accent' | 'wrong' | null>(null)
  const answer = answerOf(q)
  const prompt = q.ask === 'term' ? q.card.term : q.card.meaning
  const promptLang = q.ask === 'term' ? language : undefined
  const answered = verdict !== null

  // Enter có thể đến cùng lúc từ nút Tiếp tục và phím tắt: chỉ ghi nhận một lần
  const sent = useRef(false)
  const finish = useCallback((correct: boolean, given: string) => {
    if (sent.current) return
    sent.current = true
    onDone({ q, correct, given })
  }, [onDone, q])

  const choose = useCallback((opt: string) => {
    if (answered) return
    setPicked(opt)
    const ok = fold(opt) === fold(answer)
    setVerdict(ok ? 'exact' : 'wrong')
  }, [answered, answer])

  // Trắc nghiệm đúng: tự sang câu tiếp sau một nhịp ngắn
  useEffect(() => {
    if (q.type === 'choice' && verdict === 'exact') {
      const t = setTimeout(() => finish(true, picked ?? ''), 750)
      return () => clearTimeout(t)
    }
  }, [q.type, verdict, picked, finish])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (q.type === 'choice' && !answered && ['1', '2', '3', '4'].includes(e.key)) {
        const opt = q.options[Number(e.key) - 1]
        if (opt) choose(opt)
      } else if (answered && e.key === 'Enter') {
        finish(verdict !== 'wrong', q.type === 'choice' ? picked ?? '' : typed)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [q, answered, choose, finish, verdict, picked, typed])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (answered) return finish(verdict !== 'wrong', typed)
    setVerdict(grade(typed, answer))
  }

  return (
    <div className="card quiz-card">
      <div className="small muted">{q.ask === 'term' ? 'Nghĩa của từ này là gì?' : 'Từ nào có nghĩa này?'}</div>
      <div className="quiz-prompt">
        <span lang={promptLang}>{prompt}</span>
        {q.ask === 'term' && <SpeakButton text={q.card.term} lang={language} />}
      </div>

      {q.type === 'choice' ? (
        <div className="choice-grid">
          {q.options.map((opt, i) => {
            const isAnswer = fold(opt) === fold(answer)
            const cls = !answered ? '' : isAnswer ? ' right' : opt === picked ? ' wrong' : ' dim'
            return (
              <button key={i} className={`choice${cls}`} onClick={() => choose(opt)} disabled={answered && !isAnswer && opt !== picked}
                lang={q.ask === 'meaning' ? language : undefined}>
                <span className="choice-key">{i + 1}</span>{opt}
              </button>
            )
          })}
        </div>
      ) : (
        <form onSubmit={submit} className="form" style={{ marginTop: 8 }}>
          <input className={`input${verdict === 'wrong' ? ' input-wrong' : verdict ? ' input-right' : ''}`} value={typed}
            onChange={(e) => setTyped(e.target.value)} readOnly={answered} autoFocus autoComplete="off" autoCapitalize="off"
            autoCorrect="off" spellCheck={false} placeholder={q.ask === 'term' ? 'Gõ nghĩa' : 'Gõ từ'}
            lang={q.ask === 'meaning' ? language : 'vi'} aria-label="Câu trả lời" />
          {!answered && (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setVerdict('wrong')}>Không biết</button>
              <button className="btn grow" disabled={!typed.trim()}>Kiểm tra</button>
            </div>
          )}
        </form>
      )}

      {answered && !(q.type === 'choice' && verdict === 'exact') && (
        <div className={`quiz-feedback ${verdict === 'wrong' ? 'bad' : 'good'}`}>
          <div>
            <b>{verdict === 'exact' ? 'Chính xác!' : verdict === 'accent' ? 'Đúng, nhưng lưu ý dấu' : 'Chưa đúng'}</b>
            {verdict !== 'exact' && <div>Đáp án: <b lang={q.ask === 'meaning' ? language : undefined}>{answer}</b></div>}
            {q.card.example && <div className="small muted" lang={language}>“{q.card.example}”</div>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            {q.type === 'write' && verdict === 'wrong' && typed.trim() && (
              <button className="btn ghost sm" onClick={() => finish(true, typed)}>Tôi trả lời đúng</button>
            )}
            <button className="btn sm grow" autoFocus onClick={() => finish(verdict !== 'wrong', q.type === 'choice' ? picked ?? '' : typed)}>
              Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
