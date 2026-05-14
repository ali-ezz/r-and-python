import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, Award, Target, Zap, Calendar, BarChart3, Clock } from 'lucide-react'

export default function Analytics() {
  const [weekly, setWeekly] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [productivity, setProductivity] = useState(null)
  const [goalsCompletion, setGoalsCompletion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
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
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}</div>

  const StatCard = ({ icon: Icon, label, value, color = 'var(--accent-solid)' }) => (
    <div className="glass-card p-4 text-center transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )

  const hasData = weekly || streaks || monthly.length > 0 || productivity

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track your productivity and progress</p>
        </div>
      </div>

      {!hasData ? (
        <div className="glass-card empty-state py-20 text-center">
          <BarChart3 className="w-20 h-20 mx-auto mb-5" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No analytics data yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>Start completing tasks to see your productivity insights</p>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Zap} label="Productivity" value={productivity?.score ?? 0} />
            <StatCard icon={Award} label="Current Streak" value={`${streaks?.current_streak ?? 0} days`} />
            <StatCard icon={TrendingUp} label="Longest Streak" value={`${streaks?.longest_streak ?? 0} days`} />
            <StatCard icon={Target} label="Goals Rate" value={goalsCompletion?.completion_rate ? `${(goalsCompletion.completion_rate * 100).toFixed(0)}%` : '0%'} />
            <StatCard icon={Calendar} label="Last Active" value={streaks?.last_active_date ? new Date(streaks.last_active_date).toLocaleDateString() : 'N/A'} />
          </div>

          {/* Weekly Summary */}
          {weekly?.total_tasks > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Calendar className="w-5 h-5" /> This Week
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{weekly.total_tasks ?? 0}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tasks Created</p>
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

          {/* Monthly Trend Chart */}
          {monthly.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <TrendingUp className="w-5 h-5" /> Monthly Trend
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthly.slice(-14)}>
                  <defs>
                    <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-solid)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-solid)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="productivity_score" stroke="var(--accent-solid)" fillOpacity={1} fill="url(#colorTasks)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
