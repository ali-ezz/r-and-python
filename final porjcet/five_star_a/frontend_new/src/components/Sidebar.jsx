import { useMemo } from 'react'
import {
  LayoutDashboard, CheckSquare, FolderKanban, Search,
  Settings, LogOut, ChevronLeft, ChevronRight,
  Download, Users, Activity
} from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { resolveMediaUrl } from '../utils/mediaUrl'
import AppLogo from './AppLogo'
import MiniCalendar from './MiniCalendar'

export default function Sidebar({ user, collapsed, onNavigate, onLogout }) {
  const { currentPage, toggleSidebar, setTaskFilters } = useAppStore()
  const initials = useMemo(() => {
    const source = user?.full_name || user?.username || '5A'
    return source.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  }, [user])

  const handleDayClick = (dateStr) => {
    onNavigate('tasks')
    setTaskFilters({ due_date: dateStr })
    
    // Find tasks for this day
    const dayTasks = useAppStore.getState().tasks.filter(t => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      const clicked = new Date(dateStr)
      return d.getFullYear() === clicked.getFullYear() &&
             d.getMonth() === clicked.getMonth() &&
             d.getDate() === clicked.getDate()
    })
    
    if (dayTasks.length === 1) {
      useAppStore.getState().openTaskDetail(dayTasks[0])
    }
  }

  const navSections = [
    {
      label: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        ...((user?.role === 'admin' || user?.role === 'project_manager')
          ? [{ id: 'projects', label: 'Projects', icon: FolderKanban }]
          : []),
        { id: 'search', label: 'Search', icon: Search },
      ]
    },
    {
      label: 'More',
      items: [
        { id: 'people', label: 'People', icon: Users },
        ...(user?.role === 'admin'
          ? [{ id: 'monitoring', label: 'Monitoring', icon: Activity }]
          : []),
        { id: 'export', label: 'Export', icon: Download },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    },
  ]

  return (
    <aside
      className="fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out sidebar-shell"
      style={{
        width: collapsed ? '56px' : '200px',
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--glass-border)',
      }}
    >
      {/* Top bar: Logo + Collapse */}
      <div className="flex items-center px-2 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--glass-border)', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed ? (
          <>
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden app-logo-chip">
                <AppLogo className="app-logo-mark" alt="5*A app logo" />
              </div>
            </div>
            <button onClick={toggleSidebar} className="sidebar-toggle-btn p-1 rounded flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button onClick={toggleSidebar} className="sidebar-toggle-btn p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* User Profile */}
      {!collapsed && user && (
        <div className="px-2 pt-2 pb-1 flex-shrink-0">
          <div className="sidebar-profile-card">
            {user.avatar_url ? (
              <img src={resolveMediaUrl(user.avatar_url)} alt="Avatar" className="sidebar-profile-avatar" style={{ objectFit: 'cover' }} />
            ) : (
              <div className="sidebar-profile-avatar">{initials}</div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.full_name || user.username}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation - fixed, compact */}
      {!collapsed && (
        <nav className="flex-shrink-0 px-2 pt-1">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1.5">
              <p className="text-[9px] font-semibold mb-1 px-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentPage === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                      style={{
                        background: isActive ? 'var(--accent-gradient)' : 'transparent',
                        color: isActive ? 'var(--bg-deepest)' : 'var(--text-muted)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate text-xs">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* Collapsed nav */}
      {collapsed && (
        <nav className="flex-1 px-2 pt-1 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-2">
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentPage === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all group relative sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                      style={{
                        background: isActive ? 'var(--accent-gradient)' : 'transparent',
                        color: isActive ? 'var(--bg-deepest)' : 'var(--text-muted)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      title={item.label}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="absolute left-full ml-1.5 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}>
                        {item.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* Mini Calendar - STRETCHED to fill ALL remaining space between nav and logout */}
      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-2" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px', paddingBottom: '8px' }}>
          <div className="flex-1 min-h-0">
            <MiniCalendar onDayClick={handleDayClick} />
          </div>
        </div>
      )}

      {/* Logout - always at bottom */}
      <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all sidebar-item sidebar-item-logout" style={{ color: 'var(--text-muted)', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!collapsed && <span className="text-xs">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
