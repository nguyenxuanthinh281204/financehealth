export type Sex = 'MALE' | 'FEMALE'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN'
export type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER'
export type FoodCategory = 'PROTEIN' | 'CARB' | 'FAT' | 'VEGGIE' | 'FRUIT' | 'DAIRY' | 'OTHER'
export type ExpenseCategory =
  | 'FOOD' | 'GROCERIES' | 'TRANSPORT' | 'SHOPPING' | 'BILLS' | 'HEALTH' | 'ENTERTAINMENT' | 'EDUCATION' | 'OTHER'

export interface User { id: number; email: string; displayName: string }
export interface AuthResponse { token: string; user: User }

export interface Macros {
  age: number; bmi: number; bmiCategory: string; bmr: number; tdee: number
  kcal: number; protein: number; carbs: number; fat: number; waterMl: number
}

export interface Profile {
  sex: Sex; birthDate: string; heightCm: number; weightKg: number
  activityLevel: ActivityLevel; goal: Goal; targetWeightKg: number | null
  macros: Macros
}

export interface WeightLog { id: number; logDate: string; weightKg: number; bodyFatPct: number | null; note: string | null }

export interface Food {
  id: number; name: string; category: FoodCategory
  kcal: number; protein: number; carbs: number; fat: number
  defaultServingG: number; minG: number; maxG: number; meals: Meal[]; custom: boolean
}

export interface MacroTotals { kcal: number; protein: number; carbs: number; fat: number }
export interface PlanItem { id: number; foodId: number; foodName: string; category: FoodCategory; grams: number; macros: MacroTotals }
export interface MealView { meal: Meal; target: MacroTotals; total: MacroTotals; items: PlanItem[] }
export interface Plan { id: number; date: string; target: MacroTotals; total: MacroTotals; meals: MealView[] }

export interface LineItem { name: string; quantity: number | null; price: number | null }
export interface Expense {
  id: number; spentOn: string; amount: number; category: ExpenseCategory
  merchant: string | null; note: string | null; items: LineItem[]; receiptUrl: string | null
}
export interface ExpenseInput {
  spentOn: string; amount: number; category: ExpenseCategory
  merchant?: string; note?: string; items?: LineItem[]; receiptKey?: string | null
}
export interface ScanResult {
  enabled: boolean; receiptKey: string; receiptUrl: string
  merchant?: string; date?: string; total?: number; category?: ExpenseCategory; items: LineItem[]; message?: string
}

export interface Moment {
  id: number; takenOn: string; mediaType: 'PHOTO' | 'VIDEO'; url: string
  contentType: string; durationSec: number | null; caption: string | null
}

export interface MonthlySummary {
  month: string
  spending: {
    total: number; previousTotal: number; changePct: number | null; count: number; avgPerDay: number
    byCategory: { category: ExpenseCategory; amount: number; count: number }[]
    daily: { date: string; amount: number }[]
    topMerchants: { merchant: string; amount: number; count: number }[]
  }
  weight: {
    start: number | null; end: number | null; change: number | null; min: number | null; max: number | null
    target: number | null; points: { date: string; weightKg: number }[]
  }
  nutrition: { plannedDays: number; avgPlannedKcal: number | null; avgTargetKcal: number | null; avgProtein: number | null; avgTargetProtein: number | null }
  moments: { count: number; previewUrls: string[] }
}
