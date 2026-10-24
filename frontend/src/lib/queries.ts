import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Expense, Food, Moment, MonthlySummary, Plan, Profile, WeightLog } from '../api/types'

export const keys = {
  profile: ['profile'] as const,
  weights: (from: string, to: string) => ['weights', from, to] as const,
  foods: ['foods'] as const,
  plan: (date: string) => ['plan', date] as const,
  expenses: (from: string, to: string) => ['expenses', from, to] as const,
  moments: (from: string, to: string) => ['moments', from, to] as const,
  summary: (month: string) => ['summary', month] as const,
}

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile | null>('/api/body/profile') })

export const useWeights = (from: string, to: string) =>
  useQuery({ queryKey: keys.weights(from, to), queryFn: () => api.get<WeightLog[]>(`/api/body/weights?from=${from}&to=${to}`) })

export const useFoods = () => useQuery({ queryKey: keys.foods, queryFn: () => api.get<Food[]>('/api/foods'), staleTime: 5 * 60_000 })

export const usePlan = (date: string) =>
  useQuery({ queryKey: keys.plan(date), queryFn: () => api.get<Plan | null>(`/api/meal-plans/${date}`) })

export const useExpenses = (from: string, to: string) =>
  useQuery({ queryKey: keys.expenses(from, to), queryFn: () => api.get<Expense[]>(`/api/expenses?from=${from}&to=${to}`) })

export const useMoments = (from: string, to: string) =>
  useQuery({ queryKey: keys.moments(from, to), queryFn: () => api.get<Moment[]>(`/api/moments?from=${from}&to=${to}`) })

export const useSummary = (month: string) =>
  useQuery({ queryKey: keys.summary(month), queryFn: () => api.get<MonthlySummary>(`/api/summary/monthly?month=${month}`) })
