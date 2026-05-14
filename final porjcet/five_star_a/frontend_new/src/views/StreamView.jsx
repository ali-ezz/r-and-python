import { FileText, Hourglass, CheckCircle, Clipboard } from 'lucide-react'

const statusIconMap = {
  todo: FileText,
  in_progress: Hourglass,
  done: CheckCircle,
}

export default function StreamView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  const sorted = [...tasks].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))

  const timeAgo = (dateStr) => {
    if (!dateStr) return 'Unknown'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-2">
      {sorted.map(t => {
        const StatusIcon = statusIconMap[t.status] || Clipboard
        return (
          <div key={t.id} className="flex items-center gap-4 p-4 rounded-lg glass-card cursor-pointer transition-all" onClick={() => onOpenDetail(t)}>
            <StatusIcon className="w-5 h-5 flex-shrink-0" style={{ color: t.status === 'done' ? 'var(--success)' : t.status === 'in_progress' ? 'var(--warning)' : 'var(--accent-primary)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {projects.find(p => p.id === t.project_id)?.name || 'No project'} · Updated {timeAgo(t.updated_at)}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onStatusChange(t) }} className="btn btn-sm btn-ghost">
              {t.status === 'done' ? 'Done' : t.status === 'todo' ? 'Start' : 'Complete'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
