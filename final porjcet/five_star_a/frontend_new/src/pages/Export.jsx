import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, Filter } from 'lucide-react'
import { api } from '../services/api'
import { API_BASE } from '../services/config'
import { useAppStore } from '../stores/appStore'

export default function Export() {
  const { addToast } = useAppStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState({})

  const getToken = () => {
    try {
      const raw = localStorage.getItem('auth-storage')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed.state?.token || parsed.token || null
    } catch {
      return null
    }
  }

  const exportJson = async (type) => {
    const key = `${type}-json`
    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      const token = getToken()
      const url = type === 'tasks' && statusFilter
        ? `${API_BASE}/export/tasks/json?status_filter=${statusFilter}`
        : `${API_BASE}/export/${type}/json`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const urlObj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj; a.download = `${type}.json`; a.click()
      URL.revokeObjectURL(urlObj)
      addToast({ type: 'success', message: `${type} exported!` })
    } catch (e) {
      addToast({ type: 'error', message: 'Export failed' })
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const exportCsv = async () => {
    setLoading(prev => ({ ...prev, 'tasks-csv': true }))
    try {
      const token = getToken()
      const url = `${API_BASE}/export/tasks/csv${statusFilter ? `?status_filter=${statusFilter}` : ''}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(err || 'Export failed')
      }
      const blob = await res.blob()
      const urlObj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj; a.download = 'tasks.csv'; a.click()
      URL.revokeObjectURL(urlObj)
      addToast({ type: 'success', message: 'Tasks exported as CSV!' })
    } catch (e) {
      addToast({ type: 'error', message: 'CSV export failed' })
    } finally {
      setLoading(prev => ({ ...prev, 'tasks-csv': false }))
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Export</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Download your data</p>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input text-sm">
            <option value="">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter applies to tasks exports</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card p-5 text-center">
          <FileJson className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Tasks (JSON)</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Complete data</p>
          <button onClick={() => exportJson('tasks')} className="btn btn-primary w-full text-sm" disabled={loading['tasks-json']}>
            {loading['tasks-json'] ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-3.5 h-3.5" /> Export</>}
          </button>
        </div>

        <div className="glass-card p-5 text-center">
          <FileSpreadsheet className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Tasks (CSV)</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Spreadsheet format</p>
          <button onClick={exportCsv} className="btn btn-primary w-full text-sm" disabled={loading['tasks-csv']}>
            {loading['tasks-csv'] ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-3.5 h-3.5" /> Export</>}
          </button>
        </div>

        <div className="glass-card p-5 text-center">
          <FileJson className="w-6 h-6 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Analytics (JSON)</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>30-day data</p>
          <button onClick={() => exportJson('analytics')} className="btn btn-primary w-full text-sm" disabled={loading['analytics-json']}>
            {loading['analytics-json'] ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-3.5 h-3.5" /> Export</>}
          </button>
        </div>
      </div>
    </div>
  )
}
