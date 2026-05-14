import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import {
  CheckCircle, Clock, TrendingUp, FolderOpen, BarChart3, Award, Target, Zap,
  Calendar, Bell, Play, Pause, RotateCcw, Plus, Check, X, Cloud, CloudSun,
  CloudRain, Sun, Edit2, Trash2, User, MessageSquare, Send, ChevronDown, ChevronUp,
  Award as Trophy
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { tasks, projects, fetchTasks, fetchProjects, addToast } = useAppStore()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')

  // Analytics state
  const [weekly, setWeekly] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [productivity, setProductivity] = useState(null)
  const [goalsCompletion, setGoalsCompletion] = useState(null)

  // Pomodoro state
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState('work')
  const [pomodoroSession, setPomodoroSession] = useState(null)
  const [pomodoroHistory, setPomodoroHistory] = useState([])

  // Goals state
  const [goals, setGoals] = useState([])
  const [newGoalText, setNewGoalText] = useState('')

  // Weather state
  const [weather, setWeather] = useState(null)

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchTasks({ limit: 10 }),
          fetchProjects(),
          loadAnalytics(),
          loadPomodoro(),
          loadGoals(),
          loadWeather(),
          loadNotifications(),
        ])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [fetchTasks, fetchProjects])

  useEffect(() => {
    if (!pomodoroRunning || pomodoroTime <= 0) return
    const timer = setInterval(() => setPomodoroTime(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [pomodoroRunning, pomodoroTime])

  const loadAnalytics = async () => {
    const [w, s, m, p, g] = await Promise.all([
      api.get('/analytics/weekly').catch(() => null),
      api.get('/analytics/streaks').catch(() => null),
      api.get('/analytics/monthly-trend').catch(() => []),
      api.get('/analytics/productivity-score').catch(() => null),
      api.get('/analytics/goals-completion').catch(() => null),
    ])
    setWeekly(w)
    setStreaks(s)
    setMonthly(Array.isArray(m) ? m : (m?.data || []))
    setProductivity(p)
    setGoalsCompletion(g)
  }

  const loadPomodoro = async () => {
    const [active, history] = await Promise.all([
      api.get('/focus/pomodoro/active').catch(() => null),
      api.get('/focus/pomodoro/history?limit=5').catch(() => []),
    ])
    const session = active?.session
    if (session && session.is_active) {
      setPomodoroSession(session)
      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      setPomodoroTime(Math.max(0, session.duration * 60 - elapsed))
      setPomodoroRunning(true)
    }
    setPomodoroHistory(history?.sessions || history || [])
  }

  const loadGoals = async () => {
    const data = await api.get('/focus/goals').catch(() => null)
    const goalsList = data?.goals || (Array.isArray(data) ? data : [])
    setGoals(goalsList.filter(g => !g.is_completed))
  }

  const loadWeather = async () => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const data = await api.get(`/focus/weather?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}`)
        setWeather(data)
      } catch (e) { }
    }, async () => {
      try {
        const data = await api.get('/focus/weather?latitude=30.0444&longitude=31.2357')
        setWeather(data)
      } catch (e) { }
    })
  }

  const loadNotifications = async () => {
    try {
      const data = await api.get('/notifications?skip=0&limit=5')
      const list = data.notifications || data || []
      setNotifications(Array.isArray(list) ? list : [])
      setUnreadCount(data.unread ?? list.filter(n => !n.is_read).length)
    } catch (e) { }
  }

  const startPomodoro = async () => {
    if (pomodoroSession?.is_active) {
      setPomodoroRunning(!pomodoroRunning)
      return
    }
    try {
      const session = await api.post('/focus/pomodoro/start', { duration: 25, break_duration: 5 })
      setPomodoroSession(session)
      setPomodoroTime(25 * 60)
      setPomodoroRunning(true)
      setPomodoroMode('work')
    } catch (e) { addToast({ type: 'error', message: 'Failed to start Pomodoro' }) }
  }

  const completePomodoro = async () => {
    if (!pomodoroSession) return
    try {
      await api.post(`/focus/pomodoro/${pomodoroSession.id}/complete`, { completed_cycles: 1 })
      setPomodoroRunning(false)
      setPomodoroSession(null)
      setPomodoroTime(25 * 60)
      addToast({ type: 'success', message: 'Pomodoro session completed!' })
      loadPomodoro()
    } catch (e) { }
  }

  const resetPomodoro = () => {
    setPomodoroTime(25 * 60)
    setPomodoroRunning(false)
  }

  const addGoal = async () => {
    if (!newGoalText.trim()) return
    try {
      await api.post('/focus/goals', { goal_text: newGoalText, target_date: new Date().toISOString().split('T')[0] })
      setNewGoalText('')
      loadGoals()
      addToast({ type: 'success', message: 'Goal added!' })
    } catch (e) { }
  }

  const toggleGoal = async (id) => {
    try {
      await api.patch(`/focus/goals/${id}/complete`)
      loadGoals()
    } catch (e) { }
  }

  const markNotifRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      loadNotifications()
    } catch (e) { }
  }

  const markAllNotifRead = async () => {
    try {
      await api.post('/notifications/read-all')
      loadNotifications()
    } catch (e) { }
  }

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  const progress = ((25 * 60 - pomodoroTime) / (25 * 60)) * 100

  const unread = tasks.filter(t => t.status !== 'done').length
  const stats = [
    { label: 'Total Tasks', value: tasks.length, icon: CheckCircle, color: 'var(--accent-primary)' },
    { label: 'To Do', value: tasks.filter(t => t.status === 'todo').length, icon: Clock, color: 'var(--status-in-progress)' },
    { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: TrendingUp, color: 'var(--warning)' },
    { label: 'Done', value: tasks.filter(t => t.status === 'done').length, icon: FolderOpen, color: 'var(--success)' },
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const WeatherIcon = weather?.current?.weather_code <= 1 ? Sun : weather?.current?.weather_code <= 3 ? CloudSun : weather?.current?.weather_code <= 60 ? CloudRain : Cloud

  if (loading) return <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}</div>

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'focus', label: 'Focus' },
    { id: 'notifications', label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {getGreeting()}, {user?.full_name || user?.username || 'User'} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Your productivity hub — everything in one place</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: activeSection === s.id ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
              color: activeSection === s.id ? 'var(--bg-deepest)' : 'var(--text-muted)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Stats Row (always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-5 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}20` }}>
              <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tasks */}
          <div className="lg:col-span-2 glass-card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <CheckCircle className="w-4 h-4" /> Recent Tasks
            </h2>
            {tasks.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No tasks yet — create one to get started</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-white/5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-green-500' : task.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                    <span className="flex-1 text-sm truncate" style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                      {task.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{task.status?.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Analytics */}
          <div className="space-y-4">
            <div className="glass-card p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{streaks?.current_streak ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Day Streak</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Zap className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{productivity?.score ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Productivity Score</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{goalsCompletion?.completion_rate ? `${(goalsCompletion.completion_rate * 100).toFixed(0)}%` : '0%'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Goals Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* FOCUS */}
      {activeSection === 'focus' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pomodoro */}
          <div className="glass-card p-6 text-center">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Pomodoro Timer</h3>
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(194,176,150,0.1)" strokeWidth="4" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`} className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatTime(pomodoroTime)}</span>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={startPomodoro} className="btn btn-primary btn-lg w-24">
                {pomodoroRunning ? <><Pause className="w-4 h-4" /></> : <><Play className="w-4 h-4" /></>}
              </button>
              <button onClick={completePomodoro} className="btn btn-secondary btn-lg w-24"><Check className="w-4 h-4" /></button>
              <button onClick={resetPomodoro} className="btn btn-secondary btn-lg w-24"><RotateCcw className="w-4 h-4" /></button>
            </div>
            {pomodoroHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pomodoroHistory.length} sessions completed</p>
              </div>
            )}
          </div>

          {/* Daily Goals */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Goals</h3>
            {goals.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No goals for today</p>
            ) : (
              <div className="space-y-2 mb-4">
                {goals.map(g => (
                  <div key={g.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <button onClick={() => toggleGoal(g.id)} className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors" style={{ borderColor: 'var(--accent-solid)' }}>
                      {g.is_completed && <Check className="w-3 h-3" style={{ color: 'var(--accent-solid)' }} />}
                    </button>
                    <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{g.goal_text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={newGoalText} onChange={(e) => setNewGoalText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGoal()} className="glass-input flex-1 text-sm" placeholder="Add a goal..." />
              <button onClick={addGoal} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Weather */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Weather</h3>
            {weather ? (
              <div className="text-center">
                <WeatherIcon className="w-16 h-16 mx-auto mb-3" style={{ color: 'var(--accent-solid)' }} />
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{weather.current?.temperature ?? '--'}°C</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {weather.current?.weather_code <= 1 ? 'Sunny' : weather.current?.weather_code <= 3 ? 'Partly Cloudy' : weather.current?.weather_code <= 60 ? 'Rainy' : 'Stormy'}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Wind: {weather.current?.wind_speed ?? '--'} km/h
                </p>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Unable to load weather</p>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Notifications {unreadCount > 0 && <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: 'var(--error)', color: 'white' }}>{unreadCount}</span>}
            </h3>
            {unreadCount > 0 && (
              <button onClick={markAllNotifRead} className="btn btn-secondary btn-sm text-xs">Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No notifications</p>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg transition-colors" style={{ background: n.is_read ? 'transparent' : 'rgba(194,176,150,0.08)', borderLeft: n.is_read ? 'none' : '3px solid var(--accent-solid)' }}>
                  <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.title || n.message}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                  </div>
                  {!n.is_read && (
                    <button onClick={() => markNotifRead(n.id)} className="p-1 rounded hover:bg-white/10" title="Mark read">
                      <Check className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS */}
      {activeSection === 'analytics' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <Award className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{streaks?.current_streak ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Day Streak</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Zap className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{productivity?.score ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Productivity</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Target className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{goalsCompletion?.completion_rate ? `${(goalsCompletion.completion_rate * 100).toFixed(0)}%` : '0%'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Goals Rate</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--accent-solid)' }} />
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{streaks?.longest_streak ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Longest Streak</p>
            </div>
          </div>

          {/* Weekly */}
          {weekly?.total_tasks > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>This Week</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{weekly.total_tasks ?? 0}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Created</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{weekly.completed_tasks ?? 0}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Completed</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--error)' }}>{weekly.overdue_tasks ?? 0}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Overdue</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent-solid)' }}>{weekly.completion_rate ? `${(weekly.completion_rate * 100).toFixed(0)}%` : '0%'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Completion Rate</p>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {monthly.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly.slice(-14)}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="productivity_score" stroke="var(--accent-solid)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
