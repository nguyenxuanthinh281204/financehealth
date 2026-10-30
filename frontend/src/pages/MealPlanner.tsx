import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, ShoppingBasket, Sparkles, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import type { Meal, MealView, Plan, PlanItem, ShoppingItem, Staple, WeekMenu } from '../api/types'
import { useProfile, useWeekMenu } from '../lib/queries'
import { MEALS, WEEKDAYS_SHORT, addDays, isoDate, num, prettyDate, shortDate, weekStartOf } from '../lib/format'
import { Empty, ErrorText, Loading, MacroBar, Spinner } from '../components/ui'

/** "150 g · 3 quả" cho món có đơn vị, còn lại chỉ số gram */
const unitText = (grams: number, unitG: number | null, unitName: string | null) =>
  unitG && unitName ? `${Math.round(grams / unitG)} ${unitName}` : null

export default function MealPlanner() {
  const today = isoDate()
  const thisWeek = weekStartOf(today)
  const [weekStart, setWeekStart] = useState(thisWeek)
  const [day, setDay] = useState(today)
  const profile = useProfile()
  const week = useWeekMenu(weekStart)

  const goWeek = (n: number) => {
    const next = addDays(weekStart, 7 * n)
    setWeekStart(next)
    setDay(next === thisWeek ? today : next)
  }

  if (profile.isLoading) return <Loading />
  if (!profile.data) {
    return (
      <>
        <div className="page-head"><h1>Thực đơn tuần</h1></div>
        <div className="card"><Empty emoji="🥗" title="Cần chỉ số cơ thể trước">
          Hệ thống dựa vào chiều cao, cân nặng và mức tập để chia macro cho 3 bữa.
          <div style={{ marginTop: 12 }}><Link className="btn" to="/co-the">Nhập chỉ số</Link></div>
        </Empty></div>
      </>
    )
  }

  const plan = week.data?.days.find((d) => d.date === day)
  return (
    <>
      <div className="page-head">
        <div><h1>Thực đơn tuần</h1><div className="sub">Đồ luộc, tạo một lần cho cả tuần</div></div>
      </div>

      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="icon-btn" onClick={() => goWeek(-1)} aria-label="Tuần trước"><ChevronLeft size={18} /></button>
        <b>{weekStart === thisWeek ? 'Tuần này' : 'Tuần'} · {shortDate(weekStart)} – {shortDate(addDays(weekStart, 6))}</b>
        <button className="icon-btn" onClick={() => goWeek(1)} disabled={weekStart >= thisWeek} aria-label="Tuần sau"><ChevronRight size={18} /></button>
      </div>

      {week.isLoading || !week.data ? <Loading /> : !week.data.created ? (
        <CreateWeek week={week.data} />
      ) : (
        <>
          <div className="week-strip" role="tablist" aria-label="Ngày trong tuần">
            {WEEKDAYS_SHORT.map((label, i) => {
              const d = addDays(weekStart, i)
              return (
                <button key={d} role="tab" aria-selected={d === day} className={`week-day ${d === day ? 'on' : ''} ${d === today ? 'today' : ''}`}
                  onClick={() => setDay(d)}>
                  <span className="small">{label}</span>
                  <b className="tnum">{new Date(d + 'T00:00:00').getDate()}</b>
                </button>
              )
            })}
          </div>
          {plan ? <DayPlan plan={plan} weekStart={weekStart} staples={week.data.staples} /> : (
            <div className="card"><Empty emoji="🍽️" title="Ngày này chưa có thực đơn" /></div>
          )}
          <Shopping items={week.data.shopping} />
        </>
      )}
    </>
  )
}

