import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Flame, Volume2 } from 'lucide-react'
import { api } from '../api/client'
import type { CardInput, DeckInput, VocabCard, VocabDeck, VocabOverview } from '../api/types'
import { keys, useVocab } from '../lib/queries'
import { ErrorText, Sheet } from './ui'

/* ---------- Ngôn ngữ & phát âm ---------- */

export const LANGUAGES = [
  { code: 'en-US', label: 'Tiếng Anh', flag: '🇬🇧' },
  { code: 'ja-JP', label: 'Tiếng Nhật', flag: '🇯🇵' },
  { code: 'ko-KR', label: 'Tiếng Hàn', flag: '🇰🇷' },
  { code: 'zh-CN', label: 'Tiếng Trung', flag: '🇨🇳' },
  { code: 'fr-FR', label: 'Tiếng Pháp', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Tiếng Đức', flag: '🇩🇪' },
  { code: 'es-ES', label: 'Tiếng Tây Ban Nha', flag: '🇪🇸' },
  { code: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
]
export const langInfo = (code: string) => LANGUAGES.find((l) => l.code === code) ?? { code, label: code, flag: '🌐' }

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Đọc to bằng giọng của trình duyệt, chọn giọng khớp ngôn ngữ của bộ thẻ nếu có. */
export function speak(text: string, lang: string) {
  if (!canSpeak || !text) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const base = lang.split('-')[0]
  const voice = synth.getVoices().find((v) => v.lang.replace('_', '-') === lang) ?? synth.getVoices().find((v) => v.lang.startsWith(base))
  if (voice) u.voice = voice
  u.rate = 0.9
  synth.speak(u)
}

export function SpeakButton({ text, lang, size = 20 }: { text: string; lang: string; size?: number }) {
  if (!canSpeak) return null
  return (
    <button type="button" className="icon-btn plain speak-btn" aria-label={`Phát âm ${text}`}
      onClick={(e) => { e.stopPropagation(); speak(text, lang) }}>
      <Volume2 size={size} />
    </button>
  )
}

/* ---------- Dữ liệu ---------- */

/** Mọi thay đổi bộ thẻ/thẻ đều làm mới cả cụm dữ liệu từ vựng. */
export function useVocabMutation<T = unknown>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ method, path, body }: { method: 'post' | 'patch' | 'del'; path: string; body?: unknown }) =>
      method === 'del' ? api.del<T>(path) : api[method]<T>(path, body),
    onSuccess: (data, v) => {
      // Các API bộ thẻ trả về tổng quan mới nhất
      if (v.path.startsWith('/api/vocab/decks') && data && typeof data === 'object' && 'decks' in data) {
        qc.setQueryData(keys.vocab, data as unknown as VocabOverview)
      }
      qc.invalidateQueries({ queryKey: keys.vocab })
    },
  })
}

