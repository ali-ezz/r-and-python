import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { Activity, Database, Server, Gauge, RefreshCw } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color = 'var(--accent-solid)' }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
        </div>
      </div>
      {sub && <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function ServiceRow({ name, status }) {
  const up = status === 'up' || status?.redis === 'up'
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: up ? 'var(--success)' : 'var(--error)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
      </div>
      <span className="text-xs uppercase" style={{ color: up ? 'var(--success)' : 'var(--error)' }}>
        {up ? 'up' : 'down'}
      </span>
    </div>
  )
}

export default function Monitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.get('/system/dashboard'))
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not load monitoring data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const requests = data?.requests || {}
  const cache = data?.cache || {}
  const counts = data?.counts || {}
  const services = data?.services || {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Monitoring</h1>
          <p style={{ color: 'var(--text-muted)' }}>API health, request metrics, cache usage, and system counts</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="glass-card p-4" style={{ color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ServiceRow name="FastAPI" status={services.api} />
            <ServiceRow name="Database" status={services.database} />
            <ServiceRow name={`Cache (${cache.backend || 'memory'})`} status={services.cache} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Activity} label="Requests" value={requests.total_requests ?? 0} sub={`Errors: ${requests.error_requests ?? 0}`} />
            <StatCard icon={Gauge} label="Avg latency" value={`${requests.average_latency_ms ?? 0} ms`} />
            <StatCard icon={Database} label="Cache hit ratio" value={`${Math.round((cache.hit_ratio || 0) * 100)}%`} sub={`${cache.hits ?? 0} hits / ${cache.misses ?? 0} misses`} />
            <StatCard icon={Server} label="Uptime" value={`${requests.uptime_seconds ?? 0}s`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Business Counts</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Server} label="Users" value={counts.users ?? 0} />
                <StatCard icon={Database} label="Projects" value={counts.projects ?? 0} />
                <StatCard icon={Activity} label="Tasks" value={counts.tasks?.total ?? 0} />
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Tasks by Status</h2>
              <div className="space-y-3">
                {Object.entries(counts.tasks?.by_status || {}).map(([status, value]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-28 text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{status.replace('_', ' ')}</div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="h-2" style={{ width: `${Math.min(100, value * 20)}%`, background: 'var(--accent-solid)' }} />
                    </div>
                    <div className="w-10 text-right text-sm" style={{ color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
                <div className="pt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Overdue tasks: {counts.tasks?.overdue ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top API Paths</h2>
            <div className="space-y-2">
              {Object.entries(requests.top_paths || {}).map(([path, value]) => (
                <div key={path} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{path}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
