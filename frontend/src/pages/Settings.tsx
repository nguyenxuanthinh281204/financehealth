import { useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff, LogOut } from 'lucide-react'
import { api } from '../api/client'
import type { AccentColor, AuthResponse, ThemeMode, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ErrorText, Segmented } from '../components/ui'
import { ACCENTS, THEME_MODES } from '../lib/theme'

export default function Settings() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <>
      <div className="page-head">
        <div><h1>Cài đặt</h1><div className="sub">Tài khoản, giao diện và bảo mật</div></div>
      </div>
      <div className="grid grid-md-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <ProfileCard user={user} />
          <AppearanceCard user={user} />
        </div>
        <div className="stack">
          <PasswordCard />
          <div className="card row between">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{user.displayName}</div>
              <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
            <button className="btn secondary sm" onClick={logout}><LogOut size={16} /> Đăng xuất</button>
          </div>
        </div>
      </div>
    </>
  )
}

function ProfileCard({ user }: { user: User }) {
  const { updateUser } = useAuth()
  const [name, setName] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const trimmed = name.trim()
  const dirty = trimmed !== user.displayName

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || !trimmed) return
    setSaving(true); setError(null)
    try {
      updateUser(await api.patch<User>('/api/me', { displayName: trimmed }))
      setName(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card settings-section form" onSubmit={submit}>
      <div>
        <h2>Hồ sơ</h2>
        <div className="sub" style={{ marginBottom: 0 }}>Tên hiển thị trong lời chào và trên thanh bên</div>
      </div>
      <label className="field">
        <span>Tên hiển thị</span>
        <input className="input" value={name} maxLength={100} autoComplete="name"
          onChange={(e) => { setName(e.target.value); setSaved(false) }} />
      </label>
      <label className="field">
        <span>Email đăng nhập</span>
        <input className="input" value={user.email} disabled />
      </label>
      <ErrorText error={error} />
      <div className="row between">
        {saved ? <span className="saved-hint"><Check size={16} /> Đã lưu</span> : <span />}
        <button className="btn sm" disabled={!dirty || !trimmed || saving}>{saving ? 'Đang lưu…' : 'Lưu tên'}</button>
      </div>
    </form>
  )
}

function AppearanceCard({ user }: { user: User }) {
  const { updateUser } = useAuth()
  const [error, setError] = useState<unknown>(null)

  // Đổi ngay trên giao diện, lỗi thì trả lại như cũ
  const save = async (patch: { themeMode?: ThemeMode; accentColor?: AccentColor }) => {
    const prev = user
    setError(null)
    updateUser({ ...user, ...patch })
    try {
      updateUser(await api.patch<User>('/api/me', patch))
    } catch (err) {
      updateUser(prev)
      setError(err)
    }
  }

  return (
    <div className="card settings-section">
      <h2>Giao diện</h2>
      <div className="sub">Lưu theo tài khoản, áp dụng trên mọi thiết bị</div>
      <div className="field" style={{ marginBottom: 16 }}>
        <span>Chế độ</span>
        <Segmented value={user.themeMode} options={THEME_MODES} onChange={(v) => save({ themeMode: v })} />
      </div>
      <div className="field">
        <span>Màu chủ đạo</span>
        <div className="swatches" role="radiogroup" aria-label="Màu chủ đạo">
          {ACCENTS.map((a) => {
            const on = user.accentColor === a.value
            return (
              <button key={a.value} type="button" role="radio" aria-checked={on} aria-label={a.label}
                className={`swatch${on ? ' on' : ''}`} onClick={() => !on && save({ accentColor: a.value })}>
                <i style={{ background: a.swatch }}>{on && <Check size={18} strokeWidth={3} />}</i>
                <span>{a.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {error ? <div style={{ marginTop: 12 }}><ErrorText error={error} /></div> : null}
    </div>
  )
}

function PasswordCard() {
  const { updateUser } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const problem =
    next && next.length < 8 ? 'Mật khẩu mới cần ít nhất 8 ký tự'
      : next.length > 72 ? 'Mật khẩu mới tối đa 72 ký tự'
        : confirm && confirm !== next ? 'Mật khẩu nhập lại chưa khớp'
          : next && current && next === current ? 'Mật khẩu mới phải khác mật khẩu hiện tại'
            : null
  const ready = current && next && confirm && !problem

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setSaving(true); setError(null); setDone(false)
    try {
      const r = await api.post<AuthResponse>('/api/me/password', { currentPassword: current, newPassword: next })
      updateUser(r.user, r.token)
      setCurrent(''); setNext(''); setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <form className="card settings-section form" onSubmit={submit}>
      <div>
        <h2>Đổi mật khẩu</h2>
        <div className="sub" style={{ marginBottom: 0 }}>Sau khi đổi, các thiết bị khác sẽ phải đăng nhập lại</div>
      </div>
      <label className="field">
        <span>Mật khẩu hiện tại</span>
        <div className="input-suffix">
          <input className="input" type={type} value={current} autoComplete="current-password"
            onChange={(e) => { setCurrent(e.target.value); setDone(false) }} />
          <button type="button" className="icon-btn plain pw-toggle" onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      <label className="field">
        <span>Mật khẩu mới</span>
        <input className="input" type={type} value={next} autoComplete="new-password" placeholder="Ít nhất 8 ký tự"
          onChange={(e) => { setNext(e.target.value); setDone(false) }} />
      </label>
      <label className="field">
        <span>Nhập lại mật khẩu mới</span>
        <input className="input" type={type} value={confirm} autoComplete="new-password"
          onChange={(e) => { setConfirm(e.target.value); setDone(false) }} />
      </label>
      {problem && <div className="small" style={{ color: 'var(--danger)' }}>{problem}</div>}
      <ErrorText error={error} />
      {done && <div className="notice">Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.</div>}
      <button className="btn" disabled={!ready || saving}>{saving ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
    </form>
  )
}