function CreateWeek({ week }: { week: WeekMenu }) {
  const qc = useQueryClient()
  const generate = useMutation({
    mutationFn: () => api.post<WeekMenu>('/api/meal-plans/week'),
    onSuccess: (w) => {
      qc.setQueryData(['week', w.weekStart], w)
      w.days.forEach((d) => qc.setQueryData(['plan', d.date], d))
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  return (
    <div className="card">
      <Empty emoji="🥚" title={week.canCreate ? 'Tuần này chưa có thực đơn' : 'Tuần này không có thực đơn'}>
        {week.canCreate
          ? 'Hệ thống chia 8 nguyên liệu dưới đây vào 3 bữa cho từng ngày, đủ calo và đạm theo chỉ số cơ thể. Mỗi tuần chỉ tạo một lần.'
          : 'Chỉ tạo được thực đơn cho tuần hiện tại.'}
      </Empty>
      <div className="chips" style={{ justifyContent: 'center', margin: '4px 0 16px' }}>
        {week.ingredients.map((name) => <span key={name} className="chip">{name}</span>)}
      </div>
      {week.canCreate && (
        <>
          <ErrorText error={generate.error} />
          <button className="btn block" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <><Spinner /> Đang tính…</> : <><Sparkles size={18} /> Tạo thực đơn tuần này</>}
          </button>
        </>
      )}
    </div>
  )
}

function DayPlan({ plan, weekStart, staples }: { plan: Plan; weekStart: string; staples: Staple[] }) {
  const qc = useQueryClient()
  const onSuccess = (p: Plan) => {
    qc.setQueryData(['plan', p.date], p)
    qc.invalidateQueries({ queryKey: ['week', weekStart] })
  }
  const update = useMutation({
    mutationFn: ({ id, grams }: { id: number; grams: number }) => api.patch<Plan>(`/api/meal-plans/items/${id}`, { grams }),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del<Plan>(`/api/meal-plans/items/${id}`),
    onSuccess,
  })
  const clear = useMutation({
    mutationFn: (meal: Meal) => api.del<Plan>(`/api/meal-plans/${plan.date}/meals/${meal}`),
    onSuccess,
  })
  const add = useMutation({
    mutationFn: ({ meal, foodId }: { meal: Meal; foodId: number }) =>
      api.post<Plan>(`/api/meal-plans/${plan.date}/meals/${meal}/items`, { foodId }),
    onSuccess,
  })
  const busy = update.isPending || remove.isPending || clear.isPending || add.isPending
  const error = update.error ?? remove.error ?? clear.error ?? add.error
  const t = plan.total, g = plan.target
  const diff = Math.round(t.kcal - g.kcal)
  const close = Math.abs(diff) <= g.kcal * 0.05

  return (
    <>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <h2>{prettyDate(plan.date)}</h2>
          <span className={`small ${close ? 'down' : 'muted'}`}>
            {close ? '✓ Sát mục tiêu' : `${diff > 0 ? '+' : ''}${num(diff)} kcal so với mục tiêu`}
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
          <MealCard key={m.meal} meal={m} staples={staples} busy={busy}
            onChange={(id, grams) => update.mutate({ id, grams })}
            onRemove={(id) => remove.mutate(id)}
            onClear={() => clear.mutate(m.meal)}
            onAdd={(foodId) => add.mutate({ meal: m.meal, foodId })} />
        ))}
      </div>
      <ErrorText error={error} />
      <p className="small muted" style={{ margin: '12px 4px' }}>
        Khối lượng tính sau khi luộc chín. Đồ luộc ít béo nên phần calo béo còn thiếu được bù bằng cơm, bánh mì.
        Sửa số gram rồi chạm ra ngoài để tính lại. Bấm ✕ để bỏ món, “Thêm món” để thêm nguyên liệu vào bữa.
      </p>
    </>
  )
}