/** Bỏ dấu, chữ thường, gộp khoảng trắng, bỏ dấu câu ở hai đầu: dùng để chấm câu tự luận và tìm kiếm. */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/\s+/g, ' ').replace(/^[\s.,!?;:'"()-]+|[\s.,!?;:'"()-]+$/g, '').trim()

const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/^[\s.,!?;:'"()-]+|[\s.,!?;:'"()-]+$/g, '').trim()

/**
 * Chấm câu tự luận. Đáp án có nhiều nghĩa ngăn bằng , ; / thì trúng một nghĩa là đúng.
 * Đúng cả dấu → 'exact'; chỉ sai dấu tiếng Việt → 'accent'; còn lại 'wrong'.
 */
export function grade(input: string, answer: string): 'exact' | 'accent' | 'wrong' {
  const given = clean(input)
  if (!given) return 'wrong'
  const options = [answer, ...answer.split(/[,;/]/)].map(clean).filter(Boolean)
  if (options.includes(given)) return 'exact'
  if (options.map(fold).includes(fold(given))) return 'accent'
  return 'wrong'
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Trạng thái thẻ như Anki: mới, đang học, ôn sau N ngày, đã nhớ lâu. */
export function cardStatus(c: VocabCard, now = Date.now()): { label: string; tone: 'new' | 'learn' | 'due' | 'young' | 'mature' } {
  if (c.state === 'NEW') return { label: 'Mới', tone: 'new' }
  if (c.state !== 'REVIEW') return { label: c.state === 'RELEARNING' ? 'Học lại' : 'Đang học', tone: 'learn' }
  const due = c.dueAt ? new Date(c.dueAt).getTime() : now
  if (due <= now) return { label: 'Đến hạn', tone: 'due' }
  const days = Math.max(1, Math.round((due - now) / 86_400_000))
  return { label: `Ôn sau ${days} ngày`, tone: c.intervalDays >= 21 ? 'mature' : 'young' }
}

/** Ba con số kiểu Anki: thẻ mới (xanh dương), đang học (cam), đến hạn ôn (xanh lá). */
export function DueCounts({ newCount, learning, due, active }: {
  newCount: number; learning: number; due: number; active?: 'new' | 'learn' | 'due'
}) {
  return (
    <span className="due-counts tnum" aria-label={`${newCount} thẻ mới, ${learning} đang học, ${due} cần ôn`}>
      <b className={`c-new${active === 'new' ? ' on' : ''}`}>{newCount}</b>
      <b className={`c-learn${active === 'learn' ? ' on' : ''}`}>{learning}</b>
      <b className={`c-due${active === 'due' ? ' on' : ''}`}>{due}</b>
    </span>
  )
}

/* ---------- Sheet bộ thẻ ---------- */

export function DeckSheet({ deck, onClose, onSaved, onDeleted }: {
  deck?: VocabDeck; onClose: () => void; onSaved?: (o: VocabOverview) => void; onDeleted?: () => void
}) {
  const m = useVocabMutation<VocabOverview>()
  const [name, setName] = useState(deck?.name ?? '')
  const [description, setDescription] = useState(deck?.description ?? '')
  const [language, setLanguage] = useState(deck?.language ?? 'en-US')
  const [newPerDay, setNewPerDay] = useState(String(deck?.newPerDay ?? 20))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body: DeckInput = { name: name.trim(), description, language, newPerDay: Math.min(500, Math.max(0, Number(newPerDay) || 0)) }
    m.mutate(deck ? { method: 'patch', path: `/api/vocab/decks/${deck.id}`, body } : { method: 'post', path: '/api/vocab/decks', body },
      { onSuccess: (o) => { onSaved?.(o); onClose() } })
  }
  return (
    <Sheet title={deck ? 'Cài đặt bộ thẻ' : 'Bộ thẻ mới'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Tên bộ thẻ</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus={!deck}
            placeholder="IELTS 7.0, 600 từ TOEIC, N5..." />
        </label>
        <label className="field"><span>Mô tả (không bắt buộc)</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </label>
        <div className="grid-2">
          <label className="field"><span>Ngôn ngữ của từ</span>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
            </select>
          </label>
          <label className="field"><span>Thẻ mới mỗi ngày</span>
            <input className="input" type="number" inputMode="numeric" min={0} max={500} value={newPerDay}
              onChange={(e) => setNewPerDay(e.target.value)} />
          </label>
        </div>
        <div className="small muted">Ngôn ngữ dùng để đọc phát âm. Anki mặc định 20 thẻ mới/ngày, nhiều hơn thì số thẻ ôn những ngày sau sẽ tăng theo.</div>
        <ErrorText error={m.error} />
        <button className="btn block" disabled={m.isPending || !name.trim()}>{deck ? 'Lưu' : 'Tạo bộ thẻ'}</button>
        {deck && (
          <button type="button" className="btn danger block" disabled={m.isPending}
            onClick={() => confirmDelete
              ? m.mutate({ method: 'del', path: `/api/vocab/decks/${deck.id}` }, { onSuccess: () => { onClose(); onDeleted?.() } })
              : setConfirmDelete(true)}>
            {confirmDelete ? `Xóa bộ và ${deck.total} thẻ? Bấm lần nữa` : 'Xóa bộ thẻ'}
          </button>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Sheet thẻ ---------- */

export function CardSheet({ deckId, card, decks, language, onClose }: {
  deckId: number; card?: VocabCard; decks: VocabDeck[]; language: string; onClose: () => void
}) {
  const m = useVocabMutation<VocabCard>()
  const [form, setForm] = useState<CardInput>({
    term: card?.term ?? '', meaning: card?.meaning ?? '', pronunciation: card?.pronunciation ?? '', example: card?.example ?? '',
  })
  const [target, setTarget] = useState(card?.deckId ?? deckId)
  const [added, setAdded] = useState(0)
  const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null)
  const termRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof CardInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const valid = form.term.trim() && form.meaning.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (card) {
      m.mutate({ method: 'patch', path: `/api/vocab/cards/${card.id}`, body: { ...form, deckId: target !== card.deckId ? target : undefined } },
        { onSuccess: onClose })
    } else {
      // Thêm liên tục như Quizlet: lưu xong để trống form và quay lại ô "Từ"
      m.mutate({ method: 'post', path: `/api/vocab/decks/${deckId}/cards`, body: form }, {
        onSuccess: () => {
          setAdded((n) => n + 1)
          setForm({ term: '', meaning: '', pronunciation: '', example: '' })
          termRef.current?.focus()
        },
      })
    }
  }
  const act = (kind: 'delete' | 'reset') => {
    if (!card) return
    if (confirm !== kind) return setConfirm(kind)
    m.mutate(kind === 'delete'
      ? { method: 'del', path: `/api/vocab/cards/${card.id}` }
      : { method: 'post', path: `/api/vocab/cards/${card.id}/reset` }, { onSuccess: onClose })
  }

  return (
    <Sheet title={card ? 'Sửa thẻ' : 'Thêm thẻ'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Từ / cụm từ</span>
          <div className="row" style={{ gap: 6 }}>
            <input ref={termRef} className="input" value={form.term} onChange={set('term')} maxLength={200} required autoFocus
              autoCapitalize="off" autoCorrect="off" spellCheck={false} lang={language} />
            {form.term.trim() && <SpeakButton text={form.term} lang={language} />}
          </div>
        </label>
        <label className="field"><span>Nghĩa</span>
          <input className="input" value={form.meaning} onChange={set('meaning')} maxLength={500} required placeholder="Nhiều nghĩa thì ngăn bằng dấu phẩy" />
        </label>
        <label className="field"><span>Phiên âm (không bắt buộc)</span>
          <input className="input" value={form.pronunciation} onChange={set('pronunciation')} maxLength={100} placeholder="/əˈbʌndənt/" />
        </label>
        <label className="field"><span>Ví dụ (không bắt buộc)</span>
          <textarea className="input" value={form.example} onChange={set('example')} maxLength={1000} rows={2} lang={language} />
        </label>
        {card && decks.length > 1 && (
          <label className="field"><span>Bộ thẻ</span>
            <select className="input" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}
        <ErrorText error={m.error} />
        {added > 0 && <div className="notice">Đã thêm {added} thẻ. Nhập tiếp hoặc đóng lại.</div>}
        <button className="btn block" disabled={m.isPending || !valid}>{card ? 'Lưu' : 'Thêm thẻ'}</button>
        {card && (
          <div className="row" style={{ gap: 8 }}>
            {card.state !== 'NEW' && (
              <button type="button" className="btn secondary grow" disabled={m.isPending} onClick={() => act('reset')}>
                {confirm === 'reset' ? 'Bấm lần nữa' : 'Học lại từ đầu'}
              </button>
            )}
            <button type="button" className="btn danger grow" disabled={m.isPending} onClick={() => act('delete')}>
              {confirm === 'delete' ? 'Bấm lần nữa để xóa' : 'Xóa thẻ'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Nhập nhiều thẻ ---------- */

type Sep = 'auto' | 'tab' | 'dash' | 'comma' | 'semicolon'
const SEPS: { value: Sep; label: string }[] = [
  { value: 'auto', label: 'Tự nhận' }, { value: 'tab', label: 'Tab' }, { value: 'dash', label: 'Gạch ( - )' },
  { value: 'comma', label: 'Phẩy' }, { value: 'semicolon', label: 'Chấm phẩy' },
]

/** Mỗi dòng: từ | nghĩa | ví dụ (tùy chọn). Hợp với bản xuất của Quizlet, Anki và cột Excel/Google Sheets. */
export function parseImport(text: string, sep: Sep): { cards: CardInput[]; skipped: number } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const cards: CardInput[] = []
  let skipped = 0
  for (const line of lines) {
    // Tự nhận theo từng dòng: Tab → " - " → ";" → ","
    const mode = sep !== 'auto' ? sep
      : line.includes('\t') ? 'tab' : / [-–—:] /.test(line) ? 'dash' : line.includes(';') ? 'semicolon' : 'comma'
    let parts: string[]
    if (mode === 'tab') parts = line.split('\t')
    else if (mode === 'dash') parts = line.split(/\s+[-–—:]\s+/)
    else if (mode === 'semicolon') parts = line.split(';')
    else {
      // Phẩy: phần đầu là từ, phần còn lại là nghĩa (nghĩa có thể chứa dấu phẩy)
      const i = line.indexOf(',')
      parts = i < 0 ? [line] : [line.slice(0, i), line.slice(i + 1)]
    }
    const [term, meaning, example] = parts.map((p) => p.trim())
    if (!term || !meaning || term.length > 200 || meaning.length > 500) { skipped++; continue }
    cards.push({ term, meaning, example: example ? example.slice(0, 1000) : undefined })
  }
  return { cards, skipped }
}

export function ImportSheet({ deck, onClose }: { deck: VocabDeck; onClose: () => void }) {
  const m = useVocabMutation<{ added: number }>()
  const [text, setText] = useState('')
  const [sep, setSep] = useState<Sep>('auto')
  const parsed = useMemo(() => parseImport(text, sep), [text, sep])
  const tooMany = parsed.cards.length > 2000

  return (
    <Sheet title={`Nhập thẻ vào “${deck.name}”`} onClose={onClose}>
      <div className="form">
        <div className="small muted">
          Mỗi dòng một thẻ: <b>từ</b>, <b>nghĩa</b>, rồi <b>ví dụ</b> nếu có. Dán thẳng từ Quizlet (Xuất), Anki (Export dạng text) hoặc 2–3 cột Excel/Google Sheets.
        </div>
        <textarea className="input import-box" value={text} onChange={(e) => setText(e.target.value)} rows={8} autoFocus
          placeholder={'abundant\tdồi dào\nbrisk - nhanh nhẹn\ncandid, thẳng thắn, bộc trực'} spellCheck={false} />
        <div className="chips">
          {SEPS.map((s) => (
            <button key={s.value} type="button" className={`chip${sep === s.value ? ' on' : ''}`} onClick={() => setSep(s.value)}>{s.label}</button>
          ))}
        </div>
        {parsed.cards.length > 0 && (
          <div className="import-preview">
            {parsed.cards.slice(0, 5).map((c, i) => (
              <div key={i} className="import-row"><b className="ellipsis">{c.term}</b><span className="ellipsis muted">{c.meaning}</span></div>
            ))}
            {parsed.cards.length > 5 && <div className="small muted">… và {parsed.cards.length - 5} thẻ nữa</div>}
          </div>
        )}
        {parsed.skipped > 0 && <div className="small muted">Bỏ qua {parsed.skipped} dòng thiếu từ hoặc nghĩa.</div>}
        {tooMany && <div className="error">Mỗi lần nhập tối đa 2000 thẻ.</div>}
        <ErrorText error={m.error} />
        <button className="btn block" disabled={m.isPending || parsed.cards.length === 0 || tooMany}
          onClick={() => m.mutate({ method: 'post', path: `/api/vocab/decks/${deck.id}/cards/bulk`, body: { cards: parsed.cards } }, { onSuccess: onClose })}>
          {parsed.cards.length ? `Nhập ${parsed.cards.length} thẻ` : 'Nhập thẻ'}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- Thẻ ở màn Hôm nay ---------- */

export function TodayVocabCard() {
  const vocab = useVocab()
  const o = vocab.data
  if (!o) return null
  const sum = (k: 'newCount' | 'learning' | 'due') => o.decks.reduce((s, d) => s + d[k], 0)
  const left = sum('newCount') + sum('learning') + sum('due')
  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h2>Từ vựng</h2>
        <Link to="/tu-vung" className="small">Bộ thẻ <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
      </div>
      {o.decks.length === 0 ? (
        <>
          <div className="small muted" style={{ marginBottom: 12 }}>Học từ vựng mỗi ngày với thẻ ghi nhớ lặp lại ngắt quãng như Anki.</div>
          <Link to="/tu-vung?moi=1" className="btn secondary block">Tạo bộ thẻ đầu tiên</Link>
        </>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="value">{left > 0 ? `${left} thẻ` : 'Xong rồi 🎉'}</div>
              <div className="hint">{left > 0 ? 'cần học hôm nay' : `Đã ôn ${o.reviewedToday} lượt hôm nay`}</div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              {left > 0 && <DueCounts newCount={sum('newCount')} learning={sum('learning')} due={sum('due')} />}
              {o.streak > 0 && <span className="streak" title="Chuỗi ngày học liên tiếp"><Flame size={13} /> {o.streak}</span>}
            </div>
          </div>
          {left > 0
            ? <Link to="/tu-vung/on-tap" className="btn block">Ôn ngay</Link>
            : <Link to="/tu-vung" className="btn secondary block">Luyện thêm</Link>}
        </>
      )}
    </div>
  )
}
