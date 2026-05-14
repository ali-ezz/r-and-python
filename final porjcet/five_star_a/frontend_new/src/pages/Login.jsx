import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const { addToast } = useAppStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const result = await login(username, password)
    setLoading(false)
    if (result.success) {
      addToast({ type: 'success', message: 'Welcome back!' })
      navigate('/dashboard')
    } else {
      addToast({ type: 'error', message: result.error })
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Access your tasks, projects, search workspace, and analytics in one place."
      footer={
        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          No account? <Link to="/register" className="font-medium hover:underline" style={{ color: 'var(--accent-solid)' }}>Sign up</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="auth-pill-row">
          <span className="auth-pill">Live backend</span>
          <span className="auth-pill">Fast startup</span>
          <span className="auth-pill">Refined UI</span>
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="glass-input input-with-icon" placeholder="Username" required />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input input-with-icon" placeholder="Password" required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 hover:scale-110" style={{ color: 'var(--text-muted)' }}>
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button type="submit" className="btn btn-primary w-full auth-submit-btn" disabled={loading}>
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
        </button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm hover:underline" style={{ color: 'var(--accent-solid)' }}>
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
