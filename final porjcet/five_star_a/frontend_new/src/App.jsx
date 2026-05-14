import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { ToastContainer } from './components/Toast'
import Layout from './components/Layout'
import AppStartup from './components/AppStartup'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import Search from './pages/Search'
import Friends from './pages/Friends'
import Settings from './pages/Settings'
import Export from './pages/Export'
import AdminUsers from './pages/AdminUsers'
import People from './pages/People'
import Focus from './pages/Focus'
import Analytics from './pages/Analytics'
import Notifications from './pages/Notifications'
import Integrations from './pages/Integrations'
import Team from './pages/Team'
import Monitoring from './pages/Monitoring'

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore()
  if (loading) {
    return <AppStartup label="Checking your session" />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuthStore()
  if (loading) {
    return <AppStartup label="Checking your session" />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function ProjectsRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuthStore()
  if (loading) {
    return <AppStartup label="Checking your session" />
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'employee') return <Navigate to="/tasks" replace />
  return children
}

export default function App() {
  const { checkAuth, loading } = useAuthStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    checkAuth().then(() => setInitialized(true))
  }, [checkAuth])

  if (!initialized || loading) {
    return <AppStartup label="Connecting to the backend and restoring your workspace" />
  }

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="projects" element={
            <ProjectsRoute>
              <Projects />
            </ProjectsRoute>
          } />
          <Route path="search" element={<Search />} />
          <Route path="friends" element={<Friends />} />
          <Route path="people" element={<People />} />
          <Route path="export" element={<Export />} />
          <Route path="settings" element={<Settings />} />
          <Route path="focus" element={<Focus />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="team" element={<Team />} />
        </Route>

        {/* Admin-only routes */}
        <Route path="/admin/users" element={
          <AdminRoute>
            <Layout />
          </AdminRoute>
        }>
          <Route index element={<AdminUsers />} />
        </Route>

        <Route path="/monitoring" element={
          <AdminRoute>
            <Layout />
          </AdminRoute>
        }>
          <Route index element={<Monitoring />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
