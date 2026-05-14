import { BarChart3 } from 'lucide-react'

export default function WorkloadView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  const byProject = {}
  tasks.forEach(t => {
    const pname = projects.find(p => p.id === t.project_id)?.name || 'Unassigned'
    if (!byProject[pname]) byProject[pname] = { total: 0, done: 0, todo: 0, in_progress: 0, tasks: [] }
    byProject[pname].total++
    byProject[pname][t.status] = (byProject[pname][t.status] || 0) + 1
    byProject[pname].tasks.push(t)
  })

  return (
    <div className="space-y-4">
      {Object.entries(byProject).length === 0 ? (
        <div className="text-center py-16"><p style={{ color: 'var(--text-muted)' }}>No tasks to display</p></div>
      ) : (
        Object.entries(byProject).map(([name, data]) => {
          const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
          return (
            <div key={name} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.total} tasks</span>
                </div>
                <span className="text-sm font-medium" style={{ color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--error)' }}>{pct}% done</span>
              </div>
              <div className="w-full h-2 rounded-full mb-3" style={{ background: 'rgba(194,176,150,0.1)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent-gradient)' }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                <span>To Do: {data.todo}</span>
                <span>In Progress: {data.in_progress}</span>
                <span>Done: {data.done}</span>
              </div>
              <div className="space-y-1">
                {data.tasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white/5" onClick={() => onOpenDetail(t)}>
                    <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                    <span className="text-sm flex-1 truncate" style={{ color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
