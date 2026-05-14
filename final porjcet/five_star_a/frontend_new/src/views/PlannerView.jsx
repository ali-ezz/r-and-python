import { Calendar, CheckCircle, ArrowRight } from 'lucide-react'

export default function PlannerView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  const grouped = {}
  tasks.forEach(t => {
    const key = t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No Due Date'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  })

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Due Date') return 1
    if (b === 'No Due Date') return -1
    return new Date(a) - new Date(b)
  })

  return (
    <div className="space-y-4">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{date}</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({grouped[date].length})</span>
          </div>
          <div className="space-y-2 ml-6">
            {grouped[date].map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg glass-card cursor-pointer" onClick={() => onOpenDetail(t)}>
                <button onClick={(e) => { e.stopPropagation(); onStatusChange(t) }} className="flex-shrink-0" style={{ color: t.status === 'done' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {t.status === 'done' ? <CheckCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
                </div>
                <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-solid)' }}>{t.priority}</span>
                <button onClick={(e) => { e.stopPropagation(); onStatusChange(t) }} className="text-xs" style={{ color: t.status === 'done' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {t.status === 'done' ? 'Done' : t.status === 'todo' ? 'Start' : 'Complete'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
