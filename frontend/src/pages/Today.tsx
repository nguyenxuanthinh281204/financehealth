import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ChevronRight, Plus, Scale, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useExpenses, useHabits, useMoments, usePlan, useProfile } from '../lib/queries'
import { EXPENSE_CATEGORIES, MEALS, isoDate, money, num, prettyDate } from '../lib/format'
import { Empty, MacroBar, Ring } from '../components/ui'
import { HabitChecklist } from '../components/habits'
import type { HabitKind } from '../api/types'
import ExpenseSheet from './expenses/ExpenseSheet'
import CameraSheet from './moments/CameraSheet'
import WeightSheet from './body/WeightSheet'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function Today() {
  const { user } = useAuth()
  const today = isoDate()
  const profile = useProfile()
  const plan = usePlan(today)
  const expenses = useExpenses(today, today)
  const moments = useMoments(today, today)
  const habits = useHabits()
  const [sheet, setSheet] = useState<'expense' | 'camera' | 'weight' | null>(null)

  const macros = profile.data?.macros
  const spent = (expenses.data ?? []).reduce((s, e) => s + e.amount, 0)
  const total = plan.data?.total
  const activeHabits = habits.data?.habits.filter((h) => !h.archived) ?? []
  const habitsDone = activeHabits.filter((h) => h.done).length
  const openForHabit = (kind: HabitKind) =>
    setSheet(kind === 'EXPENSE' ? 'expense' : kind === 'MOMENT' ? 'camera' : 'weight')

  return (
    <>
      <div className="page-head">
        <div>
          <div className="sub">{prettyDate(today)}</div>
          <h1>{greeting()}, {user?.displayName.split(' ').slice(-1)[0]} 👋</h1>
        </div>
        <Link to="/co-the" className="icon-btn" aria-label="Cơ thể & tài khoản"><UserRound size={20} /></Link>
      </div>

      {profile.data === null && (
        <Link to="/co-the" className="card hero row between" style={{ marginBottom: 12 }}>
          <div>
            <h2>Nhập chỉ số cơ thể</h2>
            <div className="muted small">Để hệ thống tính calo và macro mỗi ngày cho bạn</div>
          </div>
          <ChevronRight />
        </Link>
      )}

      <div className="grid grid-md-2">
        {activeHabits.length > 0 && (
          <div className="card habits-card">
            <div className="card-head" style={{ marginBottom: 4 }}>
              <h2>Thói quen hôm nay</h2>
              <Link to="/thoi-quen" className="small">Chi tiết <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
            </div>
            <div className="row" style={{ gap: 10, marginBottom: 4 }}>
              <div className="bar grow"><i style={{ width: `${(habitsDone / activeHabits.length) * 100}%` }} /></div>
              <span className="small tnum muted"><b style={{ color: 'var(--text)' }}>{habitsDone}</b>/{activeHabits.length}</span>
            </div>
            <HabitChecklist habits={activeHabits} today={habits.data!.today} onAuto={openForHabit} />
          </div>
        )}

        {macros && (
          <div className="card">
            <div className="card-head">
              <h2>Dinh dưỡng hôm nay</h2>
              <Link to="/thuc-don" className="small">Thực đơn <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
            </div>
            <div className="row" style={{ gap: 18 }}>
              <Ring value={total?.kcal ?? 0} max={macros.kcal}>
                <div className="big">{num(total?.kcal ?? macros.kcal)}</div>
                <div className="small muted">{total ? `/ ${num(macros.kcal)} kcal` : 'kcal mục tiêu'}</div>
              </Ring>
              <div className="grow stack">
                <MacroBar label="Đạm" value={total?.protein ?? 0} target={macros.protein} color="var(--protein)" />
                <MacroBar label="Tinh bột" value={total?.carbs ?? 0} target={macros.carbs} color="var(--carbs)" />
                <MacroBar label="Béo" value={total?.fat ?? 0} target={macros.fat} color="var(--fat)" />
              </div>
            </div>
            {plan.data ? (
              <div className="small muted" style={{ marginTop: 12 }}>
                {plan.data.meals.map((m) => `${MEALS[m.meal].emoji} ${m.items.map((i) => i.foodName).join(', ')}`).join(' · ')}
              </div>
            ) : (
              <Link to="/thuc-don" className="btn secondary block" style={{ marginTop: 14 }}>Tạo thực đơn tuần</Link>
            )}
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Chi tiêu hôm nay</h2>
            <Link to="/chi-tieu" className="small">Tất cả <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
          </div>
          <div className="stat"><div className="value" style={{ color: 'var(--spend)' }}>{money(spent)}</div></div>
          <div className="list" style={{ marginTop: 4 }}>
            {(expenses.data ?? []).slice(0, 3).map((e) => (
              <div className="list-item" key={e.id}>
                <div className="avatar" style={{ background: EXPENSE_CATEGORIES[e.category].color + '22' }}>{EXPENSE_CATEGORIES[e.category].emoji}</div>
                <div className="grow">{e.merchant || EXPENSE_CATEGORIES[e.category].label}</div>
                <b className="tnum">{money(e.amount)}</b>
              </div>
            ))}
          </div>
          <button className="btn secondary block" style={{ marginTop: 10 }} onClick={() => setSheet('expense')}>
            <Plus size={18} /> Thêm khoản chi
          </button>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Khoảnh khắc</h2>
            <Link to="/khoanh-khac" className="small">Xem lại <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
          </div>
          {(moments.data ?? []).length === 0 ? (
            <Empty emoji="📸" title="Chưa có khoảnh khắc nào hôm nay" />
          ) : (
            <div className="moment-grid">
              {moments.data!.slice(0, 6).map((m) => (
                <div className="moment-tile" key={m.id}>
                  {m.mediaType === 'PHOTO' ? <img src={m.url} alt={m.caption ?? ''} loading="lazy" />
                    : <video src={m.url} muted playsInline loop autoPlay />}
                </div>
              ))}
            </div>
          )}
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => setSheet('camera')}>
            <Camera size={18} /> Chụp ảnh / quay 5 giây
          </button>
        </div>

        {profile.data && (
          <div className="card">
            <div className="card-head">
              <h2>Cân nặng</h2>
              <Link to="/co-the" className="small">Chi tiết <ChevronRight size={14} style={{ verticalAlign: -2 }} /></Link>
            </div>
            <div className="row between">
              <div className="stat">
                <div className="value">{num(profile.data.weightKg, 1)} kg</div>
                <div className="hint">BMI {profile.data.macros.bmi} · {profile.data.macros.bmiCategory}</div>
              </div>
              {profile.data.targetWeightKg && (
                <div className="stat" style={{ textAlign: 'right' }}>
                  <div className="label">Mục tiêu</div>
                  <div className="value" style={{ fontSize: 18 }}>{num(profile.data.targetWeightKg, 1)} kg</div>
                </div>
              )}
            </div>
            <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => setSheet('weight')}>
              <Scale size={18} /> Cân hôm nay
            </button>
          </div>
        )}
      </div>

      {sheet === 'expense' && <ExpenseSheet onClose={() => setSheet(null)} />}
      {sheet === 'camera' && <CameraSheet onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <WeightSheet onClose={() => setSheet(null)} current={profile.data?.weightKg} />}
    </>
  )
}
