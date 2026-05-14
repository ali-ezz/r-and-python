import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Bell, Check, CheckCheck, Trash2, Clock, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react'

const typeIcons = {
  task_assigned: User,
  task_completed: CheckCircle,
  task_overdue: AlertCircle,
  recurring_generated: Calendar,
  system: Bell,
}

const typeColors = {
  task_assigned: 'var(--accent-solid)',
  task_completed: 'var(--success)',
  task_overdue: 'var(--error)',
  recurring_generated: 'var(--warning)',
  system: 'var(--text-muted)',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread

  useEffect(() => { fetchNotifications() }, [filter])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const url = filter === 'unread'
        ? '/notifications?skip=0&limit=50&unread_only=true'
        : '/notifications?skip=0&limit=50'
      const data = await api.get(url)
      const list = data.notifications || data || []
      setNotifications(Array.isArray(list) ? list : [])
      setTotal(data.total || list.length)
      setUnread(data.unread || list.filter(n => !n.is_read).length)
    } catch (e) {
      setNotifications([])
    } finally { setLoading(false) }
  }

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnread(u => Math.max(0, u - 1))
    } catch (e) { }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch (e) { }
  }

  const formatTime = (d) => {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h1>
          <p style={{ color: 'var(--text-muted)' }}>{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="glass-input text-sm">
            <option value="all">All</option>
            <option value="unread">Unread only</option>
          </select>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn btn-secondary btn-sm transition-all duration-200 hover:scale-[1.02]">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="glass-card empty-state py-20 text-center">
          <Bell className="w-20 h-20 mx-auto mb-5" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {filter === 'unread' ? 'You\'re all caught up!' : 'We\'ll notify you about important updates'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const notifType = n.notification_type || n.type || 'system'
            const Icon = typeIcons[notifType] || Bell
            const color = typeColors[notifType] || 'var(--text-muted)'
            return (
              <div
                key={n.id}
                className="glass-card p-4 flex items-start gap-4 transition-all duration-200 hover:shadow-md"
                style={{
                  background: n.is_read ? 'transparent' : 'rgba(194,176,150,0.08)',
                  borderLeft: n.is_read ? 'none' : `3px solid ${color}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {n.title || n.message || 'Notification'}
                  </p>
                  {n.description && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{n.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" /> {formatTime(n.created_at)}
                    </span>
                    {n.is_read ? (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Read</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
                        Unread
                      </span>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="p-2 rounded-lg transition-colors hover:bg-white/10 flex-shrink-0"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
