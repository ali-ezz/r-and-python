import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import { User, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'
import AuthShell from '../components/AuthShell'

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', confirmPassword: '', full_name: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      addToast({ type: 'error', message: 'Passwords do not match' })
      return
    }
    if (form.username.length < 3) {
      addToast({ type: 'error', message: 'Username must be at least 3 characters' })
      return
    }
    if (form.password.length < 8) {
      addToast({ type: 'error', message: 'Password must be at least 8 characters' })
      return
    }
    setLoading(true)
    const result = await register(form)
    setLoading(false)
    if (result.success) {
      addToast({ type: 'success', message: 'Account created!' })
      navigate('/dashboard')
    } else {
      addToast({ type: 'error', message: result.error })
    }
  }

  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Create Account"
      subtitle="Start with projects, tasks, collections, search, and a calmer interface from the first load."
      footer={
        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          Have an account? <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--accent-solid)' }}>Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="auth-inline-note">
          <Sparkles className="w-4 h-4" />
          <span>Account creation signs you in immediately and takes you straight to the dashboard.</span>
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="glass-input input-with-icon" placeholder="Full name" />
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="glass-input input-with-icon" placeholder="Email" required />
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="glass-input input-with-icon" placeholder="Username" required minLength={3} />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="glass-input input-with-icon" placeholder="Password (min 8)" required minLength={8} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 hover:scale-110" style={{ color: 'var(--text-muted)' }}>
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="glass-input input-with-icon" placeholder="Confirm password" required />
        </div>
        <button type="submit" className="btn btn-primary w-full auth-submit-btn" disabled={loading}>
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
        </button>
      </form>
    </AuthShell>
  )
}
