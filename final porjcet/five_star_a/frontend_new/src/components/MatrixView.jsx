import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import TaskCard from './TaskCard'

const quadrants = [
  { id: 'urgent-important', label: 'Urgent & Important', color: 'var(--error)', filter: (t) => t.urgency >= 7 && t.importance >= 7 },
  { id: 'important-not-urgent', label: 'Important, Not Urgent', color: 'var(--status-in-progress)', filter: (t) => t.urgency < 7 && t.importance >= 7 },
  { id: 'urgent-less-important', label: 'Urgent, Less Important', color: '#f59e0b', filter: (t) => t.urgency >= 7 && t.importance < 7 },
  { id: 'later-delegate', label: 'Later / Delegate', color: '#6b7280', filter: (t) => t.urgency < 7 && t.importance < 7 },
]

export default function MatrixView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quadrants.map((q) => {
        const qTasks = tasks.filter(q.filter)
        return (
          <div key={q.id} className="glass-card p-4" style={{ borderLeft: `3px solid ${q.color}` }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center justify-between" style={{ color: 'var(--text-primary)' }}>
              <span>{q.label}</span>
              <span className="badge" style={{ background: `${q.color}20`, color: q.color }}>{qTasks.length}</span>
            </h3>
            {qTasks.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No tasks</p>
            ) : (
              <div className="space-y-2">
                {qTasks.map(t => (
                  <TaskCard key={t.id} task={t} project={projects.find(p => p.id === t.project_id)} onStatusChange={onStatusChange} onDelete={onDelete} onEdit={onEdit} onOpenDetail={onOpenDetail} compact />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
