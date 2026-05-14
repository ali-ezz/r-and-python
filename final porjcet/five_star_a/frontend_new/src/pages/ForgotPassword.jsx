import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../services/config'
import { ArrowLeft, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, Smartphone, Shield, Lock } from 'lucide-react'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [method, setMethod] = useState(null) // null | 'current' | 'recovery' | 'totp'
  const [username, setUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const methods = [
    { id: 'current', label: 'Current Password', desc: 'Use your current password to set a new one', icon: Lock },
    { id: 'recovery', label: 'Recovery Key', desc: 'Use your 2FA secret/recovery key', icon: Shield },
    { id: 'totp', label: 'Authenticator App', desc: 'Use a 6-digit code from your authenticator', icon: Smartphone },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!username.trim()) {
      setError('Enter your username or email')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      let endpoint = ''
      let body = {}

      if (method === 'current') {
        if (!currentPassword) { setError('Enter your current password'); setLoading(false); return }
        endpoint = '/auth/password/change'
        body = { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }
        // This endpoint requires auth - use login first approach
        // First login with current credentials
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: currentPassword }),
        })
        if (!loginRes.ok) {
          const err = await loginRes.json().catch(() => ({}))
          throw new Error(err.detail || 'Invalid current credentials')
        }
        const loginData = await loginRes.json()
        // Now change password with the token
        const changeRes = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.access_token}` },
          body: JSON.stringify(body),
        })
        if (!changeRes.ok) {
          const err = await changeRes.json().catch(() => ({}))
          throw new Error(err.detail || 'Password change failed')
        }
      } else if (method === 'recovery') {
        if (!recoveryKey.trim()) { setError('Enter your recovery key'); setLoading(false); return }
        const res = await fetch(`${API_BASE}/auth/password/reset/recovery-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            recovery_key: recoveryKey.trim(),
            new_password: newPassword,
            confirm_password: confirmPassword,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Reset failed')
        }
      } else if (method === 'totp') {
        if (!totpCode || totpCode.length < 6) { setError('Enter a valid 6-digit code'); setLoading(false); return }
        const res = await fetch(`${API_BASE}/auth/password/reset/totp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            totp_code: totpCode,
            new_password: newPassword,
            confirm_password: confirmPassword,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Reset failed')
        }
      }

      setSuccess('Password reset successfully! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (e) {
      setError(e.message || 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/login')} className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to login
        </button>

        <div className="glass-card p-8">
          <div className="text-center mb-6">
            <KeyRound className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--accent-primary)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reset Password</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {!method ? 'Choose a verification method' : 'Verify your identity and set a new password'}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ background: 'var(--error-light)', color: 'var(--error)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          {!method ? (
            <div className="space-y-3">
              {methods.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)} className="w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all hover:scale-[1.02]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-glow)' }}>
                    <m.icon className="w-5 h-5" style={{ color: 'var(--accent-solid)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Username or Email</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required
                  className="glass-input w-full" placeholder="Enter your username or email" />
              </div>

              {method === 'current' && (
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
                    className="glass-input w-full" placeholder="Your current password" />
                </div>
              )}

              {method === 'recovery' && (
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Recovery Key</label>
                  <input type="text" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} required
                    className="glass-input w-full font-mono" placeholder="Enter your 2FA secret / recovery key" />
                </div>
              )}

              {method === 'totp' && (
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Authenticator Code</label>
                  <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required
                    className="glass-input w-full text-center font-mono text-lg tracking-widest" placeholder="000000" maxLength={6} />
                </div>
              )}

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>New Password</label>
                <div className="relative">
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required type={showNewPw ? 'text' : 'password'}
                    className="glass-input w-full pr-10" placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Confirm Password</label>
                <div className="relative">
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required type={showConfirmPw ? 'text' : 'password'}
                    className="glass-input w-full pr-10" placeholder="Re-enter password" />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button type="button" onClick={() => { setMethod(null); setError('') }} className="btn btn-secondary w-full">
                Choose Different Method
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
