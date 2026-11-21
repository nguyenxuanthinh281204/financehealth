/**
 * Khẩu phần gà / cơm / rau cố định mỗi ngày, tính thẳng từ mục tiêu macro trong
 * chỉ số cơ thể, không phụ thuộc thực đơn hay các món đã sửa trong ngày.
 *
 * - Ức gà luộc lo ~75% lượng đạm (phần còn lại từ trứng, bánh mì, cơm)
 * - Cơm trắng lo ~60% lượng tinh bột (phần còn lại từ bánh mì, táo, rau củ)
 * - Rau củ luộc (cà rốt, bí đỏ) cố định 300 g/ngày
 * Dinh dưỡng trên 100 g chín lấy theo bảng foods: ức gà 31 g đạm, cơm 28,2 g tinh bột.
 */
export const CHICKEN_PROTEIN_SHARE = 0.75
export const RICE_CARB_SHARE = 0.6
export const VEGGIE_GRAMS = 300
const CHICKEN_PROTEIN_PER_G = 31 / 100
const RICE_CARBS_PER_G = 28.2 / 100

export interface Portion {
  key: 'CHICKEN' | 'RICE' | 'VEGGIE'
  label: string
  emoji: string
  /** Gram đã chín cho cả ngày */
  grams: number
  /** Gợi ý chia bữa trưa / tối */
  lunch: number
  dinner: number
  /** Quy đổi sang khối lượng sống để cân khi nấu */
  raw: { grams: number; label: string } | null
  note: string
}

const round5 = (n: number) => Math.round(n / 5) * 5

export function dailyPortions(macros: { protein: number; carbs: number }): Portion[] {
  const chicken = round5((macros.protein * CHICKEN_PROTEIN_SHARE) / CHICKEN_PROTEIN_PER_G)
  const rice = round5((macros.carbs * RICE_CARB_SHARE) / RICE_CARBS_PER_G)
  const split = (g: number) => ({ lunch: round5(g / 2), dinner: g - round5(g / 2) })
  return [
    { key: 'CHICKEN', label: 'Ức gà', emoji: '🍗', grams: chicken, ...split(chicken),
      raw: { grams: round5((chicken * 4) / 3), label: 'sống' }, note: `≈ ${Math.round(CHICKEN_PROTEIN_SHARE * 100)}% đạm` },
    { key: 'RICE', label: 'Cơm', emoji: '🍚', grams: rice, ...split(rice),
      raw: { grams: round5((rice * 2) / 5), label: 'gạo' }, note: `≈ ${Math.round(RICE_CARB_SHARE * 100)}% tinh bột` },
    { key: 'VEGGIE', label: 'Rau củ', emoji: '🥕', grams: VEGGIE_GRAMS, ...split(VEGGIE_GRAMS),
      raw: null, note: 'cà rốt, bí đỏ' },
  ]
}
