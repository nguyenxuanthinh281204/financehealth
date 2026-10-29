import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import type { Moment } from '../api/types'
import { useMoments } from '../lib/queries'
import { currentMonth, monthLabel, monthRange, prettyDate, shiftMonth } from '../lib/format'
import { Empty, Loading } from '../components/ui'
import CameraSheet from './moments/CameraSheet'

export default function Moments() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonth())
  const { from, to } = monthRange(month)
  const moments = useMoments(from, to)
  const [camera, setCamera] = useState(false)
  const [viewing, setViewing] = useState<Moment | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, Moment[]>()
    for (const x of moments.data ?? []) m.set(x.takenOn, [...(m.get(x.takenOn) ?? []), x])
    return [...m.entries()]
  }, [moments.data])

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/moments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moments'] })
      qc.invalidateQueries({ queryKey: ['habits'] })
      setViewing(null)
    },
  })

  return (
    <>
      <div className="page-head">
        <div><h1>Khoảnh khắc</h1><div className="sub">Mỗi ngày một tấm ảnh hoặc video 5 giây</div></div>
        <button className="btn sm" onClick={() => setCamera(true)}><Camera size={16} /> Chụp</button>
      </div>

      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
        <b>{monthLabel(month)} · {moments.data?.length ?? 0} khoảnh khắc</b>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonth()} aria-label="Tháng sau"><ChevronRight size={18} /></button>
      </div>

      {moments.isLoading ? <Loading /> : byDay.length === 0 ? (
        <div className="card"><Empty emoji="📷" title="Chưa có khoảnh khắc nào trong tháng">Lưu lại một bữa ăn, buổi tập hay khoảnh khắc vui.</Empty></div>
      ) : byDay.map(([day, items]) => (
        <div key={day}>
          <div className="group-label"><span>{prettyDate(day)}</span><span>{items.length}</span></div>
          <div className="moment-grid">
            {items.map((m) => (
              <button key={m.id} className="moment-tile" onClick={() => setViewing(m)} aria-label={m.caption ?? 'Xem'}>
                {m.mediaType === 'PHOTO' ? <img src={m.url} alt={m.caption ?? ''} loading="lazy" />
                  : <video src={m.url + '#t=0.1'} muted playsInline preload="metadata" />}
                {m.mediaType === 'VIDEO' && <span className="badge">▶ {Number(m.durationSec ?? 0).toFixed(0)}s</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button className="fab" onClick={() => setCamera(true)} aria-label="Chụp khoảnh khắc"><Camera size={24} /></button>
      {camera && <CameraSheet onClose={() => setCamera(false)} />}
      {viewing && (
        <div className="viewer" onClick={() => setViewing(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 560, width: '100%' }}>
            {viewing.mediaType === 'PHOTO' ? <img src={viewing.url} alt="" />
              : <video src={viewing.url} autoPlay loop playsInline controls />}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{viewing.caption}</div>
              <div className="small" style={{ opacity: .7 }}>{prettyDate(viewing.takenOn)}</div>
            </div>
            <div className="row">
              <button className="btn secondary" onClick={() => setViewing(null)}><X size={18} /> Đóng</button>
              <button className="btn danger" onClick={() => del.mutate(viewing.id)} disabled={del.isPending}><Trash2 size={18} /> Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
