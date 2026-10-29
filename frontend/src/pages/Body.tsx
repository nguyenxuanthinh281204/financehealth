import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LogOut, Scale, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import type { ActivityLevel, Goal, Profile, Sex } from '../api/types'
import { useProfile, useWeights } from '../lib/queries'
import { ACTIVITY, GOALS, addDays, isoDate, num, shortDate } from '../lib/format'
import { ErrorText, Loading, Segmented } from '../components/ui'
import WeightSheet from './body/WeightSheet'

export default function Body() {
  const profile = useProfile()
  const [editing, setEditing] = useState(false)
  if (profile.isLoading) return <Loading />
  const p = profile.data
  return (
    <>
      <div className="page-head">
        <div><h1>Cơ thể & macro</h1><div className="sub">Chỉ số cơ thể, nhu cầu năng lượng và lịch sử cân nặng</div></div>
        {p && !editing && <button className="btn secondary sm" onClick={() => setEditing(true)}>Sửa chỉ số</button>}
      </div>
      {!p || editing ? <ProfileForm initial={p ?? undefined} onDone={() => setEditing(false)} /> : <Results p={p} />}
      {p && <WeightHistory current={p.weightKg} target={p.targetWeightKg} />}
      <LogoutRow />
    </>
  )
}

/** Trên điện thoại không có sidebar nên đặt nút đăng xuất ở đây. */
function LogoutRow() {
  const { user, logout } = useAuth()
  return (
    <div className="card row between" style={{ marginTop: 12 }}>
      <div><div style={{ fontWeight: 600 }}>{user?.displayName}</div><div className="small muted">{user?.email}</div></div>
      <button className="btn secondary sm" onClick={logout}><LogOut size={16} /> Đăng xuất</button>
    </div>
  )
}

function Results({ p }: { p: Profile }) {
  const m = p.macros
  const split = [
    { label: 'Đạm', g: m.protein, kcal: m.protein * 4, color: 'var(--protein)' },
    { label: 'Tinh bột', g: m.carbs, kcal: m.carbs * 4, color: 'var(--carbs)' },
    { label: 'Chất béo', g: m.fat, kcal: m.fat * 9, color: 'var(--fat)' },
  ]
  const totalKcal = split.reduce((s, x) => s + x.kcal, 0) || 1
  return (
    <div className="grid grid-md-2">
      <div className="card hero">
        <div className="muted small">Mục tiêu mỗi ngày · {GOALS[p.goal].label}</div>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em' }} className="tnum">{num(m.kcal)} <span style={{ fontSize: 18 }}>kcal</span></div>
        <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', margin: '12px 0', background: 'rgba(255,255,255,.2)' }}>
          {split.map((s) => <i key={s.label} style={{ width: `${(s.kcal / totalKcal) * 100}%`, background: s.color }} />)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {split.map((s) => (
            <div key={s.label}>
              <div className="muted small">{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 20 }} className="tnum">{s.g}g</div>
              <div className="muted small">{Math.round((s.kcal / totalKcal) * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="grid-2">
          <Stat label="BMI" value={String(m.bmi)} hint={m.bmiCategory} />
          <Stat label="Tuổi" value={String(m.age)} hint={`${num(p.heightCm)} cm · ${num(p.weightKg, 1)} kg`} />
          <Stat label="BMR" value={`${num(m.bmr)}`} hint="kcal khi nghỉ hoàn toàn" />
          <Stat label="TDEE" value={`${num(m.tdee)}`} hint={`kcal · vận động ${ACTIVITY[p.activityLevel].label.toLowerCase()}`} />
          <Stat label="Nước" value={`${(m.waterMl / 1000).toFixed(1).replace('.', ',')} L`} hint="mỗi ngày" />
          {p.targetWeightKg && <Stat label="Cân mục tiêu" value={`${num(p.targetWeightKg, 1)} kg`}
            hint={`còn ${num(Math.abs(p.weightKg - p.targetWeightKg), 1)} kg`} />}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="stat"><div className="label">{label}</div><div className="value">{value}</div>{hint && <div className="hint">{hint}</div>}</div>
}

function ProfileForm({ initial, onDone }: { initial?: Profile; onDone: () => void }) {
  const qc = useQueryClient()
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'MALE')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '2000-01-01')
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '')
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '')
  const [target, setTarget] = useState(initial?.targetWeightKg ? String(initial.targetWeightKg) : '')
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activityLevel ?? 'MODERATE')
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'MAINTAIN')
  const toNum = (s: string) => Number(s.replace(',', '.'))

  const save = useMutation({
    mutationFn: () => api.put<Profile>('/api/body/profile', {
      sex, birthDate, heightCm: toNum(height), weightKg: toNum(weight), activityLevel: activity, goal,
      targetWeightKg: target ? toNum(target) : null,
    }),
    onSuccess: (p) => {
      qc.setQueryData(['profile'], p)
      qc.invalidateQueries({ queryKey: ['weights'] })
      onDone()
    },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Chỉ số của bạn</h2>
      <Segmented value={sex} onChange={setSex} options={[{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }]} />
      <div className="grid-2">
        <label className="field"><span>Ngày sinh</span>
          <input className="input" type="date" value={birthDate} max={isoDate()} onChange={(e) => setBirthDate(e.target.value)} required />
        </label>
        <label className="field"><span>Chiều cao</span>
          <div className="input-suffix"><input className="input" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} required placeholder="170" /><em>cm</em></div>
        </label>
        <label className="field"><span>Cân nặng</span>
          <div className="input-suffix"><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} required placeholder="65" /><em>kg</em></div>
        </label>
        <label className="field"><span>Cân mục tiêu</span>
          <div className="input-suffix"><input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Không bắt buộc" /><em>kg</em></div>
        </label>
      </div>
      <div className="field"><span>Mức độ tập luyện</span>
        <div className="grid">
          {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
            <button type="button" key={a} className={`food-pick ${activity === a ? 'on' : ''}`} onClick={() => setActivity(a)}>
              <span className="check">{activity === a && '✓'}</span>
              <span className="grow"><b>{ACTIVITY[a].label}</b> <span className="muted small">· {ACTIVITY[a].hint}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div className="field"><span>Mục tiêu</span>
        <Segmented value={goal} onChange={setGoal} options={(Object.keys(GOALS) as Goal[]).map((g) => ({ value: g, label: GOALS[g].label }))} />
        <small className="muted">{GOALS[goal].hint}</small>
      </div>
      <ErrorText error={save.error} />
      <div className="row">
        {initial && <button type="button" className="btn secondary" onClick={onDone}>Hủy</button>}
        <button className="btn grow" disabled={save.isPending}>{save.isPending ? 'Đang tính…' : 'Lưu & tính macro'}</button>
      </div>
    </form>
  )
}

