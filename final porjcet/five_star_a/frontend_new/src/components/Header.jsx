import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Sun, Moon, Clock } from 'lucide-react'
import { api } from '../services/api'
import { useTheme } from '../context/ThemeContext'

export default function Header() {
  const [connected, setConnected] = useState(false)
  const [time, setTime] = useState(new Date())
  const { theme, toggleTheme } = useTheme()
  const ThemeIcon = theme === 'dark' ? Sun : Moon

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.get('/health')
        setConnected(true)
      } catch { setConnected(false) }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--glass-border)', background: 'color-mix(in srgb, var(--bg-primary) 90%, transparent)' }}>
      {/* Digital Clock */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4" style={{ color: 'var(--accent-solid)' }} />
        <div>
          <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)', lineHeight: 1 }}>{timeStr}</p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="header-status-pill flex items-center gap-1.5">
          {connected ? <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} /> : <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />}
          <span className="text-xs hidden sm:inline" style={{ color: connected ? 'var(--success)' : 'var(--error)' }}>
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
        <button onClick={toggleTheme} className="header-theme-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
          <ThemeIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
