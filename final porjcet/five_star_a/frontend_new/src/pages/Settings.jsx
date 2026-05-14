import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import { api } from '../services/api'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { User, Shield, Save, LogOut, KeyRound, Smartphone, Sun, Moon, Users, Briefcase, Code, Palette, Search as SearchIcon, TestTube, Database, Layout, Rocket, Camera, Monitor, Trash2, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const teamMembers = [
  { name: 'Ahmed Abobakr Hanafi', role: 'Project Manager / System Architect', desc: 'Overall supervision, architecture, code review', icon: Briefcase },
  { name: 'Ali Ez Alyan', role: 'Backend Lead Developer', desc: 'API development, database, security, performance', icon: Code },
  { name: 'Ahmed Sabry Hamza', role: 'Frontend Developer', desc: 'UI development, UX design, animations, theming', icon: Palette },
  { name: 'Ahmed Abdul-Nasser Sayed', role: 'API Integration Specialist', desc: 'Search sources integration, data processing', icon: SearchIcon },
  { name: 'Ahmed Mohamed Mohamed', role: 'QA Engineer & Documentation', desc: 'Testing, code review, documentation', icon: TestTube },
]

const projectAreas = [
  { icon: Database, name: 'Backend Core', desc: 'FastAPI, SQLAlchemy, PostgreSQL' },
  { icon: Layout, name: 'Frontend & Views', desc: 'React, 8 view engines' },
  { icon: Shield, name: 'Security & Auth', desc: 'JWT, 2FA, OAuth, RBAC' },
  { icon: SearchIcon, name: 'Search Engine', desc: '20+ API sources, AI-powered' },
  { icon: Code, name: 'API Architecture', desc: 'REST, WebSocket, 100+ endpoints' },
  { icon: Rocket, name: 'Deployment', desc: 'Docker, CI/CD, monitoring' },
]

export default function Settings() {
  const { user, updateProfile, logout } = useAuthStore()
  const { addToast } = useAppStore()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ full_name: '', timezone: 'UTC' })
  const [saving, setSaving] = useState(false)
  const [twoFactor, setTwoFactor] = useState({ secret: '', backup_codes: [], qr_code_url: '' })
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [resetMethod, setResetMethod] = useState('current') // 'current' | 'recovery' | 'totp'
  const [recoveryKey, setRecoveryKey] = useState('')
  const [totpResetCode, setTotpResetCode] = useState('')
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', timezone: user.timezone || 'UTC' })
      setTwoFactorEnabled(user.two_factor_enabled || false)
    }
  }, [user])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [user?.avatar_url])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.put(`/users/${user.id}`, profile)
      updateProfile(profile)
      addToast({ type: 'success', message: 'Profile updated!' })
    } catch (e) {
      addToast({ type: 'error', message: e.response?.data?.detail || 'Failed to update' })
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      addToast({ type: 'error', message: 'Passwords do not match' })
      return
    }
    if (passwords.new_password.length < 8) {
      addToast({ type: 'error', message: 'Password must be at least 8 characters' })
      return
    }
    try {
      await api.post('/auth/password/change', passwords)
      addToast({ type: 'success', message: 'Password changed!' })
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
    } catch (e) {
      addToast({ type: 'error', message: e.response?.data?.detail || e.message || 'Failed to change password' })
    }
  }

  const handleChangePasswordMulti = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      addToast({ type: 'error', message: 'Passwords do not match' })
      return
    }
    if (passwords.new_password.length < 8) {
      addToast({ type: 'error', message: 'Password must be at least 8 characters' })
      return
    }
    try {
      if (resetMethod === 'current') {
        if (!passwords.current_password) {
          addToast({ type: 'error', message: 'Enter your current password' })
          return
        }
        await api.post('/auth/password/change', passwords)
      } else if (resetMethod === 'recovery') {
        if (!recoveryKey.trim()) {
          addToast({ type: 'error', message: 'Enter your recovery key' })
          return
        }
        await api.post('/auth/password/reset/recovery-key', {
          username: user.email || user.username,
          recovery_key: recoveryKey,
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        })
      } else if (resetMethod === 'totp') {
        if (!totpResetCode || totpResetCode.length < 6) {
          addToast({ type: 'error', message: 'Enter a valid 6-digit code' })
          return
        }
        await api.post('/auth/password/reset/totp', {
          username: user.email || user.username,
          totp_code: totpResetCode,
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        })
      }
      addToast({ type: 'success', message: 'Password changed!' })
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
      setRecoveryKey('')
      setTotpResetCode('')
    } catch (e) {
      addToast({ type: 'error', message: e.response?.data?.detail || e.message || 'Failed to change password' })
    }
  }

  const handleSetup2FA = async () => {
    try {
      const data = await api.post('/auth/2fa/setup')
      setTwoFactor(data)
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to setup 2FA' })
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorCode || twoFactorCode.length < 6) {
      addToast({ type: 'warning', message: 'Enter a valid 6-digit code' })
      return
    }
    try {
      await api.post('/auth/2fa/verify', { code: twoFactorCode })
      setTwoFactorEnabled(true)
      setTwoFactorCode('')
      addToast({ type: 'success', message: '2FA enabled successfully!' })
    } catch (e) {
      addToast({ type: 'error', message: 'Invalid code. Try again.' })
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const data = await api.post('/users/avatar', formData)
      if (data?.avatar_url) {
        updateProfile({ avatar_url: data.avatar_url })
      }
      addToast({ type: 'success', message: 'Avatar updated!' })
      try {
        const me = await api.get('/users/me')
        if (me && typeof me === 'object') updateProfile(me)
      } catch {
        /* profile already updated from upload response */
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload avatar'
      addToast({ type: 'error', message: typeof msg === 'string' ? msg : 'Failed to upload avatar' })
    } finally {
      e.target.value = ''
    }
  }

  const handleLogoutAllDevices = async () => {
    if (!confirm('Sign out from all other devices?')) return
    try {
      await api.post('/auth/logout/device', { device_id: null })
      addToast({ type: 'success', message: 'All devices signed out successfully' })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to logout devices' })
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'about', label: 'About', icon: Users },
  ]

  const ThemeIcon = theme === 'dark' ? Moon : Sun

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage your account</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tabs sidebar - horizontal on mobile, vertical on desktop */}
        <div className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 md:w-40 md:flex-shrink-0">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex md:flex-none w-auto md:w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-all" style={{ background: tab === t.id ? 'var(--accent-gradient)' : 'transparent', color: tab === t.id ? 'var(--bg-deepest)' : 'var(--text-muted)', fontWeight: tab === t.id ? 600 : 400 }}>
              <t.icon className="w-4 h-4 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 glass-card p-4 md:p-6 min-w-0">
          {tab === 'profile' && (
            <div className="space-y-4 max-w-md">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Profile</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  {user?.avatar_url && !avatarLoadFailed ? (
                    <img
                      src={resolveMediaUrl(user.avatar_url)}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold" style={{ background: 'var(--accent-gradient)', color: 'var(--bg-deepest)' }}>
                      {(profile.full_name || user?.username || 'U')[0]}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'var(--bg-primary)', border: '2px solid var(--glass-border)' }}>
                    <Camera className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{profile.full_name || user?.username}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                <input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Username</label>
                <input value={user?.username || ''} className="glass-input" disabled />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={user?.email || ''} className="glass-input" disabled />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Timezone</label>
                <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="glass-input">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
              <button onClick={handleSaveProfile} className="btn btn-primary" disabled={saving}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-4 max-w-md">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                  <ThemeIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Theme</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Currently {theme}</p>
                  </div>
                </div>
                <button onClick={toggleTheme} className="btn btn-secondary btn-sm">
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4 max-w-md">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Security</h2>
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Smartphone className="w-4 h-4" /> Two-Factor Authentication</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Add extra security with TOTP authenticator</p>
                {twoFactorEnabled ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> 2FA is enabled
                  </div>
                ) : !twoFactor.secret ? (
                  <button onClick={handleSetup2FA} className="btn btn-secondary btn-sm">Setup 2FA</button>
                ) : (
                  <div className="space-y-4 flex flex-col items-center p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                    <img src={twoFactor.qr_code_url} alt="2FA QR" className="w-48 h-48 rounded-lg bg-white p-3 shadow-lg" />
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Recovery / Secret Key</p>
                      <p className="text-sm font-mono font-bold select-all" style={{ color: 'var(--accent-solid)' }}>{twoFactor.secret}</p>
                    </div>
                    <div className="flex gap-2">
                      <input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="glass-input text-center font-mono text-lg tracking-widest" placeholder="000000" maxLength={6} />
                      <button onClick={handleVerify2FA} className="btn btn-primary btn-sm">Verify & Enable</button>
                    </div>
                    {twoFactor.backup_codes?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Backup codes (save these!):</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {twoFactor.backup_codes.map((code, i) => (
                            <span key={i} className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>{code}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><KeyRound className="w-4 h-4" /> Change Password</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Choose a verification method to change your password</p>
                <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  {[
                    { id: 'current', label: 'Current Password' },
                    { id: 'recovery', label: 'Recovery Key' },
                    { id: 'totp', label: 'Auth Code' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setResetMethod(m.id)} className="flex-1 px-2 py-1.5 rounded text-xs transition-all" style={{ background: resetMethod === m.id ? 'var(--accent-glow)' : 'transparent', color: resetMethod === m.id ? 'var(--accent-solid)' : 'var(--text-muted)', fontWeight: resetMethod === m.id ? 600 : 400 }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {resetMethod === 'current' && (
                    <input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} className="glass-input text-sm" placeholder="Current password" />
                  )}
                  {resetMethod === 'recovery' && (
                    <input type="text" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} className="glass-input text-sm font-mono" placeholder="Enter recovery key (2FA secret)" />
                  )}
                  {resetMethod === 'totp' && (
                    <input type="text" value={totpResetCode} onChange={(e) => setTotpResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="glass-input text-sm text-center font-mono tracking-widest" placeholder="6-digit code from app" maxLength={6} />
                  )}
                  <input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} className="glass-input text-sm" placeholder="New password (min 8)" />
                  <input type="password" value={passwords.confirm_password} onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })} className="glass-input text-sm" placeholder="Confirm new password" />
                  <button onClick={handleChangePasswordMulti} className="btn btn-secondary btn-sm">Change Password</button>
                </div>
              </div>
              <button onClick={() => { logout(); navigate('/login') }} className="btn btn-ghost text-sm" style={{ color: 'var(--error)' }}>
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Monitor className="w-4 h-4" /> Devices</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Sign out from all other devices</p>
                <button onClick={handleLogoutAllDevices} className="btn btn-secondary btn-sm">
                  <Trash2 className="w-3 h-3" /> Logout All Devices
                </button>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Team</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamMembers.map((member, i) => (
                    <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
                          <member.icon className="w-4 h-4" style={{ color: 'var(--bg-deepest)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.role}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{member.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Project Areas</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectAreas.map((area, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                      <area.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-solid)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{area.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{area.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>5*A Task Management System v2.0</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Built with React, FastAPI, and PostgreSQL</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
