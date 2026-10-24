import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import type { Food, FoodCategory, Meal, Plan } from '../api/types'
import { useFoods, usePlan, useProfile } from '../lib/queries'
import { FOOD_CATEGORIES, MEALS, addDays, isoDate, num, prettyDate } from '../lib/format'
import { Empty, ErrorText, Loading, MacroBar, Spinner } from '../components/ui'
import FoodSheet from './meal/FoodSheet'

type Selection = Record<number, Meal | null>
const draftKey = (date: string) => `fh.meal-draft.${date}`
const loadDraft = (date: string): Selection => {
  try { return JSON.parse(localStorage.getItem(draftKey(date)) ?? '{}') } catch { return {} }
}
const saveDraft = (date: string, s: Selection) => {
  try { localStorage.setItem(draftKey(date), JSON.stringify(s)) } catch { /* bỏ qua */ }
}
const MEAL_CYCLE: (Meal | null)[] = [null, 'BREAKFAST', 'LUNCH', 'DINNER']

export default function MealPlanner() {
  const today = isoDate()
  const [date, setDate] = useState(addDays(today, 1))
  const profile = useProfile()
  const plan = usePlan(date)
  const [picking, setPicking] = useState(false)

  useEffect(() => setPicking(false), [date])

  if (profile.isLoading) return <Loading />
  if (!profile.data) {
    return (
      <>
        <div className="page-head"><h1>Thực đơn</h1></div>
        <div className="card"><Empty emoji="🥗" title="Cần chỉ số cơ thể trước">
          Hệ thống dựa vào chiều cao, cân nặng và mức tập để chia macro cho 3 bữa.
          <div style={{ marginTop: 12 }}><Link className="btn" to="/co-the">Nhập chỉ số</Link></div>
        </Empty></div>
      </>
    )
  }

  const showPlan = plan.data && !picking
  return (
    <>
      <div className="page-head">
        <div><h1>Thực đơn 3 bữa</h1><div className="sub">Chọn món bạn có, hệ thống tính lượng ăn cho đủ macro</div></div>
      </div>
      <div className="scroll-x" style={{ marginBottom: 12 }}>
        {[today, addDays(today, 1), addDays(today, 2)].map((d) => (
          <button key={d} className={`chip ${date === d ? 'on' : ''}`} onClick={() => setDate(d)}>{prettyDate(d)}</button>
        ))}
        <input type="date" className="input" style={{ width: 160, minHeight: 36, padding: '4px 10px', flex: 'none' }}
          value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Chọn ngày" />
      </div>

      {plan.isLoading ? <Loading /> : showPlan
        ? <PlanView plan={plan.data!} onRepick={() => setPicking(true)} />
        : <Picker date={date} existing={plan.data ?? null} onDone={() => setPicking(false)} />}
    </>
  )
}

function Picker({ date, existing, onDone }: { date: string; existing: Plan | null; onDone: () => void }) {
  const qc = useQueryClient()
  const foods = useFoods()
  const [selected, setSelected] = useState<Selection>(() => {
    const draft = loadDraft(date)
    if (Object.keys(draft).length) return draft
    const fromPlan: Selection = {}
    existing?.meals.forEach((m) => m.items.forEach((i) => { fromPlan[i.foodId] = null }))
    return fromPlan
  })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FoodCategory | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => saveDraft(date, selected), [date, selected])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    return (foods.data ?? []).filter((f) => (!cat || f.category === cat) &&
      (!term || f.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(term)))
  }, [foods.data, q, cat])

  const count = Object.keys(selected).length
  const toggle = (f: Food) => {
    const next = { ...selected }
    if (f.id in next) delete next[f.id]
    else next[f.id] = null
    setSelected(next)
  }
  const cycleMeal = (f: Food) => {
    const allowed = MEAL_CYCLE.filter((m) => m === null || f.meals.includes(m))
    const idx = allowed.indexOf(selected[f.id] ?? null)
    setSelected({ ...selected, [f.id]: allowed[(idx + 1) % allowed.length] })
  }

  const generate = useMutation({
    mutationFn: () => api.post<Plan>('/api/meal-plans/generate', {
      date, selections: Object.entries(selected).map(([foodId, meal]) => ({ foodId: Number(foodId), meal })),
    }),
    onSuccess: (p) => {
      qc.setQueryData(['plan', date], p)
      qc.invalidateQueries({ queryKey: ['summary'] })
      saveDraft(date, {})
      onDone()
    },
  })

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="input-suffix grow">
            <input className="input" placeholder="Tìm món: gà, cơm, trứng…" value={q} onChange={(e) => setQ(e.target.value)} />
            <em><Search size={18} /></em>
          </div>
          <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Thêm món mới"><Plus size={20} /></button>
        </div>
        <div className="scroll-x" style={{ marginTop: 10 }}>
          <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat(null)}>Tất cả</button>
          {(Object.keys(FOOD_CATEGORIES) as FoodCategory[]).map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? null : c)}>{FOOD_CATEGORIES[c]}</button>
          ))}
        </div>
      </div>

      <p className="small muted" style={{ margin: '12px 4px' }}>
        Chạm để chọn món. Chạm vào nhãn bữa để ghim món vào bữa cố định, để <b>Tự động</b> thì hệ thống tự xếp.
      </p>

      {foods.isLoading ? <Loading /> : (
        <div className="food-grid">
          {visible.map((f) => {
            const on = f.id in selected
            const meal = selected[f.id]
            return (
              <div key={f.id} className={`food-pick ${on ? 'on' : ''}`} onClick={() => toggle(f)} role="checkbox" aria-checked={on} tabIndex={0}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), toggle(f))}>
                <span className="check">{on && <Check size={14} />}</span>
                <span className="grow">
                  <div style={{ fontWeight: 500 }}>{f.name}{f.custom && <span className="muted small"> · của bạn</span>}</div>
                  <div className="macro-pills" style={{ marginTop: 2 }}>
                    <span>{num(f.kcal)} kcal</span><span className="p">Đ {num(f.protein, 1)}</span>
                    <span className="c">C {num(f.carbs, 1)}</span><span className="f">B {num(f.fat, 1)}</span>
                  </div>
                </span>
                {on && (
                  <button className="chip" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); cycleMeal(f) }}>
                    {meal ? `${MEALS[meal].emoji} ${MEALS[meal].label.replace('Bữa ', '')}` : 'Tự động'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + var(--safe-b) + 12px)', marginTop: 16, zIndex: 5 }}>
        <ErrorText error={generate.error} />
        <div className="row" style={{ marginTop: 8 }}>
          {existing && <button className="btn secondary" onClick={onDone}>Hủy</button>}
          <button className="btn grow" style={{ boxShadow: '0 10px 30px rgba(29,107,82,.3)' }} disabled={count === 0 || generate.isPending}
            onClick={() => generate.mutate()}>
            {generate.isPending ? <><Spinner /> Đang tính…</> : <><Sparkles size={18} /> Tạo thực đơn ({count} món)</>}
          </button>
        </div>
      </div>

      {adding && <FoodSheet onClose={() => setAdding(false)} onCreated={(f) => setSelected((s) => ({ ...s, [f.id]: null }))} />}
    </>
  )
}

