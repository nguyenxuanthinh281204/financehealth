import { useState } from 'react'
import { Flame, Pencil, Plus, Trophy } from 'lucide-react'
import type { Habit } from '../api/types'
import { useHabits } from '../lib/queries'
import { AUTO_SOURCE, HabitSheet, Heatmap, RecentDays } from '../components/habits'
import { Empty, ErrorText, Loading } from '../components/ui'

export default function Habits() {
  const habits = useHabits()
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const data = habits.data
  const active = data?.habits.filter((h) => !h.archived) ?? []
  const archived = data?.habits.filter((h) => h.archived) ?? []

  return (
    <>
      <div className="page-head">
        <div><h1>Thói quen</h1><div className="sub">Chuỗi ngày liên tiếp và 26 tuần gần nhất</div></div>
        <button className="btn sm" onClick={() => setEditing('new')}><Plus size={16} /> Thêm</button>
      </div>

      {habits.isLoading ? <Loading /> : habits.error ? <ErrorText error={habits.error} /> : data && (
        <>
          {active.length === 0 && <div className="card"><Empty emoji="🌱" title="Chưa theo dõi thói quen nào" /></div>}
          <div className="grid grid-md-2">
            {active.map((h) => (
              <div className="card" key={h.id}>
                <div className="card-head" style={{ marginBottom: 8 }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <div className="avatar" style={{ background: 'var(--surface-2)' }}>{h.emoji}</div>
                    <div style={{ minWidth: 0 }}>
                      <h2 className="habit-title">{h.name}</h2>
                      <div className="small muted">
                        {AUTO_SOURCE[h.kind]?.hint ?? (h.kind === 'MEAL' ? 'Tick đủ 3 bữa ở màn Hôm nay'
                          : h.frequency === 'WEEKLY' ? 'Ít nhất 1 lần mỗi tuần' : 'Mỗi ngày')}
                      </div>
                    </div>
                  </div>
                  <button className="icon-btn plain" onClick={() => setEditing(h)} aria-label={`Sửa ${h.name}`}><Pencil size={16} /></button>
                </div>
                <div className="habit-stats">
                  <div><Flame size={14} color="var(--spend)" /> <b className="tnum">{h.currentStreak}</b> {h.frequency === 'WEEKLY' ? 'tuần' : 'ngày'} liên tiếp</div>
                  <div><Trophy size={14} color="var(--carbs)" /> dài nhất <b className="tnum">{h.bestStreak}</b></div>
                  {h.rate30 != null && <div><b className="tnum">{h.rate30}%</b> 30 ngày</div>}
                </div>
                <Heatmap history={h.history} start={data.historyStart} />
                {h.kind === 'CUSTOM' && <RecentDays habit={h} today={data.today} />}
              </div>
            ))}
          </div>

          {archived.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button className="btn ghost sm" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Ẩn' : 'Xem'} {archived.length} thói quen đã tạm ẩn
              </button>
              {showArchived && (
                <div className="card list" style={{ marginTop: 8 }}>
                  {archived.map((h) => (
                    <div className="list-item" key={h.id}>
                      <div className="avatar" style={{ background: 'var(--surface-2)' }}>{h.emoji}</div>
                      <div className="grow muted">{h.name}</div>
                      <button className="btn sm secondary" onClick={() => setEditing(h)}>Sửa</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editing && <HabitSheet habit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
