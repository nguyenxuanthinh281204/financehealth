import { useSyncExternalStore } from 'react'

/** Nền động phía sau giao diện. Lưu theo thiết bị (máy yếu có thể tắt riêng mà không ảnh hưởng máy khác). */
export type BgEffect = 'off' | 'fire' | 'waves' | 'rain'
export type BgLevel = 'soft' | 'strong'
export interface BgSetting { effect: BgEffect; level: BgLevel }

export const BG_EFFECTS: { value: BgEffect; label: string }[] = [
  { value: 'off', label: 'Tắt' },
  { value: 'fire', label: 'Lửa' },
  { value: 'waves', label: 'Sóng nước' },
  { value: 'rain', label: 'Mưa' },
]

export const BG_LEVELS: { value: BgLevel; label: string }[] = [
  { value: 'soft', label: 'Dịu' },
  { value: 'strong', label: 'Mạnh' },
]

const KEY = 'fh.bg'
const LEGACY_FIRE_KEY = 'fh.fire'
const EFFECT_VALUES: BgEffect[] = ['off', 'fire', 'waves', 'rain']
const listeners = new Set<() => void>()

function read(): BgSetting {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && EFFECT_VALUES.includes(raw.effect)) {
      return { effect: raw.effect, level: raw.level === 'strong' ? 'strong' : 'soft' }
    }
    // Bản trước chỉ có nền lửa (Tắt/Dịu/Rực)
    const fire = localStorage.getItem(LEGACY_FIRE_KEY)
    if (fire === 'soft' || fire === 'strong') return { effect: 'fire', level: fire }
  } catch { /* trình duyệt chặn storage hoặc JSON hỏng */ }
  return { effect: 'off', level: 'soft' }
}

let current: BgSetting = read()

export function setBackground(patch: Partial<BgSetting>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
    localStorage.removeItem(LEGACY_FIRE_KEY)
  } catch { /* bỏ qua */ }
  listeners.forEach((l) => l())
}

export function useBackground(): BgSetting {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => current,
  )
}
