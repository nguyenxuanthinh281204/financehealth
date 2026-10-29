import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Flame } from 'lucide-react'
import { api } from '../api/client'
import type { Habit, HabitFrequency, HabitInput, HabitKind, HabitOverview } from '../api/types'
import { addDays, shortDate } from '../lib/format'
import { keys } from '../lib/queries'
import { ErrorText, Segmented, Sheet } from './ui'

export const MEAL_SLOTS = [
  { slot: 1, label: 'Sáng' },
  { slot: 2, label: 'Trưa' },
  { slot: 3, label: 'Tối' },
]

/** Thói quen tự động lấy dữ liệu từ đâu */
export const AUTO_SOURCE: Partial<Record<HabitKind, { hint: string; action: string }>> = {
  EXPENSE: { hint: 'Tự đánh dấu khi có khoản chi', action: 'Ghi chi' },
  MOMENT: { hint: 'Tự đánh dấu khi có ảnh/video', action: 'Chụp' },
  WEIGHT: { hint: 'Tự đánh dấu khi cân trong tuần', action: 'Cân' },
}

const EMOJIS = ['💧', '🏃', '💪', '📚', '🧘', '😴', '🦷', '🚭', '✍️', '🙏', '🥦', '☀️']

function replaceHabit(data: HabitOverview | undefined, h: Habit): HabitOverview | undefined {
  return data && { ...data, habits: data.habits.map((x) => (x.id === h.id ? h : x)) }
}