function WeightHistory({ current, target }: { current: number; target: number | null }) {
  const qc = useQueryClient()
  const [range, setRange] = useState<'30' | '90' | '365'>('90')
  const to = isoDate()
  const from = addDays(to, -Number(range))
  const weights = useWeights(from, to)
  const [adding, setAdding] = useState(false)
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/body/weights/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weights'] })
      qc.invalidateQueries({ queryKey: ['habits'] })
    },
  })
  const data = (weights.data ?? []).map((w) => ({ date: w.logDate, kg: Number(w.weightKg) }))

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-head">
        <h2>Lịch sử cân nặng</h2>
        <button className="btn sm" onClick={() => setAdding(true)}><Scale size={16} /> Cân</button>
      </div>
      <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30 ngày' }, { value: '90', label: '3 tháng' }, { value: '365', label: '1 năm' }]} />
      {data.length > 1 ? (
        <div style={{ height: 220, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div className="tooltip-box">{shortDate(String(payload[0].payload.date))}: <b>{num(Number(payload[0].value), 1)} kg</b></div>
              ) : null} />
              {target && <ReferenceLine y={target} stroke="var(--primary)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted small">Cân thêm vài lần để xem biểu đồ.</p>}
      <div className="list" style={{ marginTop: 8 }}>
        {[...(weights.data ?? [])].reverse().slice(0, 10).map((w) => (
          <div className="list-item" key={w.id}>
            <div className="grow">{shortDate(w.logDate)}{w.note && <span className="muted small"> · {w.note}</span>}</div>
            <b className="tnum">{num(Number(w.weightKg), 1)} kg</b>
            {w.bodyFatPct && <span className="muted small tnum">{num(Number(w.bodyFatPct), 1)}% mỡ</span>}
            <button className="icon-btn plain" aria-label="Xóa" onClick={() => del.mutate(w.id)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      {adding && <WeightSheet current={current} onClose={() => setAdding(false)} />}
    </div>
  )
}
