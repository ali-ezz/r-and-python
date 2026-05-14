import { TrendingUp } from 'lucide-react'

export default function SkylineView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  const sorted = [...tasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  })

  return (
    <div className="space-y-2">
      {sorted.length === 0 ? (
        <div className="text-center py-16"><p style={{ color: 'var(--text-muted)' }}>No tasks to display</p></div>
      ) : (
        sorted.map((t, i) => {
          const height = 60 - i * 2
          const priorityWidths = { urgent: 'w-full', high: 'w-3/4', medium: 'w-1/2', low: 'w-1/4' }
          return (
            <div key={t.id} className="flex items-center gap-4 cursor-pointer" onClick={() => onOpenDetail(t)} style={{ opacity: 1 - i * 0.02 }}>
              <div className={`glass-card ${priorityWidths[t.priority] || 'w-1/2'} p-3 transition-all hover:translate-x-1`} style={{ minHeight: height > 30 ? height : 30 }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate" style={{ color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.priority}</span>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
