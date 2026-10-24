import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ErrorText, Segmented } from '../components/ui'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <img className="logo" src="/icon.svg" alt="" />
        <h1>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>Theo dõi chi tiêu, cân nặng, bữa ăn và khoảnh khắc mỗi ngày.</p>
        <div className="card" style={{ marginTop: 20 }}>
          <Segmented value={mode} onChange={(v) => { setMode(v); setError(null) }}
            options={[{ value: 'login', label: 'Đăng nhập' }, { value: 'register', label: 'Đăng ký' }]} />
          <form className="form" style={{ marginTop: 16 }} onSubmit={submit}>
            {mode === 'register' && (
              <label className="field"><span>Tên hiển thị</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
              </label>
            )}
            <label className="field"><span>Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className="field"><span>Mật khẩu</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {mode === 'register' && <small className="muted">Ít nhất 8 ký tự</small>}
            </label>
            <ErrorText error={error} />
            <button className="btn block" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
