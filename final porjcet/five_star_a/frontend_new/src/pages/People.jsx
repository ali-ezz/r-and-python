import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, UserPlus, Search, Send, MessageSquare,
  Pencil, Trash2, RefreshCw, Check, X, AlertCircle
} from 'lucide-react'
import { api } from '../services/api'
import { API_BASE } from '../services/config'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'

const ROLE_CONFIG = {
  admin: { color: 'var(--error)', label: 'Admin', bg: 'rgba(239, 68, 68, 0.15)' },
  project_manager: { color: 'var(--accent-solid)', label: 'Manager', bg: 'rgba(99, 102, 241, 0.15)' },
  employee: { color: 'var(--text-muted)', label: 'Employee', bg: 'var(--bg-tertiary)' },
}

export default function People() {
  const { addToast } = useAppStore()
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('chat')
  const isAdmin = currentUser?.role === 'admin'

  const tabs = [
    { id: 'chat', label: 'Team Chat', icon: MessageSquare },
    ...(isAdmin ? [{ id: 'users', label: 'Users', icon: Users }] : []),
  ]

  return (
    <div className="people-page animate-fade-in">
      <div className="people-header">
        <div className="title-section">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>People</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {activeTab === 'chat' ? 'Communicate with your team' : 'Manage team members and permissions'}
          </p>
        </div>
        <div className="tab-navigation">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${isActive ? 'active' : ''}`}
                style={{
                  background: isActive ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                  color: isActive ? 'var(--bg-deepest)' : 'var(--text-muted)',
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="people-content-wrapper">
        {activeTab === 'chat' && <TeamChat currentUser={currentUser} addToast={addToast} />}
        {activeTab === 'users' && isAdmin && <UserManagement addToast={addToast} currentUser={currentUser} />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   TEAM CHAT SECTION
   ═══════════════════════════════════════════ */
function TeamChat({ currentUser, addToast }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editText, setEditText] = useState('')
  const [hoveredMessageId, setHoveredMessageId] = useState(null)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.get('/chat?skip=0&limit=100')
      const msgList = data?.messages || []
      setMessages(msgList.map(m => ({
        id: m.id,
        content: m.content,
        fullName: m.full_name || m.username,
        username: m.username,
        userId: m.user_id,
        avatar_url: m.avatar_url,
        timestamp: new Date(m.created_at),
      })))
    } catch (error) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    try {
      await api.post('/chat', { content: input.trim() })
      setInput('')
      fetchMessages()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to send message' })
    }
  }

  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/chat/${msgId}`)
      fetchMessages()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to delete message' })
    }
  }

  const isOwnMessage = (msg) => msg.userId === currentUser?.id

  const canEditMessage = (msg) => {
    const userRole = currentUser?.role
    if (userRole === 'admin' || userRole === 'project_manager') return true
    return isOwnMessage(msg)
  }

  const startEdit = (msg) => {
    setEditingMessageId(msg.id)
    setEditText(msg.content)
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setEditText('')
  }

  const saveEdit = async (msgId) => {
    if (!editText.trim()) {
      addToast({ type: 'warning', message: 'Message cannot be empty' })
      return
    }
    try {
      const message = messages.find(m => m.id === msgId)
      if (message && !canEditMessage(message)) {
        addToast({ type: 'error', message: 'You do not have permission to edit this message' })
        return
      }
      await api.patch(`/chat/${msgId}`, { content: editText.trim() })
      setEditingMessageId(null)
      setEditText('')
      fetchMessages()
      addToast({ type: 'success', message: 'Message updated' })
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update message' })
    }
  }

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = (date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString() ? 'Today' : date.toLocaleDateString()
  }

  const groupedMessages = []
  let lastDate = null
  messages.forEach(msg => {
    const dateKey = formatDate(msg.timestamp)
    if (dateKey !== lastDate) {
      groupedMessages.push({ type: 'date', label: dateKey, key: `date-${dateKey}` })
      lastDate = dateKey
    }
    groupedMessages.push({ type: 'message', data: msg, key: `msg-${msg.id}` })
  })

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-left">
          <div className="chat-icon"><MessageSquare className="w-5 h-5" /></div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Team Chat</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={fetchMessages} className="refresh-btn btn-icon" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="chat-messages" ref={chatContainerRef}>
        {loading ? (
          <div className="loading-messages">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`skeleton-message ${i % 2 === 0 ? 'own' : 'other'}`}>
                <div className="skeleton-avatar" />
                <div className="skeleton-content">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon"><MessageSquare className="w-16 h-16" /></div>
            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>No messages yet</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Start the conversation with your team</p>
          </div>
        ) : (
          <div className="messages-list">
            {groupedMessages.map(item => {
              if (item.type === 'date') {
                return <div key={item.key} className="date-divider"><span>{item.label}</span></div>
              }
              const msg = item.data
              const isOwn = isOwnMessage(msg)
              const initials = msg.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

              return (
                <div 
                  key={item.key} 
                  className={`message-item ${isOwn ? 'own-message' : 'other-message'}`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {!isOwn && (
                    <div className="message-avatar" style={{ background: 'var(--accent-gradient)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                      {msg.avatar_url && msg.avatar_url.length > 5 ? (
                        <img src={msg.avatar_url.startsWith('http') ? msg.avatar_url : `${API_BASE.replace('/api', '')}${msg.avatar_url.startsWith('/') ? '' : '/'}${msg.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                  )}
                  <div className="message-bubble-wrapper">
                    {!isOwn && (
                      <div className="message-sender">
                        <span className="sender-name">{msg.fullName}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                    {editingMessageId === msg.id ? (
                      <div className="message-edit-container">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') cancelEdit() }}
                          className="message-edit-input"
                          autoFocus
                        />
                        <div className="message-edit-actions">
                          <button onClick={() => saveEdit(msg.id)} className="edit-save-btn" title="Save"><Check className="w-3 h-3" /></button>
                          <button onClick={cancelEdit} className="edit-cancel-btn" title="Cancel"><X className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="message-bubble" style={{
                        background: isOwn ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
                        color: isOwn ? 'var(--bg-deepest)' : 'var(--text-primary)',
                      }}>
                        {msg.content}
                      </div>
                    )}
                    {canEditMessage(msg) && (
                      <div className="message-actions transition-opacity duration-200" style={{ opacity: hoveredMessageId === msg.id ? 1 : 0 }}>
                        {isOwn && <span className="message-time" style={{ marginRight: 'auto' }}>{msg.fullName} · {formatTime(msg.timestamp)}</span>}
                        {!isOwn && <span className="message-time">{formatTime(msg.timestamp)}</span>}
                        {editingMessageId !== msg.id && hoveredMessageId === msg.id && (
                          <>
                            <button onClick={() => startEdit(msg)} className="edit-btn hover:text-white" title="Edit message"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete(msg.id)} className="delete-btn hover:text-red-500" title="Delete message"><X className="w-3 h-3" /></button>
                          </>
                        )}
                      </div>
                    )}
                    {!canEditMessage(msg) && (
                      <div className="message-actions transition-opacity duration-200" style={{ opacity: hoveredMessageId === msg.id ? 1 : 0 }}>
                        <span className="message-time">{msg.fullName} · {formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button onClick={handleSend} className="send-btn" disabled={!input.trim()}><Send className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   USER MANAGEMENT SECTION (Admin Only)
   ═══════════════════════════════════════════ */
function UserManagement({ addToast, currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ email: '', username: '', password: '', fullName: '', role: 'employee' })
  const [pagination, setPagination] = useState({ page: 1, total: 0, pageSize: 20 })
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/users?page=${pagination.page}&page_size=${pagination.pageSize}`)
      setUsers(data.users || [])
      setPagination(prev => ({ ...prev, total: data.total || 0 }))
    } catch (error) {
      console.error('Failed to fetch users:', error)
      if (error.status === 403) {
        setError('Admin access required to view the full team list.')
      } else {
        setError(error.message || 'Failed to load users')
      }
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSearch = async () => {
    if (!search.trim()) { fetchUsers(); return }
    setLoading(true)
    try {
      const data = await api.get(`/users/search?q=${search}&page=1&page_size=50`)
      setUsers(data.users || [])
      setPagination(prev => ({ ...prev, total: data.total || 0, page: 1 }))
      setError(null)
    } catch (error) { /* silent */ }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      addToast({ type: 'warning', message: 'Please fill in all required fields' })
      return
    }
    setActionLoading('create')
    try {
      await api.post('/users', {
        email: formData.email, username: formData.username,
        password: formData.password, confirm_password: formData.password,
        full_name: formData.fullName, role: formData.role
      })
      fetchUsers()
      setShowCreateModal(false)
      setFormData({ email: '', username: '', password: '', fullName: '', role: 'employee' })
      addToast({ type: 'success', message: 'User created successfully!' })
    } catch (error) {
      addToast({ type: 'error', message: error.message || 'Failed to create user' })
    } finally { setActionLoading(null) }
  }

  const handleUpdate = async () => {
    if (!editingUser) return
    setActionLoading('update')
    try {
      const updatePayload = { full_name: editingUser.full_name, role: editingUser.role, email: editingUser.email, username: editingUser.username }
      if (editingUser.password) {
        updatePayload.password = editingUser.password
      }
      await api.put(`/users/${editingUser.id}`, updatePayload)
      fetchUsers()
      setEditingUser(null)
      addToast({ type: 'success', message: 'User updated successfully!' })
    } catch (error) {
      addToast({ type: 'error', message: error.message || 'Failed to update user' })
    } finally { setActionLoading(null) }
  }

  const handleDelete = async (userId) => {
    if (String(userId) === String(currentUser?.id)) { addToast({ type: 'warning', message: 'Cannot delete your own account' }); return }
    if (!confirm('Are you sure you want to delete this user?')) return
    setActionLoading(`delete-${userId}`)
    try {
      await api.delete(`/users/${userId}`)
      fetchUsers()
      addToast({ type: 'success', message: 'User deleted successfully' })
    } catch (error) {
      addToast({ type: 'error', message: error.message || 'Failed to delete user' })
    } finally { setActionLoading(null) }
  }

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) { addToast({ type: 'warning', message: 'Cannot deactivate your own account' }); return }
    setActionLoading(`toggle-${user.id}`)
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active })
      fetchUsers()
      addToast({ type: 'success', message: `User ${user.is_active ? 'deactivated' : 'activated'}` })
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update user status' })
    } finally { setActionLoading(null) }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}`, { role: newRole })
      fetchUsers()
      addToast({ type: 'success', message: 'Role updated successfully' })
    } catch (error) {
      addToast({ type: 'error', message: error.message || 'Failed to update role' })
    }
  }

  const getRoleBadgeStyle = (role) => {
    const styles = {
      admin: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
      project_manager: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', text: '#6366f1' },
      employee: { bg: 'rgba(115, 115, 115, 0.1)', border: 'rgba(115, 115, 115, 0.3)', text: 'var(--text-muted)' },
    }
    return styles[role] || styles.employee
  }

  return (
    <div className="users-container">
      {/* Header */}
      <div className="users-header-modern">
        <div className="header-left">
          <div className="users-icon-badge"><Users className="w-5 h-5" /></div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Team Members</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pagination.total} total users</p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-modern-primary">
          <UserPlus className="w-4 h-4" />
          <span>Add Member</span>
        </button>
      </div>

      {error && (
        <div className="error-banner mb-6 p-4 rounded-xl flex items-center gap-3 animate-shake" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="search-bar-modern">
        <Search className="search-icon-modern" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name, email, or username..."
          className="search-input-modern"
        />
        {search && (
          <button onClick={() => { setSearch(''); fetchUsers() }} className="btn-clear-search" title="Clear">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Users List */}
      <div className="users-scrollable">
        {loading ? (
          <div className="users-grid-loading">
            {[...Array(6)].map((_, i) => <div key={i} className="user-card-skeleton" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state-modern">
            <div className="empty-icon-wrapper"><Users className="w-16 h-16" /></div>
            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>No users found</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Try adjusting your search' : 'Add your first team member to get started'}
            </p>
          </div>
        ) : (
          <div className="users-grid">
            {users.map(user => {
              const initials = (user.full_name || user.username || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              const roleStyle = getRoleBadgeStyle(user.role)
              return (
                <div key={user.id} className="user-card">
                  <div className="user-card-header">
                    <div className="user-avatar-modern" style={{ background: 'var(--accent-gradient)', overflow: 'hidden' }}>
                      {user.avatar_url && user.avatar_url.length > 5 ? (
                        <img src={user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE.replace('/api', '')}${user.avatar_url.startsWith('/') ? '' : '/'}${user.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                      <span className={`user-status-dot ${user.is_active ? 'active' : 'inactive'}`} />
                    </div>
                    <div className="user-card-info">
                      <h3 className="user-card-name">{user.full_name || user.username}</h3>
                      <p className="user-card-username">@{user.username}</p>
                      <p className="user-card-email">{user.email}</p>
                    </div>
                  </div>

                  <div className="user-card-badges">
                    <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'project_manager' ? 'Manager' : 'Employee'}
                    </span>
                    <span className={`status-badge-modern ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="user-card-actions">
                    <select
                      value={user.role || 'employee'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="role-select-modern"
                      disabled={user.id === currentUser?.id}
                    >
                      <option value="admin">Admin</option>
                      <option value="project_manager">Manager</option>
                      <option value="employee">Employee</option>
                    </select>
                    {user.id !== currentUser?.id && (
                      <div className="action-buttons-modern">
                        <button onClick={() => handleToggleActive(user)} disabled={actionLoading === `toggle-${user.id}`} className="btn-action" title={user.is_active ? 'Deactivate' : 'Activate'} style={{ color: user.is_active ? '#ef4444' : '#22c55e' }}>
                          {actionLoading === `toggle-${user.id}` ? <div className="spinner-sm" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditingUser({ ...user })} className="btn-action" title="Edit" style={{ color: 'var(--accent-solid)' }}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(user.id)} disabled={actionLoading === `delete-${user.id}`} className="btn-action" title="Delete" style={{ color: '#ef4444' }}>
                          {actionLoading === `delete-${user.id}` ? <div className="spinner-sm" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.pageSize && (
          <div className="pagination-modern">
            <span className="pagination-text">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <div className="pagination-buttons">
              <button onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))} disabled={pagination.page === 1} className="btn-pagination">Previous</button>
              <span className="page-indicator">{pagination.page}</span>
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page * pagination.pageSize >= pagination.total} className="btn-pagination">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay-modern" onClick={() => { setShowCreateModal(false); setFormData({ email: '', username: '', password: '', fullName: '' }) }}>
          <div className="modal-modern" onClick={e => e.stopPropagation()}>
            <div className="modal-header-modern">
              <div><h2>Add Team Member</h2><p className="modal-subtitle">Create a new user account</p></div>
              <button onClick={() => setShowCreateModal(false)} className="btn-close"><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body-modern">
              <div className="form-field"><label>Full Name</label><input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" className="input-modern" /></div>
              <div className="form-field"><label>Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" className="input-modern" required /></div>
              <div className="form-field"><label>Username *</label><input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="johndoe" className="input-modern" required /></div>
              <div className="form-field"><label>Password *</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Minimum 8 characters" className="input-modern" required /></div>
              <div className="form-field">
                <label>Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="select-modern">
                  <option value="admin">Admin</option>
                  <option value="project_manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="modal-footer-modern">
                <button onClick={() => { setShowCreateModal(false); setFormData({ email: '', username: '', password: '', fullName: '', role: 'employee' }) }} className="btn-modal-secondary">Cancel</button>
                <button onClick={handleCreate} disabled={actionLoading === 'create'} className="btn-modal-primary">
                  {actionLoading === 'create' ? <div className="spinner-sm" /> : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="modal-overlay-modern" onClick={() => setEditingUser(null)}>
          <div className="modal-modern" onClick={e => e.stopPropagation()}>
            <div className="modal-header-modern">
              <div><h2>Edit User</h2><p className="modal-subtitle">Update user information</p></div>
              <button onClick={() => setEditingUser(null)} className="btn-close"><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body-modern">
              <div className="form-field"><label>Full Name</label><input type="text" value={editingUser.full_name || ''} onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })} className="input-modern" /></div>
              <div className="form-field"><label>Username</label><input type="text" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="input-modern" /></div>
              <div className="form-field"><label>Email</label><input type="email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="input-modern" /></div>
              <div className="form-field"><label>Role</label>
                <select value={editingUser.role || 'employee'} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className="select-modern">
                  <option value="admin">Admin</option>
                  <option value="project_manager">Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-field"><label>Reset Password <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(leave blank to keep current)</span></label><input type="password" value={editingUser.password || ''} onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })} placeholder="New password (min 8 characters)" className="input-modern" /></div>
              <div className="modal-footer-modern">
                <button onClick={() => setEditingUser(null)} className="btn-modal-secondary">Cancel</button>
                <button onClick={handleUpdate} disabled={actionLoading === 'update'} className="btn-modal-primary">
                  {actionLoading === 'update' ? <div className="spinner-sm" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
