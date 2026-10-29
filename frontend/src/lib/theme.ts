import type { AccentColor, ThemeMode } from '../api/types'

const STORAGE_KEY = 'fh.theme'

/** Màu chủ đạo; `swatch` là màu ô chọn (bản sáng), giá trị thật nằm trong styles.css theo data-accent. */
export const ACCENTS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: 'green', label: 'Lá', swatch: '#1d6b52' },
  { value: 'teal', label: 'Ngọc', swatch: '#0f7480' },
  { value: 'blue', label: 'Biển', swatch: '#2f5fd0' },
  { value: 'violet', label: 'Tím', swatch: '#6a4bc4' },
  { value: 'pink', label: 'Hồng', swatch: '#c23a78' },
  { value: 'orange', label: 'Cam', swatch: '#b85a14' },
  { value: 'yellow', label: 'Vàng', swatch: '#946500' },
]

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'SYSTEM', label: 'Theo máy' },
  { value: 'LIGHT', label: 'Sáng' },
  { value: 'DARK', label: 'Tối' },
]

/** Gắn giao diện lên <html> và nhớ lại cho lần mở app sau (index.html đọc trước khi React chạy để không nháy màu). */
export function applyTheme(mode: ThemeMode, accent: AccentColor) {
  const root = document.documentElement
  if (mode === 'SYSTEM') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode.toLowerCase())
  if (accent === 'green') root.removeAttribute('data-accent')
  else root.setAttribute('data-accent', accent)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent })) } catch { /* trình duyệt chặn storage */ }
  requestAnimationFrame(() => {
    const color = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  })
}