function PlanView({ plan, onRepick }: { plan: Plan; onRepick: () => void }) {
  const qc = useQueryClient()
  const update = useMutation({
    mutationFn: ({ id, grams }: { id: number; grams: number }) => api.patch<Plan>(`/api/meal-plans/items/${id}`, { grams }),
    onSuccess: (p) => qc.setQueryData(['plan', plan.date], p),
  })
  const remove = useMutation({
    mutationFn: () => api.del(`/api/meal-plans/${plan.date}`),
    onSuccess: () => qc.setQueryData(['plan', plan.date], null),
  })
  const t = plan.total, g = plan.target
  const diff = Math.round(t.kcal - g.kcal)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Tổng cả ngày</h2>
          <span className={`small ${Math.abs(diff) <= g.kcal * 0.05 ? 'down' : 'muted'}`}>
            {Math.abs(diff) <= g.kcal * 0.05 ? '✓ Sát mục tiêu' : `${diff > 0 ? '+' : ''}${num(diff)} kcal so với mục tiêu`}
          </span>
        </div>
        <div className="stack">
          <MacroBar label="Calo" value={t.kcal} target={g.kcal} color="var(--kcal)" unit="" />
          <MacroBar label="Đạm" value={t.protein} target={g.protein} color="var(--protein)" />
          <MacroBar label="Tinh bột" value={t.carbs} target={g.carbs} color="var(--carbs)" />
          <MacroBar label="Béo" value={t.fat} target={g.fat} color="var(--fat)" />
        </div>
      </div>

      <div className="grid grid-md-3" style={{ marginTop: 12 }}>
        {plan.meals.map((m) => (
          <div className="card" key={m.meal}>
            <div className="card-head">
              <h2>{MEALS[m.meal].emoji} {MEALS[m.meal].label}</h2>
              <span className="small muted tnum">{num(m.total.kcal)}/{num(m.target.kcal)} kcal</span>
            </div>
            {m.items.map((i) => (
              <div className="meal-item" key={i.id}>
                <div>
                  <div style={{ fontWeight: 500 }}>{i.foodName}</div>
                  <div className="macro-pills" style={{ marginTop: 2 }}>
                    <span>{num(i.macros.kcal)} kcal</span><span className="p">Đ {num(i.macros.protein)}</span>
                    <span className="c">C {num(i.macros.carbs)}</span><span className="f">B {num(i.macros.fat)}</span>
                  </div>
                </div>
                <label className="row" style={{ gap: 4 }}>
                  <input className="gram-input tnum" inputMode="numeric" defaultValue={i.grams} key={`${i.id}-${i.grams}`}
                    aria-label={`Số gram ${i.foodName}`}
                    onBlur={(e) => {
                      const grams = Math.max(0, Math.min(2000, Number(e.target.value) || 0))
                      if (grams !== i.grams) update.mutate({ id: i.id, grams })
                    }} />
                  <span className="muted small">g</span>
                </label>
              </div>
            ))}
            <div className="macro-pills" style={{ marginTop: 10 }}>
              <span className="p">Đ {num(m.total.protein)}/{num(m.target.protein)}g</span>
              <span className="c">C {num(m.total.carbs)}/{num(m.target.carbs)}g</span>
              <span className="f">B {num(m.total.fat)}/{num(m.target.fat)}g</span>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '12px 4px' }}>Khối lượng tính theo món đã nấu chín. Sửa số gram rồi chạm ra ngoài để tính lại, nhập 0 để bỏ món.</p>
      <ErrorText error={update.error} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn danger" onClick={() => remove.mutate()} aria-label="Xóa thực đơn"><Trash2 size={18} /></button>
        <button className="btn secondary grow" onClick={onRepick}><RefreshCw size={18} /> Chọn lại món</button>
      </div>
    </>
  )
}
