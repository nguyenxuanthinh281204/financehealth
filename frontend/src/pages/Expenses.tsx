import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Expense, ExpenseCategory } from '../api/types'
import { useExpenses } from '../lib/queries'
import { EXPENSE_CATEGORIES, currentMonth, money, monthLabel, monthRange, prettyDate, shiftMonth } from '../lib/format'
import { Empty, Loading } from '../components/ui'
import ExpenseSheet from './expenses/ExpenseSheet'

export default function Expenses() {
  const [month, setMonth] = useState(currentMonth())
  const { from, to } = monthRange(month)
  const expenses = useExpenses(from, to)
  const [filter, setFilter] = useState<ExpenseCategory | null>(null)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const list = useMemo(() => (expenses.data ?? []).filter((e) => !filter || e.category === filter), [expenses.data, filter])
  const total = list.reduce((s, e) => s + e.amount, 0)
  const byDay = useMemo(() => {
    const m = new Map<string, Expense[]>()
    for (const e of list) m.set(e.spentOn, [...(m.get(e.spentOn) ?? []), e])
    return [...m.entries()]
  }, [list])
  const usedCategories = useMemo(() => [...new Set((expenses.data ?? []).map((e) => e.category))], [expenses.data])

  return (
    <>
      <div className="page-head">
        <div><h1>Chi tiêu</h1><div className="sub">Nhập tay hoặc chụp hóa đơn để tự điền</div></div>
        <button className="btn sm" onClick={() => setEditing('new')}><Plus size={16} /> Thêm</button>
      </div>

      <div className="card hero">
        <div className="row between">
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }}
            onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="muted small">{monthLabel(month)}{filter && ` · ${EXPENSE_CATEGORIES[filter].label}`}</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }} className="tnum">{money(total)}</div>
            <div className="muted small">{list.length} khoản chi</div>
          </div>
          <button className="icon-btn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }}
            onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonth()} aria-label="Tháng sau"><ChevronRight size={18} /></button>
        </div>
      </div>

      {usedCategories.length > 1 && (
        <div className="scroll-x" style={{ marginTop: 12 }}>
          <button className={`chip ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>Tất cả</button>
          {usedCategories.map((c) => (
            <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(filter === c ? null : c)}>
              {EXPENSE_CATEGORIES[c].emoji} {EXPENSE_CATEGORIES[c].label}
            </button>
          ))}
        </div>
      )}

      {expenses.isLoading ? <Loading /> : byDay.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <Empty emoji="🧾" title="Chưa có khoản chi nào">Bấm nút + để thêm, hoặc chụp hóa đơn cho nhanh.</Empty>
        </div>
      ) : byDay.map(([day, items]) => (
        <div key={day}>
          <div className="group-label"><span>{prettyDate(day)}</span><span className="tnum">{money(items.reduce((s, e) => s + e.amount, 0))}</span></div>
          <div className="card" style={{ padding: '4px 16px' }}>
            <div className="list">
              {items.map((e) => (
                <button key={e.id} className="list-item" style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--border)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setEditing(e)}>
                  <div className="avatar" style={{ background: EXPENSE_CATEGORIES[e.category].color + '26' }}>{EXPENSE_CATEGORIES[e.category].emoji}</div>
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{e.merchant || EXPENSE_CATEGORIES[e.category].label}</div>
                    <div className="small muted">
                      {EXPENSE_CATEGORIES[e.category].label}
                      {e.items.length > 0 && ` · ${e.items.length} món`}
                      {e.receiptUrl && ' · 🧾'}
                      {e.note && ` · ${e.note}`}
                    </div>
                  </div>
                  <b className="tnum">{money(e.amount)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Thêm khoản chi"><Plus size={26} /></button>
      {editing && <ExpenseSheet expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
