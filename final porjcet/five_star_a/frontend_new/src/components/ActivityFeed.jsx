import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { Bell, Clipboard, CheckCircle, Repeat, Pin } from 'lucide-react'

const typeIconMap = {
  system: Bell,
  task_assigned: Clipboard,
  task_completed: CheckCircle,
  recurring_generated: Repeat,
}

export default function ActivityFeed() {
  const { activity, activityLoading, fetchActivity } = useAppStore()

  useEffect(() => { fetchActivity() }, [])

  if (activityLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>

  if (activity.length === 0) {
    return <div className="text-center py-8"><p style={{ color: 'var(--text-muted)' }}>No recent activity</p></div>
  }

  return (
    <div className="space-y-2">
      {activity.slice(0, 10).map((item) => {
        const Icon = typeIconMap[item.notification_type] || Pin
        return (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: item.is_read ? 'transparent' : 'rgba(194,176,150,0.08)' }}>
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.message}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