function MealCard({ meal: m, staples, busy, onChange, onRemove, onClear, onAdd }: {
  meal: MealView; staples: Staple[]; busy: boolean
  onChange: (id: number, grams: number) => void; onRemove: (id: number) => void
  onClear: () => void; onAdd: (foodId: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  // Hỏi lại trước khi bỏ cả bữa, tự huỷ sau 3 giây
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(t)
  }, [confirmClear])
  const inMeal = new Set(m.items.map((i) => i.foodId))
  const options = staples.filter((s) => !inMeal.has(s.foodId))

  return (
    <div className="card">
      <div className="card-head">
        <h2>{MEALS[m.meal].emoji} {MEALS[m.meal].label}</h2>
        <span className="small muted tnum">{num(m.total.kcal)}/{num(m.target.kcal)} kcal</span>
      </div>
      {m.items.length === 0 ? (
        <div className="small muted" style={{ padding: '10px 0' }}>Đã bỏ bữa này. Thêm món nếu muốn ăn lại.</div>
      ) : m.items.map((i) => (
        <Item key={i.id} item={i} disabled={busy} onChange={(grams) => onChange(i.id, grams)} onRemove={() => onRemove(i.id)} />
      ))}
      <div className="macro-pills" style={{ marginTop: 10 }}>
        <span className="p">Đ {num(m.total.protein)}/{num(m.target.protein)}g</span>
        <span className="c">C {num(m.total.carbs)}/{num(m.target.carbs)}g</span>
        <span className="f">B {num(m.total.fat)}/{num(m.target.fat)}g</span>
      </div>

      {adding && (
        <div className="chips" style={{ marginTop: 12 }}>
          {options.length === 0 ? <span className="small muted">Bữa này đã có đủ nguyên liệu.</span> : options.map((s) => (
            <button key={s.foodId} className="chip" disabled={busy}
              onClick={() => { onAdd(s.foodId); setAdding(false) }}>
              <Plus size={14} /> {s.name}
              <span className="muted small tnum">{unitText(s.defaultGrams, s.unitG, s.unitName) ?? `${s.defaultGrams}g`}</span>
            </button>
          ))}
        </div>
      )}
      <div className="row between" style={{ marginTop: 12, gap: 8 }}>
        <button className={`btn sm ${adding ? 'ghost' : 'secondary'}`} onClick={() => setAdding(!adding)} aria-expanded={adding}>
          {adding ? <><X size={16} /> Đóng</> : <><Plus size={16} /> Thêm món</>}
        </button>
        {m.items.length > 0 && (
          confirmClear ? (
            <button className="btn sm danger" disabled={busy} onClick={() => { onClear(); setConfirmClear(false) }}>
              <Trash2 size={16} /> Bỏ hết {m.items.length} món?
            </button>
          ) : (
            <button className="btn sm ghost danger-text" onClick={() => setConfirmClear(true)}>
              <Trash2 size={16} /> Bỏ cả bữa
            </button>
          )
        )}
      </div>
    </div>
  )
}

function Item({ item: i, disabled, onChange, onRemove }: {
  item: PlanItem; disabled: boolean; onChange: (grams: number) => void; onRemove: () => void
}) {
  const units = unitText(i.grams, i.unitG, i.unitName)
  return (
    <div className="meal-item">
      <div>
        <div style={{ fontWeight: 500 }}>{i.foodName}{units && <span className="muted small"> · {units}</span>}</div>
        <div className="macro-pills" style={{ marginTop: 2 }}>
          <span>{num(i.macros.kcal)} kcal</span><span className="p">Đ {num(i.macros.protein)}</span>
          <span className="c">C {num(i.macros.carbs)}</span><span className="f">B {num(i.macros.fat)}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 2 }}>
        <label className="row" style={{ gap: 4 }}>
          <input className="gram-input tnum" inputMode="numeric" defaultValue={i.grams} key={`${i.id}-${i.grams}`}
            aria-label={`Số gram ${i.foodName}`}
            onBlur={(e) => {
              const grams = Math.max(0, Math.min(2000, Number(e.target.value) || 0))
              if (grams !== i.grams) onChange(grams)
            }} />
          <span className="muted small">g</span>
        </label>
        <button type="button" className="icon-btn plain item-remove" disabled={disabled} onClick={onRemove}
          aria-label={`Bỏ ${i.foodName}`} title="Bỏ món"><X size={16} /></button>
      </div>
    </div>
  )
}

function Shopping({ items }: { items: ShoppingItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-head"><h2><ShoppingBasket size={18} style={{ verticalAlign: -3 }} /> Cần chuẩn bị cả tuần</h2></div>
      {items.map((s) => {
        const units = unitText(s.grams, s.unitG, s.unitName)
        return (
          <div className="row between list-row" key={s.foodName}>
            <span>{s.foodName}</span>
            <b className="tnum">{units ?? `${num(s.grams / 1000, 2)} kg`}</b>
          </div>
        )
      })}
      <p className="small muted" style={{ marginTop: 8 }}>
        Khối lượng đã chín. Gạo sống bằng khoảng 2/5 lượng cơm, ức gà sống nặng hơn khi chín khoảng 1/3.
      </p>
    </div>
  )
}
