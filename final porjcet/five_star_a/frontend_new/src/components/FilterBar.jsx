import { Search, Filter, X } from 'lucide-react'

export default function FilterBar({ projects, assignableUsers, filters, onFilterChange, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg glass">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          value={filters.search || ''}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="glass-input input-with-icon"
          placeholder="Search tasks..."
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />

        <select value={filters.status || ''} onChange={(e) => onFilterChange({ status: e.target.value })} className="glass-input" style={{ minWidth: 120 }}>
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <select value={filters.priority || ''} onChange={(e) => onFilterChange({ priority: e.target.value })} className="glass-input" style={{ minWidth: 120 }}>
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select value={filters.assigned_to || ''} onChange={(e) => onFilterChange({ assigned_to: e.target.value })} className="glass-input" style={{ minWidth: 140 }}>
          <option value="">All Assignees</option>
          {(assignableUsers || []).map(u => <option key={u.id} value={u.id}>{u.username || u.full_name || u.email}</option>)}
        </select>

        <select value={filters.project_id || ''} onChange={(e) => onFilterChange({ project_id: e.target.value })} className="glass-input" style={{ minWidth: 140 }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {(filters.search || filters.status || filters.priority || filters.assigned_to || filters.project_id) && (
        <button onClick={onClear} className="btn btn-ghost btn-sm">
          <X className="w-3 h-3" /> Clear Filters
        </button>
      )}
    </div>
  )
}
