import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Camera, HeartPulse, Home, ListChecks, ListTodo, LogOut, PieChart, Utensils, Wallet } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Loading } from './ui'

const NAV = [
  { to: '/', label: 'Hôm nay', icon: Home, end: true },
  { to: '/chi-tieu', label: 'Chi tiêu', icon: Wallet },
  { to: '/thuc-don', label: 'Thực đơn', icon: Utensils },
  { to: '/khoanh-khac', label: 'Khoảnh khắc', icon: Camera },
  { to: '/tong-ket', label: 'Tổng kết', icon: PieChart },
]

export default function Layout() {
  const { logout, user } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img src="/icon-192.png" width={32} height={32} alt="" /> Hatchi</div>
        {NAV.slice(0, 1).map((n) => <Item key={n.to} {...n} />)}
        <Item to="/viec-can-lam" label="Việc cần làm" icon={ListTodo} />
        {NAV.slice(1, 2).map((n) => <Item key={n.to} {...n} />)}
        <Item to="/co-the" label="Cơ thể & macro" icon={HeartPulse} />
        {NAV.slice(2, 4).map((n) => <Item key={n.to} {...n} />)}
        <Item to="/thoi-quen" label="Thói quen" icon={ListChecks} />
        {NAV.slice(4).map((n) => <Item key={n.to} {...n} />)}
        <div className="spacer" />
        <div className="small muted" style={{ padding: '0 12px 8px' }}>{user?.displayName}</div>
        <a href="#" onClick={(e) => { e.preventDefault(); logout() }}><LogOut size={20} /> Đăng xuất</a>
      </aside>
      <main className="main"><Suspense fallback={<Loading />}><Outlet /></Suspense></main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={22} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Item({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end?: boolean }) {
  return <NavLink to={to} end={end}><Icon size={20} /> {label}</NavLink>
}
