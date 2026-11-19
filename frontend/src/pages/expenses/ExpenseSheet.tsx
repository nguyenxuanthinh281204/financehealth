import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../../api/client'
import type { Expense, ExpenseCategory, ExpenseInput, LineItem } from '../../api/types'
import { EXPENSE_CATEGORIES, isoDate, money } from '../../lib/format'
import { ErrorText, Sheet } from '../../components/ui'

export default function ExpenseSheet({ onClose, expense }: { onClose: () => void; expense?: Expense }) {
  const qc = useQueryClient()
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? isoDate())
  const [amount, setAmount] = useState(expense ? String(Math.round(expense.amount)) : '')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'FOOD')
  const [merchant, setMerchant] = useState(expense?.merchant ?? '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [items, setItems] = useState<LineItem[]>(expense?.items ?? [])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] })
    qc.invalidateQueries({ queryKey: ['summary'] })
    qc.invalidateQueries({ queryKey: ['habits'] })
  }

  const save = useMutation({
    mutationFn: () => {
      const body: ExpenseInput = {
        spentOn, amount: Number(amount.replace(/[^\d]/g, '')), category,
        merchant: merchant || undefined, note: note || undefined,
        items: items.filter((i) => i.name.trim()),
      }
      return expense ? api.put(`/api/expenses/${expense.id}`, body) : api.post('/api/expenses', body)
    },
    onSuccess: () => { invalidate(); onClose() },
  })

  const remove = useMutation({
    mutationFn: () => api.del(`/api/expenses/${expense!.id}`),
    onSuccess: () => { invalidate(); onClose() },
  })

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  const amountView = amount ? Number(amount.replace(/[^\d]/g, '')).toLocaleString('vi-VN') : ''

  return (
    <Sheet title={expense ? 'Sửa khoản chi' : 'Thêm khoản chi'} onClose={onClose}>
      {expense?.receiptUrl && <img src={expense.receiptUrl} alt="Ảnh hóa đơn" className="receipt-thumb" style={{ marginBottom: 12 }} />}

      <form className="form" onSubmit={submit}>
        <label className="field"><span>Số tiền</span>
          <div className="input-suffix">
            <input className="input tnum" inputMode="numeric" value={amountView} required placeholder="0"
              style={{ fontSize: 22, fontWeight: 700 }}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} autoFocus={!expense} />
            <em>đ</em>
          </div>
        </label>
        <div className="field"><span>Danh mục</span>
          <div className="chips">
            {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((c) => (
              <button type="button" key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
                {EXPENSE_CATEGORIES[c].emoji} {EXPENSE_CATEGORIES[c].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-2">
          <label className="field"><span>Ngày</span>
            <input className="input" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
          </label>
          <label className="field"><span>Cửa hàng</span>
            <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={150} placeholder="VD: Bách Hóa Xanh" />
          </label>
        </div>
        <label className="field"><span>Ghi chú</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>

        <div className="field">
          <span>Món hàng ({items.length})</span>
          {items.map((it, i) => (
            <div className="row" key={i}>
              <input className="input grow" value={it.name} placeholder="Tên món"
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input tnum" style={{ width: 110 }} inputMode="numeric" placeholder="Giá" value={it.price ?? ''}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/[^\d]/g, '')) || null } : x)))} />
              <button type="button" className="icon-btn plain" aria-label="Bỏ món" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={16} /></button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => setItems([...items, { name: '', quantity: 1, price: null }])}><Plus size={16} /> Thêm món</button>
          {items.length > 0 && (
            <small className="muted">Tổng các món: {money(items.reduce((s, i) => s + (i.price ?? 0), 0))}</small>
          )}
        </div>

        <ErrorText error={save.error ?? remove.error} />
        <div className="row">
          {expense && (
            <button type="button" className="btn danger" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label="Xóa">
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn grow" disabled={save.isPending || !amount}>{save.isPending ? 'Đang lưu…' : 'Lưu khoản chi'}</button>
        </div>
      </form>
    </Sheet>
  )
}
