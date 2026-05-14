import { CheckCircle, Circle, Clock, Calendar, Flag, MapPin, Tag } from 'lucide-react'

const priorityColors = {
  low: '#94a3b8',
  medium: 'var(--accent-primary)',
  high: '#d97706',
  urgent: '#dc2626',
}

const statusColors = {
  todo: 'var(--status-in-progress)',
  in_progress: 'var(--warning)',
  done: 'var(--success)',
}

export default function TaskCard({ task, project, onStatusChange, onDelete, onEdit, onOpenDetail, compact = false }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:translate-y-[-1px]"
        style={{ background: 'rgba(194,176,150,0.05)' }}
        onClick={() => onOpenDetail(task)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(task) }}
          className="flex-shrink-0"
          style={{ color: task.status === 'done' ? 'var(--success)' : 'var(--text-muted)' }}
        >
          {task.status === 'done' ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
        <span className="flex-1 text-sm truncate" style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {task.title}
        </span>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: priorityColors[task.priority] || priorityColors.medium }} />
      </div>
    )
  }

  return (
    <div
      className="glass-card p-4 cursor-pointer transition-all hover:translate-y-[-2px]"
      onClick={() => onOpenDetail(task)}
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(task) }}
          className="flex-shrink-0 mr-2 mt-0.5"
          style={{ color: task.status === 'done' ? 'var(--success)' : 'var(--text-muted)' }}
        >
          {task.status === 'done' ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
            {task.title}
          </p>
          {task.description && <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{task.description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {project && (
          <span className="flex items-center gap-1">
            <Flag className="w-3 h-3" /> {project.name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {formatDate(task.due_date)}
        </span>
        <span className="flex items-center gap-1" style={{ color: priorityColors[task.priority] || priorityColors.medium }}>
          <Clock className="w-3 h-3" /> {task.priority}
        </span>
        {task.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {task.location}
          </span>
        )}
        {task.labels?.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" /> {task.labels.map(l => l.name || l).join(', ')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <span className="badge" style={{ background: `color-mix(in srgb, ${statusColors[task.status]} 15%, transparent)`, color: statusColors[task.status] }}>
          {task.status?.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-1">
          {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(task) }} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>Edit</button>}
          {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(task.id) }} className="p-1 rounded hover:bg-red-500/20 transition-colors" style={{ color: 'var(--text-muted)' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}
