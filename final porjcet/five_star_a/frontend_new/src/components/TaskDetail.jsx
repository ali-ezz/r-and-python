import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { X, MessageSquare, Paperclip, User, Calendar, Flag, Clock, MapPin, Tag, Send, Upload, Trash2, UserPlus, Edit2, FileText, Download, Eye } from 'lucide-react'
import { api } from '../services/api'
import { API_BASE } from '../services/config'

export default function TaskDetail({ task, onClose, onTaskUpdate }) {
  const { projects, assignableUsers, fetchProjects, fetchAssignableUsers, addToast } = useAppStore()
  const { user: currentUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ ...task })
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [attachments, setAttachments] = useState([])
  const [activeTab, setActiveTab] = useState('details') // details, comments, attachments

  useEffect(() => {
    fetchProjects()
    fetchAssignableUsers()
    // Sync formData when task changes
    setFormData({ ...task })
    // Fetch comments
    api.get(`/tasks/${task.id}/comments`).then(d => setComments(Array.isArray(d) ? d : [])).catch(() => { })
    // Fetch attachments
    api.get(`/tasks/${task.id}/attachments`).then(d => setAttachments(Array.isArray(d) ? d : [])).catch(() => { })
  }, [task.id, fetchProjects, fetchAssignableUsers])

  const handleSave = async () => {
    try {
      const payload = { ...formData }
      if (payload.due_date && payload.due_date.length === 10) {
        payload.due_date += 'T00:00:00Z'
      }
      const updated = await api.put(`/tasks/${task.id}`, payload)
      onTaskUpdate?.(updated)
      setEditing(false)
    } catch (e) {
      if (e?.response?.status !== 429 && !e.networkError) {
         addToast?.({ type: 'error', message: e.response?.data?.detail?.[0]?.msg || e.message || 'Validation failed' })
      }
      console.error(e)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await api.patch(`/tasks/${task.id}/status`, { status: newStatus })
      onTaskUpdate?.(updated)
      setFormData({ ...formData, ...updated })
    } catch (e) {
      addToast?.({ type: 'error', message: e?.response?.data?.detail || 'Invalid status transition' })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    try {
      await api.delete(`/tasks/${task.id}`)
      onClose()
    } catch (e) { console.error(e) }
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    try {
      const comment = await api.post(`/tasks/${task.id}/comments`, { content: newComment })
      setComments([...comments, comment])
      setNewComment('')
    } catch (e) { console.error(e) }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const attachment = await api.post(`/tasks/${task.id}/attachments`, formData)
      setAttachments([...attachments, attachment])
    } catch (err) { console.error(err) }
  }

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Delete this attachment?')) return
    try {
      await api.delete(`/tasks/attachments/${attachmentId}`)
      setAttachments(attachments.filter(a => a.id !== attachmentId))
    } catch (e) { console.error(e) }
  }

  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  const handleEditComment = async (commentId) => {
    if (!editingCommentText.trim()) return
    try {
      const updated = await api.put(`/tasks/comments/${commentId}`, { content: editingCommentText })
      setComments(comments.map(c => c.id === commentId ? updated : c))
      setEditingCommentId(null)
      setEditingCommentText('')
    } catch (e) { console.error(e) }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return
    try {
      await api.delete(`/tasks/comments/${commentId}`)
      setComments(comments.filter(c => c.id !== commentId))
    } catch (e) { console.error(e) }
  }

  const handleAssign = async (userId) => {
    try {
      const updated = await api.post(`/tasks/${task.id}/assign`, { user_id: userId })
      onTaskUpdate?.(updated)
      setFormData({ ...formData, ...updated })
    } catch (e) { console.error(e) }
  }

  const formatDateTime = (d) => d ? new Date(d).toLocaleString() : 'Not set'

  const statusColors = { todo: 'var(--status-in-progress)', in_progress: 'var(--warning)', done: 'var(--success)' }
  const priorityColors = { low: '#94a3b8', medium: 'var(--accent-primary)', high: '#d97706', urgent: '#dc2626' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-3">
            <span className="badge" style={{ background: `color-mix(in srgb, ${statusColors[task.status]} 15%, transparent)`, color: statusColors[task.status] }}>
              {task.status?.replace('_', ' ')}
            </span>
            {task.status === 'todo' && (
              <button onClick={() => handleStatusChange('in_progress')} className="btn btn-sm btn-ghost">Start</button>
            )}
            {task.status === 'in_progress' && (
              <button onClick={() => handleStatusChange('done')} className="btn btn-sm btn-ghost">Complete</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <button onClick={handleDelete} className="p-1.5 rounded hover:bg-red-500/20" style={{ color: 'var(--text-muted)' }}><Trash2 className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          {[
            { id: 'details', label: 'Details', icon: Calendar },
            { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
            { id: 'attachments', label: `Files (${attachments.length})`, icon: Paperclip },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-3 py-1.5 rounded text-sm transition-colors" style={{ background: activeTab === tab.id ? 'var(--accent-glow)' : 'transparent', color: activeTab === tab.id ? 'var(--accent-solid)' : 'var(--text-muted)' }}>
              <tab.icon className="w-3 h-3 inline mr-1" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {editing ? (
                <>
                  <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="glass-input w-full text-lg font-medium" />
                  <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="glass-input w-full" rows={3} placeholder="Description..." />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={formData.priority || 'medium'} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="glass-input">
                      {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="date" value={formData.due_date ? formData.due_date.split('T')[0] : ''} onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })} className="glass-input" />
                    <select 
                      value={formData.project_id || ''} 
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value || null })} 
                      className="glass-input"
                      disabled={currentUser?.role !== 'admin'}
                    >
                      <option value="">No project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select 
                      value={formData.assigned_to || ''} 
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value || null })} 
                      className="glass-input"
                      disabled={currentUser?.role === 'employee'}
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map(user => <option key={user.id} value={user.id}>{user.full_name || user.username || user.email}</option>)}
                    </select>
                    <input value={formData.location || ''} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="glass-input" placeholder="Location" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSave} className="btn btn-primary btn-sm">Save</button>
                    <button onClick={() => { setEditing(false); setFormData({ ...task }) }} className="btn btn-secondary btn-sm">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{task.title}</h3>
                  {task.description && <p style={{ color: 'var(--text-secondary)' }}>{task.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Flag className="w-4 h-4" /> Priority: <span style={{ color: priorityColors[task.priority] }}>{task.priority}</span></div>
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Calendar className="w-4 h-4" /> Due: {task.due_date ? formatDateTime(task.due_date) : 'No due date'}</div>
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Clock className="w-4 h-4" /> Created: {formatDateTime(task.created_at)}</div>
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><User className="w-4 h-4" /> Assigned: {assignableUsers.find((u) => u.id === task.assigned_to)?.full_name || assignableUsers.find((u) => u.id === task.assigned_to)?.username || (task.assigned_to ? 'Assigned user' : 'Unassigned')}</div>
                    {task.completed_at && <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Clock className="w-4 h-4" /> Completed: {formatDateTime(task.completed_at)}</div>}
                  </div>
                  {/* Quick Assign */}
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <UserPlus className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Assign to:</span>
                    <select
                      value={formData.assigned_to || ''}
                      onChange={(e) => handleAssign(e.target.value || null)}
                      className="glass-input text-sm flex-1"
                      disabled={currentUser?.role === 'employee'}
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username || u.email}</option>)}
                    </select>
                  </div>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
                    <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit Task</button>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No comments yet</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="p-3 rounded-lg group/comment relative" style={{ background: 'rgba(194,176,150,0.05)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      {c.avatar_url && c.avatar_url.length > 5 ? (
                        <img src={c.avatar_url.startsWith('http') ? c.avatar_url : `${API_BASE.replace('/api', '')}${c.avatar_url.startsWith('/') ? '' : '/'}${c.avatar_url}`} alt="Avatar" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <User className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.username || c.author?.username || 'Unknown'}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(c.created_at)}</span>
                      <div className="ml-auto hidden group-hover/comment:flex gap-1">
                        <button
                          onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.content) }}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          title="Edit comment"
                        >
                          <Edit2 className="w-3 h-3 text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditComment(c.id)}
                          className="glass-input flex-1 text-sm"
                          autoFocus
                        />
                        <button onClick={() => handleEditComment(c.id)} className="btn btn-primary btn-sm">Save</button>
                        <button onClick={() => { setEditingCommentId(null); setEditingCommentText('') }} className="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.content}</p>
                    )}
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment()} className="glass-input flex-1" placeholder="Add a comment..." />
                <button onClick={addComment} className="btn btn-primary btn-sm"><Send className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3 h-3" /> Upload File
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
              {attachments.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No attachments</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(a => {
                    const fileUrl = a.file_url?.startsWith('http') ? a.file_url : `${API_BASE}${a.file_url?.startsWith('/') ? '' : '/'}${a.file_url || ''}`
                    const isPreviewable = /\.(jpg|jpeg|png|gif|webp|svg|pdf|txt|md)$/i.test(a.file_name || '')
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.file_name || '')
                    return (
                      <div key={a.id} className="p-3 rounded-lg group/attachment" style={{ background: 'rgba(194,176,150,0.05)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.file_name}</span>
                            {a.file_size && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>({(a.file_size / 1024).toFixed(0)} KB)</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {isPreviewable && (
                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-blue-500/20 transition-opacity" title="Preview" style={{ color: 'var(--accent-solid)' }}>
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            <a href={fileUrl} download={a.file_name} className="p-1.5 rounded hover:bg-green-500/20 transition-opacity" title="Download" style={{ color: 'var(--success, #22c55e)' }}>
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(a.id)}
                              className="p-1.5 rounded hover:bg-red-500/20 transition-opacity"
                              title="Delete attachment"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {isImage && (
                          <div className="mt-2">
                            <img src={fileUrl} alt={a.file_name} className="max-w-full max-h-32 rounded-md object-contain" style={{ background: 'var(--bg-tertiary)' }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
