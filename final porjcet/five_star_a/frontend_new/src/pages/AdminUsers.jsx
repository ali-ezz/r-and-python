import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { Users, Search, Plus, Pencil, Trash2, Shield, UserCheck, X, Check, UserPlus, RefreshCw } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'

const ROLES = ['admin', 'project_manager', 'employee']

const roleColors = {
  admin: { bg: 'var(--error)', text: 'white', label: 'Admin' },
  project_manager: { bg: 'var(--accent-primary)', text: 'white', label: 'Manager' },
  employee: { bg: 'var(--bg-secondary)', text: 'var(--text-primary)', label: 'Employee' },
}

export default function AdminUsers() {
  const { addToast } = useAppStore()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [newUser, setNewUser] = useState({ email: '', username: '', password: '', full_name: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)
  const isAdmin = currentUser?.role === 'admin'

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const data = await api.get(`/users?page=${page}&page_size=20`)
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: 'Failed to load users' })
      }
    } finally { setLoading(false) }
  }, [page, isAdmin, addToast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSearch = async () => {
    if (!search.trim()) { fetchUsers(); return }
    setLoading(true)
    try {
      const data = await api.get(`/users/search?q=${search}&page=1&page_size=50`)
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: 'Search failed' })
      }
    } finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      addToast({ type: 'warning', message: 'Please fill in all required fields' })
      return
    }
    if (newUser.password.length < 8) {
      addToast({ type: 'warning', message: 'Password must be at least 8 characters' })
      return
    }
    setActionLoading('create')
    try {
      await api.post('/users', {
        email: newUser.email,
        username: newUser.username,
        password: newUser.password,
        confirm_password: newUser.password,
        full_name: newUser.full_name,
      })
      fetchUsers()
      setShowCreate(false)
      setNewUser({ email: '', username: '', password: '', full_name: '' })
      addToast({ type: 'success', message: 'User created successfully!' })
    } catch (e) {
      addToast({ type: 'error', message: e.message || 'Failed to create user' })
    } finally { setActionLoading(null) }
  }

  const handleUpdate = async () => {
    if (!editingUser || !editingUser.full_name?.trim()) {
      addToast({ type: 'warning', message: 'Name is required' })
      return
    }
    setActionLoading('update')
    try {
      await api.put(`/users/${editingUser.id}`, {
        full_name: editingUser.full_name,
        role: editingUser.role,
        is_active: editingUser.is_active,
      })
      fetchUsers()
      setEditingUser(null)
      addToast({ type: 'success', message: 'User updated successfully!' })
    } catch (e) {
      addToast({ type: 'error', message: e.message || 'Failed to update user' })
    } finally { setActionLoading(null) }
  }

  const handleDelete = async (id) => {
    if (id === currentUser?.id) {
      addToast({ type: 'warning', message: 'You cannot delete your own account' })
      return
    }
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    setActionLoading(`delete-${id}`)
    try {
      await api.delete(`/users/${id}`)
      fetchUsers()
      addToast({ type: 'success', message: 'User deleted successfully' })
    } catch (e) {
      addToast({ type: 'error', message: e.message || 'Failed to delete user' })
    } finally { setActionLoading(null) }
  }

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) {
      addToast({ type: 'warning', message: 'You cannot deactivate your own account' })
      return
    }
    setActionLoading(`toggle-${user.id}`)
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active })
      fetchUsers()
      addToast({ type: 'success', message: `User ${user.is_active ? 'deactivated' : 'activated'} successfully` })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to update user status' })
    } finally { setActionLoading(null) }
  }

  if (!isAdmin) {
    return (
      <div className="glass-card empty-state py-20 text-center animate-fade-in">
        <Shield className="w-20 h-20 mx-auto mb-5" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)' }}>Only administrators can manage users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>{total} registered users</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
        >
          <UserPlus className="w-4 h-4" /> New User
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="glass-input input-with-icon w-full"
              placeholder="Search by name, username, or email..."
            />
          </div>
          <button
            onClick={handleSearch}
            className="btn btn-secondary transition-all duration-200 hover:scale-[1.02]"
          >
            Search
          </button>
          <button
            onClick={() => { setSearch(''); fetchUsers() }}
            className="btn btn-ghost btn-sm transition-all duration-200 hover:scale-[1.05]"
            title="Reset search"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="glass-card p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full" style={{ background: 'var(--bg-tertiary)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded" style={{ background: 'var(--bg-tertiary)', width: '40%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--bg-tertiary)', width: '25%' }} />
              </div>
              <div className="h-6 rounded-full" style={{ background: 'var(--bg-tertiary)', width: '70px' }} />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card empty-state py-20 text-center">
          <Users className="w-20 h-20 mx-auto mb-5" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No users found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {search ? 'Try a different search term' : 'Create your first user to get started'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>User</th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Role</th>
                  <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="text-right p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => {
                  const roleInfo = roleColors[u.role] || roleColors.employee
                  return (
                    <tr
                      key={u.id}
                      className="border-b hover:bg-white/5 group"
                      style={{
                        borderColor: 'var(--glass-border)',
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                            style={{
                              background: 'var(--accent-gradient)',
                              color: 'var(--bg-deepest)',
                            }}
                          >
                            {(u.full_name || u.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {u.full_name || u.username}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              @{u.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4" style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td className="p-4">
                        <select
                          value={u.role || 'employee'}
                          onChange={async (e) => {
                            try {
                              await api.put(`/users/${u.id}`, { role: e.target.value })
                              fetchUsers()
                              addToast({ type: 'success', message: 'Role updated' })
                            } catch (e) {
                              addToast({ type: 'error', message: 'Failed to update role' })
                            }
                          }}
                          className="text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer"
                          style={{
                            background: roleInfo.bg,
                            color: roleInfo.text,
                          }}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{roleColors[r]?.label || r}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${u.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1 hidden group-hover:flex">
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={actionLoading === `toggle-${u.id}`}
                            className="p-2 rounded-lg transition-all duration-200 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50"
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {actionLoading === `toggle-${u.id}` ? (
                              <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            className="p-2 rounded-lg transition-all duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            title="Edit user"
                          >
                            <Pencil className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={actionLoading === `delete-${u.id}`}
                            className="p-2 rounded-lg transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                            title="Delete user"
                          >
                            {actionLoading === `delete-${u.id}` ? (
                              <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
                >
                  Previous
                </button>
                <span className="text-sm px-3 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 20 >= total}
                  className="btn btn-secondary btn-sm disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div
          className="modal-overlay animate-fade-in"
          onClick={() => { setShowCreate(false); setNewUser({ email: '', username: '', password: '', full_name: '' }) }}
        >
          <div className="modal-content p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Create New User</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Add a new user to the system</p>
              </div>
              <button onClick={() => { setShowCreate(false); setNewUser({ email: '', username: '', password: '', full_name: '' }) }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                <input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="glass-input w-full" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Email *</label>
                <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="glass-input w-full" placeholder="john@example.com" type="email" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Username *</label>
                <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="glass-input w-full" placeholder="johndoe" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Password * (min 8 characters)</label>
                <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="glass-input w-full" placeholder="••••••••" type="password" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowCreate(false); setNewUser({ email: '', username: '', password: '', full_name: '' }) }}
                  className="btn btn-secondary flex-1 transition-all duration-200 hover:scale-[1.02]">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={actionLoading === 'create'}
                  className="btn btn-primary flex-1 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50">
                  {actionLoading === 'create' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4" /> Create</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div
          className="modal-overlay animate-fade-in"
          onClick={() => setEditingUser(null)}
        >
          <div className="modal-content p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Edit User</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>@{editingUser.username}</p>
              </div>
              <button onClick={() => setEditingUser(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                <input value={editingUser.full_name || ''} onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="glass-input w-full" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="glass-input w-full" placeholder="Email" type="email" />
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Role: <strong style={{ color: 'var(--text-primary)' }}>{roleColors[editingUser.role]?.label || editingUser.role}</strong>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)}
                  className="btn btn-secondary flex-1 transition-all duration-200 hover:scale-[1.02]">
                  Cancel
                </button>
                <button onClick={handleUpdate} disabled={actionLoading === 'update'}
                  className="btn btn-primary flex-1 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50">
                  {actionLoading === 'update' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Check className="w-4 h-4" /> Save</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
