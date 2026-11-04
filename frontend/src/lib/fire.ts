import { useSyncExternalStore } from 'react'

/** Nền lửa: lưu theo thiết bị (máy yếu có thể tắt riêng mà không ảnh hưởng máy khác). */
export type FireLevel = 'off' | 'soft' | 'strong'

export const FIRE_LEVELS: { value: FireLevel; label: string }[] = [
  { value: 'off', label: 'Tắt' },
  { value: 'soft', label: 'Dịu' },
  { value: 'strong', label: 'Rực' },
]

const KEY = 'fh.fire'
const listeners = new Set<() => void>()

function read(): FireLevel {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'soft' || v === 'strong') return v
  } catch { /* trình duyệt chặn storage */ }
  return 'off'
}

let current: FireLevel = read()

export function setFireLevel(level: FireLevel) {
  current = level
  try { localStorage.setItem(KEY, level) } catch { /* bỏ qua */ }
  listeners.forEach((l) => l())
}

export function useFireLevel(): FireLevel {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
}
