import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Target, Play, Pause, RotateCcw, Award, Sun, Cloud, CloudRain, Wind, Droplets, Thermometer } from 'lucide-react'

export default function Focus() {
  const [tab, setTab] = useState('pomodoro')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Focus</h1>
        <p style={{ color: 'var(--text-muted)' }}>Pomodoro timer, daily goals, and weather</p>
      </div>
      <div className="glass rounded-lg p-1 flex gap-1 w-fit">
        {['pomodoro', 'goals', 'weather'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors" style={{ background: tab === t ? 'var(--accent-glow)' : 'transparent', color: tab === t ? 'var(--accent-solid)' : 'var(--text-muted)' }}>{t}</button>
        ))}
      </div>
      {tab === 'pomodoro' && <PomodoroTimer />}
      {tab === 'goals' && <DailyGoals />}
      {tab === 'weather' && <WeatherWidget />}
    </div>
  )
}

function PomodoroTimer() {
  const [session, setSession] = useState(null)
  const [history, setHistory] = useState([])
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState('work')
  const [loading, setLoading] = useState(false)
  const MODES = { work: 25 * 60, short: 5 * 60, long: 15 * 60 }

  useEffect(() => {
    // Pomodoro active returns { session: {...} } or { session: null }
    api.get('/focus/pomodoro/active').then(data => {
      const s = data?.session
      if (s && s.is_active) {
        setSession(s)
        const elapsed = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, s.duration * 60 - elapsed))
        setIsRunning(true)
      }
    }).catch(() => { })
    // Pomodoro history returns { sessions: [...] }
    api.get('/focus/pomodoro/history?limit=20').then(data => {
      const sessions = data?.sessions || []
      setHistory(Array.isArray(sessions) ? sessions : [])
    }).catch(() => { })
  }, [])

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [isRunning, timeLeft])

  const startSession = async () => {
    if (session?.is_active) { setIsRunning(!isRunning); return }
    setLoading(true)
    try {
      const newSession = await api.post('/focus/pomodoro/start', { duration: 25, break_duration: 5 })
      setSession(newSession)
      setTimeLeft(25 * 60)
      setIsRunning(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const completeSession = async () => {
    if (!session) return
    setLoading(true)
    try {
      await api.post(`/focus/pomodoro/${session.id}/complete`, { completed_cycles: 1 })
      setIsRunning(false)
      setSession(null)
      setMode('short')
      setTimeLeft(MODES.short)
      const data = await api.get('/focus/pomodoro/history?limit=20')
      setHistory(data?.sessions || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const reset = () => { setTimeLeft(MODES[mode]); setIsRunning(false) }
  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const progress = ((MODES[mode] - timeLeft) / MODES[mode]) * 100

  return (
    <div className="glass-card p-8 max-w-md mx-auto text-center">
      <div className="flex justify-center gap-2 mb-8">
        {Object.entries(MODES).map(([m, secs]) => (
          <button key={m} onClick={() => { setMode(m); setTimeLeft(secs); setIsRunning(false) }} className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors" style={{ background: mode === m ? 'var(--accent-glow)' : 'transparent', color: mode === m ? 'var(--accent-solid)' : 'var(--text-muted)' }}>
            {m === 'short' ? 'Short Break' : m === 'long' ? 'Long Break' : 'Focus'}
          </button>
        ))}
      </div>
      <div className="relative w-56 h-56 mx-auto mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(194,176,150,0.1)" strokeWidth="4" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`} className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatTime(timeLeft)}</span>
          <span className="text-sm mt-2 capitalize" style={{ color: 'var(--text-muted)' }}>{session?.is_active ? 'Active Session' : `${mode} mode`}</span>
        </div>
      </div>
      <div className="flex justify-center gap-4">
        {!session?.is_active ? (
          <button onClick={startSession} className="btn btn-primary btn-lg w-32" disabled={loading}>
            {loading ? '...' : <><Play className="w-4 h-4" /> Start</>}
          </button>
        ) : (
          <>
            <button onClick={() => setIsRunning(!isRunning)} className="btn btn-primary btn-lg w-32">
              {isRunning ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
            </button>
            <button onClick={completeSession} className="btn btn-secondary btn-lg"><Award className="w-4 h-4" /></button>
          </>
        )}
        <button onClick={reset} className="btn btn-secondary btn-lg"><RotateCcw className="w-4 h-4" /></button>
      </div>
      {history.length > 0 && (
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Recent Sessions</h3>
          <div className="space-y-2">
            {history.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded text-sm" style={{ background: 'rgba(194,176,150,0.05)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(s.started_at).toLocaleDateString()}</span>
                <span style={{ color: 'var(--text-primary)' }}>{s.completed_cycles} cycles</span>
                <span style={{ color: s.is_active ? 'var(--success)' : 'var(--text-muted)' }}>{s.is_active ? 'Active' : 'Completed'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DailyGoals() {
  const [goals, setGoals] = useState([])
  const [newGoal, setNewGoal] = useState('')

  useEffect(() => {
    // Goals endpoint returns { goals: [...] }
    api.get('/focus/goals').then(data => {
      const goalsList = data?.goals || (Array.isArray(data) ? data : [])
      setGoals(goalsList)
    }).catch(() => setGoals([]))
  }, [])

  const addGoal = async () => {
    if (!newGoal.trim()) return
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post('/focus/goals', { goal_text: newGoal, target_date: today })
      setNewGoal('')
      const updated = await api.get('/focus/goals')
      setGoals(Array.isArray(updated) ? updated : [])
    } catch (e) { console.error(e) }
  }

  const toggleGoal = async (goal) => {
    try {
      if (!goal.is_completed) {
        await api.patch(`/focus/goals/${goal.id}/complete`)
      }
      const updated = await api.get('/focus/goals')
      setGoals(Array.isArray(updated) ? updated : [])
    } catch (e) { console.error(e) }
  }

  return (
    <div className="glass-card p-6 max-w-lg">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Target className="w-5 h-5" /> Daily Goals</h2>
      <div className="flex gap-3 mb-6">
        <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGoal()} className="glass-input flex-1" placeholder="Add a goal..." />
        <button onClick={addGoal} className="btn btn-primary">Add</button>
      </div>
      {goals.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No goals set</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: goal.is_completed ? 'rgba(34,197,94,0.08)' : 'rgba(194,176,150,0.05)' }} onClick={() => toggleGoal(goal)}>
              <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors" style={{ borderColor: goal.is_completed ? 'var(--success)' : 'var(--text-muted)', background: goal.is_completed ? 'var(--success)' : 'transparent' }}>
                {goal.is_completed && <Award className="w-3 h-3" style={{ color: 'var(--bg-deepest)' }} />}
              </div>
              <span className="text-sm" style={{ color: goal.is_completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: goal.is_completed ? 'line-through' : 'none' }}>{goal.goal_text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const data = await api.get(`/focus/weather?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}`)
          setWeather(data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
      }, () => {
        // Default to Cairo, Egypt
        api.get('/focus/weather?latitude=30.0444&longitude=31.2357').then(d => setWeather(d)).catch(() => { }).finally(() => setLoading(false))
      })
    } else { setLoading(false) }
  }, [])

  const getWeatherInfo = (code) => {
    const map = { 0: { label: 'Clear', icon: Sun }, 1: { label: 'Mainly Clear', icon: Sun }, 2: { label: 'Partly Cloudy', icon: Cloud }, 3: { label: 'Overcast', icon: Cloud }, 45: { label: 'Foggy', icon: Cloud }, 61: { label: 'Rain', icon: CloudRain }, 71: { label: 'Snow', icon: Cloud }, 95: { label: 'Thunderstorm', icon: CloudRain } }
    return map[code] || { label: 'Unknown', icon: Cloud }
  }

  if (loading) return <div className="glass-card p-8 text-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" /></div>
  if (!weather) return <div className="glass-card p-8 text-center" style={{ color: 'var(--text-muted)' }}>Weather unavailable</div>

  const { label, icon: WeatherIcon } = getWeatherInfo(weather.current_weather?.weathercode ?? weather.current?.weather_code ?? 0)
  const temp = weather.current_weather?.temperature ?? weather.current?.temperature ?? '--'
  const wind = weather.current_weather?.windspeed ?? weather.current?.wind_speed ?? '--'
  const humidity = weather.current_weather?.relativehumidity ?? weather.current?.humidity ?? '--'
  const feelsLike = weather.current_weather?.apparent_temperature ?? weather.current?.apparent_temperature ?? '--'

  return (
    <div className="glass-card p-8 max-w-md mx-auto text-center">
      <WeatherIcon className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
      <p className="text-6xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{temp}°C</p>
      <p className="text-lg mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{weather.timezone ?? 'Local'}</p>
      <div className="grid grid-cols-3 gap-4 pt-6" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="text-center"><Wind className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{wind} km/h</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Wind</p></div>
        <div className="text-center"><Droplets className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{humidity}%</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Humidity</p></div>
        <div className="text-center"><Thermometer className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{feelsLike}°</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Feels Like</p></div>
      </div>
    </div>
  )
}
