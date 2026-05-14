import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar } = useAppStore()
  const [sidebarWidth, setSidebarWidth] = useState(sidebarCollapsed ? 56 : 200)

  useEffect(() => {
    setSidebarWidth(sidebarCollapsed ? 56 : 200)
  }, [sidebarCollapsed])

  useEffect(() => {
    const path = location.pathname.split('/')[1]
    const routeMap = {
      'admin': location.pathname.includes('/users') ? 'admin-users' : path,
    }
    const pageId = routeMap[path] || path
    if (pageId) setCurrentPage(pageId)
  }, [location.pathname, setCurrentPage])

  return (
    <div className="app-shell">
      <div className="app-shell-glow app-shell-glow-left" />
      <div className="app-shell-glow app-shell-glow-right" />
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onNavigate={(page) => {
          setCurrentPage(page)
          if (page === 'admin-users') {
            navigate('/admin/users')
          } else {
            navigate(`/${page}`)
          }
        }}
        onLogout={() => { logout(); navigate('/login') }}
      />

      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 relative z-10" style={{ marginLeft: `${sidebarWidth}px` }}>
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 app-main-stage">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
