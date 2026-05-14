import { MapPin } from 'lucide-react'

export default function MapView({ tasks, projects, onStatusChange, onDelete, onEdit, onOpenDetail }) {
  // Filter tasks with locations
  const withLocation = tasks.filter(t => t.location || (t.latitude && t.longitude))
  const withoutLocation = tasks.filter(t => !t.location && !(t.latitude && t.longitude))

  return (
    <div className="space-y-4">
      <div className="glass-card p-6" style={{ minHeight: 300 }}>
        {withLocation.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>No tasks with locations</h3>
            <p style={{ color: 'var(--text-muted)' }}>Add locations to tasks to see them on the map</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {withLocation.map(t => (
              <div key={t.id} className="glass-card p-4 cursor-pointer hover:translate-y-[-2px] transition-all" onClick={() => onOpenDetail(t)}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.location}</span>
                </div>
                <p className="text-sm" style={{ color: t.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {withoutLocation.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{withoutLocation.length} tasks without location</p>
        </div>
      )}
    </div>
  )
}
