import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Expense, HabitOverview, Moment, MonthlySummary, NotesBoard, Plan, Profile, TaskBoard, WeekMenu, WeightLog } from '../api/types'

export const keys = {
  profile: ['profile'] as const,
  weights: (from: string, to: string) => ['weights', from, to] as const,
  plan: (date: string) => ['plan', date] as const,
  week: (weekStart: string) => ['week', weekStart] as const,
  expenses: (from: string, to: string) => ['expenses', from, to] as const,
  moments: (from: string, to: string) => ['moments', from, to] as const,
  summary: (month: string) => ['summary', month] as const,
  habits: ['habits'] as const,
  tasks: ['tasks'] as const,
  notes: ['notes'] as const,
}

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile | null>('/api/body/profile') })

export const useWeights = (from: string, to: string) =>
  useQuery({ queryKey: keys.weights(from, to), queryFn: () => api.get<WeightLog[]>(`/api/body/weights?from=${from}&to=${to}`) })

export const usePlan = (date: string) =>
  useQuery({ queryKey: keys.plan(date), queryFn: () => api.get<Plan | null>(`/api/meal-plans/${date}`) })

export const useWeekMenu = (weekStart: string) =>
  useQuery({ queryKey: keys.week(weekStart), queryFn: () => api.get<WeekMenu>(`/api/meal-plans/week?date=${weekStart}`) })

export const useExpenses = (from: string, to: string) =>
  useQuery({ queryKey: keys.expenses(from, to), queryFn: () => api.get<Expense[]>(`/api/expenses?from=${from}&to=${to}`) })

export const useMoments = (from: string, to: string) =>
  useQuery({ queryKey: keys.moments(from, to), queryFn: () => api.get<Moment[]>(`/api/moments?from=${from}&to=${to}`) })

export const useSummary = (month: string) =>
  useQuery({ queryKey: keys.summary(month), queryFn: () => api.get<MonthlySummary>(`/api/summary/monthly?month=${month}`) })

export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: () => api.get<HabitOverview>('/api/habits') })

export const useTasks = () => useQuery({ queryKey: keys.tasks, queryFn: () => api.get<TaskBoard>('/api/tasks') })

export const useNotes = () => useQuery({ queryKey: keys.notes, queryFn: () => api.get<NotesBoard>('/api/notes') })
