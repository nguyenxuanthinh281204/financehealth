import type { ExpenseCategory, FoodCategory, Meal, ActivityLevel, Goal } from '../api/types'

const vnd = new Intl.NumberFormat('vi-VN')
export const money = (n: number | null | undefined) => (n == null ? '—' : `${vnd.format(Math.round(n))}đ`)
export const moneyShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')}tr`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${n}`
}
export const num = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(n)

/** Ngày theo giờ máy người dùng, dạng YYYY-MM-DD */
export function isoDate(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}
export const currentMonth = () => isoDate().slice(0, 7)
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' })
export function prettyDate(iso: string) {
  const today = isoDate()
  if (iso === today) return 'Hôm nay'
  if (iso === addDays(today, -1)) return 'Hôm qua'
  if (iso === addDays(today, 1)) return 'Ngày mai'
  const d = new Date(iso + 'T00:00:00')
  const w = weekday.format(d)
  return `${w.charAt(0).toUpperCase() + w.slice(1)}, ${d.getDate()}/${d.getMonth() + 1}`
}
export const shortDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}
export const monthLabel = (month: string) => {
  const [y, m] = month.split('-')
  return `Tháng ${Number(m)}/${y}`
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; color: string; emoji: string }> = {
  FOOD: { label: 'Ăn uống', color: '#e07a5f', emoji: '🍜' },
  GROCERIES: { label: 'Đi chợ, siêu thị', color: '#81b29a', emoji: '🛒' },
  TRANSPORT: { label: 'Di chuyển', color: '#3d85c6', emoji: '🛵' },
  SHOPPING: { label: 'Mua sắm', color: '#c27ba0', emoji: '🛍️' },
  BILLS: { label: 'Hóa đơn', color: '#f2cc8f', emoji: '💡' },
  HEALTH: { label: 'Sức khỏe', color: '#6aa84f', emoji: '💊' },
  ENTERTAINMENT: { label: 'Giải trí', color: '#8e7cc3', emoji: '🎬' },
  EDUCATION: { label: 'Học tập', color: '#45818e', emoji: '📚' },
  OTHER: { label: 'Khác', color: '#999999', emoji: '📦' },
}

export const MEALS: Record<Meal, { label: string; emoji: string }> = {
  BREAKFAST: { label: 'Bữa sáng', emoji: '🌅' },
  LUNCH: { label: 'Bữa trưa', emoji: '☀️' },
  DINNER: { label: 'Bữa tối', emoji: '🌙' },
}

export const FOOD_CATEGORIES: Record<FoodCategory, string> = {
  PROTEIN: 'Đạm', CARB: 'Tinh bột', FAT: 'Chất béo', VEGGIE: 'Rau củ', FRUIT: 'Trái cây', DAIRY: 'Sữa', OTHER: 'Khác',
}

export const ACTIVITY: Record<ActivityLevel, { label: string; hint: string }> = {
  SEDENTARY: { label: 'Ít vận động', hint: 'Ngồi văn phòng, hầu như không tập' },
  LIGHT: { label: 'Nhẹ', hint: 'Tập 1–3 buổi/tuần' },
  MODERATE: { label: 'Vừa', hint: 'Tập 3–5 buổi/tuần' },
  ACTIVE: { label: 'Nhiều', hint: 'Tập nặng 6–7 buổi/tuần' },
  VERY_ACTIVE: { label: 'Rất nhiều', hint: 'Tập 2 buổi/ngày hoặc lao động nặng' },
}

export const GOALS: Record<Goal, { label: string; hint: string }> = {
  LOSE: { label: 'Giảm mỡ', hint: 'Thâm hụt ~20% calo' },
  MAINTAIN: { label: 'Giữ cân', hint: 'Ăn bằng mức tiêu hao' },
  GAIN: { label: 'Tăng cơ', hint: 'Dư ~10% calo' },
}