/** Tick hoặc bỏ tick, cập nhật giao diện ngay rồi lấy kết quả thật từ máy chủ. */
export function useHabitCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ habit, date, slot, done }: { habit: Habit; date: string; slot: number; done: boolean }) =>
      api.put<Habit>(`/api/habits/${habit.id}/checks`, { date, slot, done }),
    onMutate: async ({ habit, date, slot, done }) => {
      await qc.cancelQueries({ queryKey: keys.habits })
      const prev = qc.getQueryData<HabitOverview>(keys.habits)
      if (prev && date === prev.today) {
        const slots = done ? [...new Set([...habit.todaySlots, slot])] : habit.todaySlots.filter((s) => s !== slot)
        const count = habit.kind === 'MEAL' ? slots.length : done ? 1 : 0
        const todayDone = count >= habit.dailyTarget
        qc.setQueryData(keys.habits, replaceHabit(prev, {
          ...habit, todaySlots: slots, todayCount: count,
          done: habit.frequency === 'WEEKLY' ? habit.done || todayDone : todayDone,
        }))
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.habits, ctx.prev),
    onSuccess: (h) => {
      qc.setQueryData<HabitOverview>(keys.habits, (d) => replaceHabit(d, h))
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}

export function StreakBadge({ habit }: { habit: Habit }) {
  if (habit.currentStreak === 0) return null
  return (
    <span className="streak" title={`Chuỗi ${habit.currentStreak} ${habit.frequency === 'WEEKLY' ? 'tuần' : 'ngày'} liên tiếp`}>
      <Flame size={13} /> {habit.currentStreak}{habit.frequency === 'WEEKLY' ? ' tuần' : ''}
    </span>
  )
}

function CheckButton({ done, disabled, onClick, label }: { done: boolean; disabled?: boolean; onClick?: () => void; label: string }) {
  return (
    <button type="button" className={`check-btn${done ? ' on' : ''}`} disabled={disabled} onClick={onClick}
      aria-pressed={done} aria-label={label}>
      <Check size={18} strokeWidth={3} />
    </button>
  )
}

/** Danh sách thói quen hôm nay. onAuto mở màn hình nhập tương ứng cho thói quen tự động chưa xong. */
export function HabitChecklist({ habits, today, onAuto }: {
  habits: Habit[]; today: string; onAuto: (kind: HabitKind) => void
}) {
  const check = useHabitCheck()
  return (
    <div className="list">
      {habits.map((h) => (
        <div className={`habit-row${h.done ? ' done' : ''}`} key={h.id}>
          <div className="avatar" style={{ background: 'var(--surface-2)' }}>{h.emoji}</div>
          <div className="grow">
            <div className="row" style={{ gap: 6 }}>
              <span className="habit-name">{h.name}</span>
              <StreakBadge habit={h} />
            </div>
            {h.kind === 'MEAL' ? (
              <div className="slot-chips">
                {MEAL_SLOTS.map(({ slot, label }) => {
                  const on = h.todaySlots.includes(slot)
                  return (
                    <button key={slot} type="button" className={`slot-chip${on ? ' on' : ''}`} aria-pressed={on}
                      onClick={() => check.mutate({ habit: h, date: today, slot, done: !on })}>
                      {on && <Check size={12} strokeWidth={3} />} {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="small muted">
                {AUTO_SOURCE[h.kind]?.hint ?? (h.frequency === 'WEEKLY' ? 'Ít nhất 1 lần mỗi tuần' : 'Mỗi ngày')}
              </div>
            )}
          </div>
          {h.auto ? (
            h.done ? <CheckButton done disabled label={`${h.name}: đã xong`} />
              : <button type="button" className="btn sm secondary" onClick={() => onAuto(h.kind)}>{AUTO_SOURCE[h.kind]?.action}</button>
          ) : h.kind === 'MEAL' ? (
            <span className="tnum small muted" style={{ width: 36, textAlign: 'center' }}>{h.todaySlots.length}/3</span>
          ) : (
            <CheckButton done={h.todayCount > 0}
              label={`Đánh dấu ${h.name}`}
              onClick={() => check.mutate({ habit: h, date: today, slot: 0, done: h.todayCount === 0 })} />
          )}
        </div>
      ))}
      <ErrorText error={check.error} />
    </div>
  )
}

const LEVEL_LABEL = ['chưa làm', 'làm một phần', 'đã xong']

/** Bản đồ nhiệt kiểu GitHub: mỗi cột một tuần (T2 trên cùng), mỗi ô một ngày. */
export function Heatmap({ history, start }: { history: number[]; start: string }) {
  const weeks = Math.ceil(history.length / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => (i < history.length ? history[i] : -1))
  const months = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(addDays(start, w * 7) + 'T00:00:00')
    return d.getDate() <= 7 ? `T${d.getMonth() + 1}` : ''
  })
  return (
    <div className="heatmap" style={{ ['--weeks' as string]: weeks }}>
      <div className="heatmap-months" aria-hidden>
        {months.map((m, i) => <span key={i}>{m}</span>)}
      </div>
      <div className="heatmap-grid" role="img" aria-label={`Bản đồ ${weeks} tuần gần nhất`}>
        {cells.map((lv, i) => (
          <i key={i} className={lv < 0 ? 'future' : `lv${lv}`}
            title={lv < 0 ? undefined : `${shortDate(addDays(start, i))}: ${LEVEL_LABEL[lv]}`} />
        ))}
      </div>
    </div>
  )
}

/** 7 ngày gần nhất, tick bù được với thói quen tự thêm. */
export function RecentDays({ habit, today }: { habit: Habit; today: string }) {
  const check = useHabitCheck()
  const offset = habit.history.length - 7
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'narrow' })
  return (
    <div className="recent-days">
      {days.map((d, i) => {
        const lv = habit.history[offset + i] ?? 0
        const on = lv === 2
        const editable = habit.kind === 'CUSTOM'
        return (
          <button key={d} type="button" className={`recent-day lv${lv}${d === today ? ' today' : ''}`}
            disabled={!editable || check.isPending} aria-pressed={on}
            title={editable ? (on ? 'Bỏ đánh dấu' : 'Đánh dấu bù') : undefined}
            onClick={() => check.mutate({ habit, date: d, slot: 0, done: !on })}>
            <span>{weekday.format(new Date(d + 'T00:00:00'))}</span>
            <b>{on ? <Check size={14} strokeWidth={3} /> : Number(d.slice(8))}</b>
          </button>
        )
      })}
    </div>
  )
}

export function HabitSheet({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '💧')
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'DAILY')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const custom = !habit || habit.kind === 'CUSTOM'

  const done = () => {
    qc.invalidateQueries({ queryKey: keys.habits })
    qc.invalidateQueries({ queryKey: ['summary'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: (body: HabitInput) => habit ? api.patch<Habit>(`/api/habits/${habit.id}`, body) : api.post<Habit>('/api/habits', body),
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: () => api.del(`/api/habits/${habit!.id}`), onSuccess: done })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ name: name.trim(), emoji, ...(custom ? { frequency } : {}) })
  }

  return (
    <Sheet title={habit ? 'Sửa thói quen' : 'Thêm thói quen'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Tên thói quen</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            placeholder="Uống 2 lít nước, chạy bộ 20 phút..." required autoFocus={!habit} />
        </label>
        <div className="field"><span>Biểu tượng</span>
          <div className="chips">
            {[...new Set([emoji, ...EMOJIS])].map((e) => (
              <button key={e} type="button" className={`chip emoji-chip${e === emoji ? ' on' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
        {custom && (
          <div className="field"><span>Tần suất</span>
            <Segmented value={frequency} onChange={setFrequency}
              options={[{ value: 'DAILY', label: 'Mỗi ngày' }, { value: 'WEEKLY', label: 'Mỗi tuần' }]} />
          </div>
        )}
        <ErrorText error={save.error ?? remove.error} />
        <button className="btn block" disabled={save.isPending || !name.trim()}>{habit ? 'Lưu' : 'Thêm thói quen'}</button>
        {habit && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn secondary grow" disabled={save.isPending}
              onClick={() => save.mutate({ archived: !habit.archived })}>
              {habit.archived ? 'Theo dõi lại' : 'Tạm ẩn'}
            </button>
            {habit.kind === 'CUSTOM' && (
              <button type="button" className="btn danger grow" disabled={remove.isPending}
                onClick={() => (confirmDelete ? remove.mutate() : setConfirmDelete(true))}>
                {confirmDelete ? 'Bấm lần nữa để xóa' : 'Xóa'}
              </button>
            )}
          </div>
        )}
        {habit && !custom && <div className="small muted">Thói quen mặc định không xóa được, chỉ tạm ẩn.</div>}
      </form>
    </Sheet>
  )
}
