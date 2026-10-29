import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Today from './pages/Today'

const Expenses = lazy(() => import('./pages/Expenses'))
const Body = lazy(() => import('./pages/Body'))
const MealPlanner = lazy(() => import('./pages/MealPlanner'))
const Moments = lazy(() => import('./pages/Moments'))
const Summary = lazy(() => import('./pages/Summary'))
const Habits = lazy(() => import('./pages/Habits'))
const Tasks = lazy(() => import('./pages/Tasks'))

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="chi-tieu" element={<Expenses />} />
        <Route path="co-the" element={<Body />} />
        <Route path="thuc-don" element={<MealPlanner />} />
        <Route path="khoanh-khac" element={<Moments />} />
        <Route path="thoi-quen" element={<Habits />} />
        <Route path="viec-can-lam" element={<Tasks />} />
        <Route path="tong-ket" element={<Summary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
