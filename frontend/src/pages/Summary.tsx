import { useState } from 'react'
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useSummary } from '../lib/queries'
import { EXPENSE_CATEGORIES, currentMonth, money, moneyShort, monthLabel, num, shiftMonth, shortDate } from '../lib/format'
import { Empty, ErrorText, Loading } from '../components/ui'

export default function Summary() {
  const [month, setMonth] = useState(currentMonth())
  const summary = useSummary(month)
  const s = summary.data
  const isCurrent = month === currentMonth()

  return (
    <>
      <div className="page-head">
        <div><h1>Tổng kết</h1><div className="sub">{isCurrent ? 'Tháng này tới hôm nay' : 'Nhìn lại cả tháng'}</div></div>
      </div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
        <h2>{monthLabel(month)}</h2>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Tháng sau"><ChevronRight size={18} /></button>
      </div>

      {summary.isLoading ? <Loading /> : summary.error ? <ErrorText error={summary.error} /> : s && (
        <>
          <div className="grid-2 grid-md-3" style={{ display: 'grid', gap: 12 }}>
            <div className="card stat">
              <div className="label">Tổng chi</div>
              <div className="value" style={{ color: 'var(--spend)' }}>{money(s.spending.total)}</div>
              {s.spending.changePct != null && (
                <div className={`hint ${s.spending.changePct > 0 ? 'up' : 'down'}`}>
                  {s.spending.changePct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(s.spending.changePct)}% so với tháng trước
                </div>
              )}
            </div>
            <div className="card stat">
              <div className="label">Trung bình/ngày</div>
              <div className="value">{money(s.spending.avgPerDay)}</div>
              <div className="hint">{s.spending.count} khoản chi</div>
            </div>
            <div className="card stat">
              <div className="label">Cân nặng</div>
              <div className="value">{s.weight.end != null ? `${num(s.weight.end, 1)} kg` : '—'}</div>
              {s.weight.change != null && (
                <div className={`hint ${s.weight.change > 0 ? 'up' : 'down'}`}>
                  {s.weight.change > 0 ? '+' : ''}{num(s.weight.change, 1)} kg trong tháng
                </div>
              )}
            </div>
            <div className="card stat">
              <div className="label">Ngày có thực đơn</div>
              <div className="value">{s.nutrition.plannedDays}</div>
              {s.nutrition.avgPlannedKcal != null && <div className="hint">TB {num(s.nutrition.avgPlannedKcal)}/{num(s.nutrition.avgTargetKcal)} kcal</div>}
            </div>
            <div className="card stat">
              <div className="label">Đạm trung bình</div>
              <div className="value">{s.nutrition.avgProtein != null ? `${s.nutrition.avgProtein}g` : '—'}</div>
              {s.nutrition.avgTargetProtein != null && <div className="hint">mục tiêu {s.nutrition.avgTargetProtein}g</div>}
            </div>
            <div className="card stat">
              <div className="label">Khoảnh khắc</div>
              <div className="value">{s.moments.count}</div>
              <div className="hint">ảnh & video</div>
            </div>
          </div>

          <div className="grid grid-md-2" style={{ marginTop: 12 }}>
            <div className="card">
              <h2 style={{ marginBottom: 8 }}>Chi theo danh mục</h2>
              {s.spending.byCategory.length === 0 ? <Empty emoji="🧾" title="Chưa có chi tiêu" /> : (
                <div className="row wrap" style={{ alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                  <div style={{ width: 140, height: 140, flex: 'none' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={s.spending.byCategory} dataKey="amount" nameKey="category" innerRadius={42} outerRadius={68} paddingAngle={2} stroke="none">
                          {s.spending.byCategory.map((c) => <Cell key={c.category} fill={EXPENSE_CATEGORIES[c.category].color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grow stack small" style={{ minWidth: 220 }}>
                    {s.spending.byCategory.map((c) => (
                      <div className="row" key={c.category}>
                        <span className="legend-dot" style={{ background: EXPENSE_CATEGORIES[c.category].color }} />
                        <span className="grow">{EXPENSE_CATEGORIES[c.category].label}</span>
                        <b className="tnum">{money(c.amount)}</b>
                        <span className="muted tnum" style={{ width: 36, textAlign: 'right' }}>{Math.round((c.amount / s.spending.total) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 8 }}>Chi từng ngày</h2>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={s.spending.daily} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                    <XAxis dataKey="date" tickFormatter={(d) => String(Number(d.slice(8)))} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => active && payload?.length ? (
                      <div className="tooltip-box">{shortDate(String(payload[0].payload.date))}: <b>{money(Number(payload[0].value))}</b></div>
                    ) : null} />
                    <Bar dataKey="amount" fill="var(--spend)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 8 }}>Cân nặng trong tháng</h2>
              {s.weight.points.length < 2 ? <Empty emoji="⚖️" title="Cần ít nhất 2 lần cân">Cân đều mỗi tuần để thấy xu hướng.</Empty> : (
                <>
                  <div className="row between small" style={{ marginBottom: 6 }}>
                    <span className="muted">Đầu tháng <b style={{ color: 'var(--text)' }}>{num(s.weight.start, 1)} kg</b></span>
                    <span className="muted">Thấp nhất {num(s.weight.min, 1)} · Cao nhất {num(s.weight.max, 1)}</span>
                  </div>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer>
                      <LineChart data={s.weight.points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={44} />
                        <Tooltip content={({ active, payload }) => active && payload?.length ? (
                          <div className="tooltip-box">{shortDate(String(payload[0].payload.date))}: <b>{num(Number(payload[0].value), 1)} kg</b></div>
                        ) : null} />
                        {s.weight.target && <ReferenceLine y={s.weight.target} stroke="var(--primary)" strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="weightKg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 8 }}>Chi nhiều nhất ở</h2>
              {s.spending.topMerchants.length === 0 ? <p className="muted small">Ghi tên cửa hàng khi nhập chi tiêu để xem mục này.</p> : (
                <div className="list">
                  {s.spending.topMerchants.map((m, i) => (
                    <div className="list-item" key={m.merchant}>
                      <span className="avatar" style={{ background: 'var(--surface-2)', fontSize: 15, fontWeight: 700 }}>{i + 1}</span>
                      <div className="grow">{m.merchant}<div className="small muted">{m.count} lần</div></div>
                      <b className="tnum">{money(m.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {s.habits.items.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-head">
                <h2>Thói quen trong tháng</h2>
                {s.habits.percent != null && <span className="habit-rate tnum">{s.habits.percent}%</span>}
              </div>
              <div className="stack">
                {s.habits.items.map((h) => (
                  <div className="habit-month-row" key={h.id}>
                    <span className="grow">{h.emoji} {h.name}</span>
                    <div className="bar"><i style={{ width: `${h.percent ?? 0}%` }} /></div>
                    <span className="small tnum muted">
                      {h.total === 0 ? '—' : <><b style={{ color: 'var(--text)' }}>{h.done}</b>/{h.total} {h.frequency === 'WEEKLY' ? 'tuần' : 'ngày'}</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s.moments.previewUrls.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <h2 style={{ marginBottom: 10 }}>Khoảnh khắc trong tháng</h2>
              <div className="moment-grid">
                {s.moments.previewUrls.map((u) => <div className="moment-tile" key={u}><img src={u} alt="" loading="lazy" /></div>)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
