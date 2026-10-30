export type Sex = 'MALE' | 'FEMALE'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN'
export type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER'
export type FoodCategory = 'PROTEIN' | 'CARB' | 'FAT' | 'VEGGIE' | 'FRUIT' | 'DAIRY' | 'OTHER'
export type ExpenseCategory =
  | 'FOOD' | 'GROCERIES' | 'TRANSPORT' | 'SHOPPING' | 'BILLS' | 'HEALTH' | 'ENTERTAINMENT' | 'EDUCATION' | 'OTHER'

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK'
export type AccentColor = 'green' | 'teal' | 'blue' | 'violet' | 'pink' | 'orange' | 'yellow'
export interface User { id: number; email: string; displayName: string; themeMode: ThemeMode; accentColor: AccentColor }
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
export interface PlanItem {
  id: number; foodId: number; foodName: string; category: FoodCategory; grams: number
  unitG: number | null; unitName: string | null; macros: MacroTotals
}
export interface MealView { meal: Meal; target: MacroTotals; total: MacroTotals; items: PlanItem[] }
export interface Plan { id: number; date: string; target: MacroTotals; total: MacroTotals; meals: MealView[] }
export interface ShoppingItem { foodName: string; category: FoodCategory; grams: number; unitG: number | null; unitName: string | null }
export interface Staple {
  foodId: number; name: string; category: FoodCategory; defaultGrams: number
  unitG: number | null; unitName: string | null; per100g: MacroTotals
}
export interface WeekMenu {
  weekStart: string; weekEnd: string; created: boolean; canCreate: boolean
  ingredients: string[]; staples: Staple[]; days: Plan[]; shopping: ShoppingItem[]
}

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

export type HabitKind = 'EXPENSE' | 'MOMENT' | 'WEIGHT' | 'MEAL' | 'CUSTOM'
export type HabitFrequency = 'DAILY' | 'WEEKLY'
export interface Habit {
  id: number; kind: HabitKind; name: string; emoji: string; frequency: HabitFrequency
  auto: boolean; dailyTarget: number; archived: boolean
  /** Hôm nay (WEEKLY: tuần này) đã đạt chưa */
  done: boolean; todayCount: number; todaySlots: number[]
  currentStreak: number; bestStreak: number; rate30: number | null
  /** Mức 0/1/2 từng ngày, từ historyStart tới hôm nay */
  history: number[]
}
export interface HabitOverview { today: string; historyStart: string; habits: Habit[] }
export interface HabitInput { name?: string; emoji?: string; frequency?: HabitFrequency; archived?: boolean }

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
  habits: {
    percent: number | null
    items: { id: number; name: string; emoji: string; frequency: HabitFrequency; done: number; total: number; percent: number | null }[]
  }
}

export interface TaskListInfo { id: number; name: string }
/** Trường null không có trong JSON (máy chủ bỏ qua giá trị null) */
export interface Task {
  id: number; listId: number; parentId?: number; title: string; notes?: string; dueDate?: string
  starred: boolean; completed: boolean; completedAt?: string; position: number
}
export interface TaskBoard { today: string; lists: TaskListInfo[]; tasks: Task[] }
export interface TaskInput {
  title?: string; notes?: string; dueDate?: string; clearDue?: boolean; starred?: boolean; completed?: boolean; listId?: number
}

export type NoteColor =
  | 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'darkblue' | 'purple' | 'pink' | 'brown' | 'gray'
export interface NoteItem { id: string; text: string; checked: boolean }
export interface NoteLabel { id: number; name: string }
/** Trường null không có trong JSON (trashedAt) */
export interface Note {
  id: number; title: string; body: string; checklist: boolean; items: NoteItem[]; color: NoteColor
  pinned: boolean; archived: boolean; trashedAt?: string; position: number; labelIds: number[]
  createdAt: string; updatedAt: string
}
export interface NotesBoard { labels: NoteLabel[]; notes: Note[] }
export interface NoteInput {
  title?: string; body?: string; checklist?: boolean; items?: NoteItem[]; color?: NoteColor
  pinned?: boolean; archived?: boolean; trashed?: boolean; labelIds?: number[]
}
