import type { Meal, Plan } from '../api/types'

export interface Portion {
  key: 'CHICKEN' | 'RICE' | 'VEGGIE'
  label: string
  emoji: string
  /** Tổng gram đã chín trong ngày */
  grams: number
  perMeal: Partial<Record<Meal, number>>
  /** Quy đổi ra khối lượng sống để cân khi nấu, null nếu gần như không đổi */
  raw: { grams: number; label: string } | null
  /** Tên các món trong nhóm (cà rốt, bí đỏ...) */
  foods: string[]
}

const GROUPS: { key: Portion['key']; label: string; emoji: string; rawFactor: number | null; rawLabel: string }[] = [
  { key: 'CHICKEN', label: 'Ức gà', emoji: '🍗', rawFactor: 4 / 3, rawLabel: 'sống' },
  { key: 'RICE', label: 'Cơm', emoji: '🍚', rawFactor: 2 / 5, rawLabel: 'gạo' },
  { key: 'VEGGIE', label: 'Rau củ', emoji: '🥕', rawFactor: null, rawLabel: '' },
]

/** Gom số gram gà, cơm, rau (cà rốt, bí đỏ) của một ngày theo từng bữa, theo thực đơn đã sửa. */
export function dayPortions(plan: Plan): Portion[] {
  return GROUPS.map((g) => {
    const perMeal: Partial<Record<Meal, number>> = {}
    let grams = 0
    const foods = new Set<string>()
    for (const m of plan.meals) {
      const items = m.items.filter((i) => (g.key === 'VEGGIE' ? i.category === 'VEGGIE' : i.stapleKey === g.key))
      items.forEach((i) => foods.add(i.foodName.replace(/ luộc$/, '')))
      const sum = items.reduce((s, i) => s + i.grams, 0)
      if (sum > 0) perMeal[m.meal] = sum
      grams += sum
    }
    const raw = g.rawFactor && grams > 0 ? { grams: Math.round((grams * g.rawFactor) / 5) * 5, label: g.rawLabel } : null
    return { key: g.key, label: g.label, emoji: g.emoji, grams, perMeal, raw, foods: [...foods] }
  })
}
