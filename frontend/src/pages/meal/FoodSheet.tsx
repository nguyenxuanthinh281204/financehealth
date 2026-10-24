import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Food, FoodCategory, Meal } from '../../api/types'
import { FOOD_CATEGORIES, MEALS } from '../../lib/format'
import { ErrorText, Sheet } from '../../components/ui'

/** Thêm món riêng của người dùng (giá trị trên 100g). */
export default function FoodSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (f: Food) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<FoodCategory>('PROTEIN')
  const [v, setV] = useState({ kcal: '', protein: '', carbs: '', fat: '', serving: '100', max: '' })
  const [meals, setMeals] = useState<Meal[]>(['BREAKFAST', 'LUNCH', 'DINNER'])
  const n = (s: string) => Number(s.replace(',', '.')) || 0

  const save = useMutation({
    mutationFn: () => api.post<Food>('/api/foods', {
      name, category, kcal: n(v.kcal), protein: n(v.protein), carbs: n(v.carbs), fat: n(v.fat),
      defaultServingG: n(v.serving) || 100, minG: 0, maxG: v.max ? n(v.max) : undefined, meals,
    }),
    onSuccess: (f) => { qc.invalidateQueries({ queryKey: ['foods'] }); onCreated(f); onClose() },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  const estimate = Math.round(n(v.protein) * 4 + n(v.carbs) * 4 + n(v.fat) * 9)

  const numField = (key: keyof typeof v, label: string, unit: string, required = true) => (
    <label className="field"><span>{label}</span>
      <div className="input-suffix"><input className="input" inputMode="decimal" required={required} value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value })} /><em>{unit}</em></div>
    </label>
  )

  return (
    <Sheet title="Thêm món của bạn" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Tên món</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="VD: Cá thu kho" autoFocus />
        </label>
        <div className="field"><span>Nhóm</span>
          <div className="chips">
            {(Object.keys(FOOD_CATEGORIES) as FoodCategory[]).map((c) => (
              <button type="button" key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{FOOD_CATEGORIES[c]}</button>
            ))}
          </div>
        </div>
        <div className="small muted">Giá trị dinh dưỡng trên 100g (xem trên bao bì hoặc tra cứu)</div>
        <div className="grid-2">
          {numField('kcal', 'Năng lượng', 'kcal')}
          {numField('protein', 'Đạm', 'g')}
          {numField('carbs', 'Tinh bột', 'g')}
          {numField('fat', 'Chất béo', 'g')}
          {numField('serving', 'Khẩu phần thường ăn', 'g')}
          {numField('max', 'Tối đa mỗi bữa', 'g', false)}
        </div>
        {estimate > 0 && v.kcal && Math.abs(estimate - n(v.kcal)) > n(v.kcal) * 0.25 && (
          <div className="notice">Theo macro bạn nhập thì khoảng {estimate} kcal/100g. Kiểm tra lại số liệu nhé.</div>
        )}
        <div className="field"><span>Ăn được vào bữa</span>
          <div className="chips">
            {(Object.keys(MEALS) as Meal[]).map((m) => (
              <button type="button" key={m} className={`chip ${meals.includes(m) ? 'on' : ''}`}
                onClick={() => setMeals(meals.includes(m) ? meals.filter((x) => x !== m) : [...meals, m])}>
                {MEALS[m].emoji} {MEALS[m].label}
              </button>
            ))}
          </div>
        </div>
        <ErrorText error={save.error} />
        <button className="btn block" disabled={save.isPending || meals.length === 0}>Lưu món</button>
      </form>
    </Sheet>
  )
}
