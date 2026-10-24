import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { isoDate } from '../../lib/format'
import { ErrorText, Sheet } from '../../components/ui'

export default function WeightSheet({ onClose, current }: { onClose: () => void; current?: number }) {
  const qc = useQueryClient()
  const [date, setDate] = useState(isoDate())
  const [weight, setWeight] = useState(current ? String(current) : '')
  const [fat, setFat] = useState('')
  const save = useMutation({
    mutationFn: () => api.post('/api/body/weights', {
      logDate: date, weightKg: Number(weight.replace(',', '.')), bodyFatPct: fat ? Number(fat.replace(',', '.')) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weights'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      onClose()
    },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  return (
    <Sheet title="Ghi cân nặng" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Ngày</span>
          <input className="input" type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="grid-2">
          <label className="field"><span>Cân nặng</span>
            <div className="input-suffix"><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} required autoFocus /><em>kg</em></div>
          </label>
          <label className="field"><span>% mỡ (nếu có)</span>
            <div className="input-suffix"><input className="input" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /><em>%</em></div>
          </label>
        </div>
        <ErrorText error={save.error} />
        <button className="btn block" disabled={save.isPending}>Lưu</button>
      </form>
    </Sheet>
  )
}
