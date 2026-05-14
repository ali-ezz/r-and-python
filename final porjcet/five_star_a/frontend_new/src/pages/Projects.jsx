import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import { api } from '../services/api'
import { Plus, FolderKanban, Users, Trash2, Pencil, Copy, MessageSquare, Send } from 'lucide-react'

export default function Projects() {
  const location = useLocation()
  const { user } = useAuthStore()
  const { projects, fetchProjects, addToast } = useAppStore()

  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', color: '#c2b096', description: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editProject, setEditProject] = useState({ name: '', color: '#c2b096', description: '' })
  const [loading, setLoading] = useState(false)
  const [chatProjectId, setChatProjectId] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const highlightId = new URLSearchParams(location.search).get('highlight')

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = async () => {
    if (!newProject.name.trim()) return
    setLoading(true)
    try {
      await api.post('/projects', newProject)
      await fetchProjects()
      setShowCreate(false)
      setNewProject({ name: '', color: '#c2b096', description: '' })
      addToast({ type: 'success', message: 'Project created' })
    } catch (e) {
      addToast({ type: 'error', message: e?.response?.data?.detail || 'Could not create project' })
    }
    finally { setLoading(false) }
  }

  const openEdit = (project) => {
    setEditingProject(project)
    setEditProject({
      name: project.name || '',
      description: project.description || '',
      color: project.color || '#c2b096',
      icon: project.icon || null,
    })
    setShowEdit(true)
  }

  const saveEdit = async () => {
    if (!editingProject || !editProject.name.trim()) return
    setLoading(true)
    try {
      await api.put(`/projects/${editingProject.id}`, editProject)
      await fetchProjects()
      setShowEdit(false)
      setEditingProject(null)
      addToast({ type: 'success', message: 'Project updated' })
    } catch (e) {
      addToast({ type: 'error', message: e?.response?.data?.detail || 'Could not update project' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this project?')) return
    try {
      await api.delete(`/projects/${id}`)
      await fetchProjects()
      addToast({ type: 'success', message: 'Project deleted' })
    } catch (e) {
      addToast({ type: 'error', message: e?.response?.data?.detail || 'Could not delete project' })
    }
  }

  const [dupLoading, setDupLoading] = useState(null)

  const handleDuplicate = async (id) => {
    if (!confirm('Duplicate this project?')) return
    setDupLoading(id)
    try {
      await api.post(`/projects/${id}/duplicate`)
      await fetchProjects()
      addToast({ type: 'success', message: 'Project duplicated' })
    } catch (e) {
      addToast({ type: 'error', message: 'Could not duplicate project' })
    } finally { setDupLoading(null) }
  }

  const openChat = (projectId) => {
    setChatProjectId(projectId)
    const stored = localStorage.getItem(`project-chat-${projectId}`)
    setChatMessages(stored ? JSON.parse(stored) : [])
  }

  const sendChatMessage = () => {
    if (!chatInput.trim() || !chatProjectId) return
    const msg = { id: Date.now(), text: chatInput.trim(), sender: 'You', time: new Date().toLocaleTimeString() }
    const updated = [...chatMessages, msg]
    setChatMessages(updated)
    localStorage.setItem(`project-chat-${chatProjectId}`, JSON.stringify(updated))
    setChatInput('')
  }

  const currentProject = projects.find(p => p.id === chatProjectId)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Projects</h1>
          <p style={{ color: 'var(--text-muted)' }}>{projects.length} projects</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus className="w-4 h-4" /> New Project</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="glass-card empty-state py-16">
          <FolderKanban className="w-16 h-16" />
          <h3 className="text-xl mt-4" style={{ color: 'var(--text-primary)' }}>No projects yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {user?.role === 'admin' ? 'Create your first project' : 'Your admin hasn’t created a project in this workspace yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="glass-card p-5 group transition-all" style={highlightId === project.id ? { outline: '2px solid var(--accent-solid)', boxShadow: '0 0 0 3px var(--accent-glow)' } : undefined}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${project.color || '#c2b096'}30` }}>
                    <FolderKanban className="w-5 h-5" style={{ color: project.color || '#c2b096' }} />
                  </div>
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>{project.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex gap-1 hidden group-hover:flex">
                  <button onClick={() => openChat(project.id)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Chat"><MessageSquare className="w-4 h-4" /></button>
                  {user?.role === 'admin' && (
                    <>
                      <button onClick={() => openEdit(project)} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDuplicate(project.id)} disabled={dupLoading === project.id} className="p-1.5 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-50" style={{ color: 'var(--text-muted)' }} title="Duplicate">
                        {dupLoading === project.id ? <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(project.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20" style={{ color: 'var(--text-muted)' }} title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project.creator?.username || project.owner?.username || 'Owner'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Create Project</h2>
            <div className="space-y-4">
              <input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className="glass-input w-full" placeholder="Project name..." />
              <input value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} className="glass-input w-full" placeholder="Description..." />
              <div className="flex items-center gap-3">
                <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Color:</label>
                <input type="color" value={newProject.color} onChange={(e) => setNewProject({ ...newProject, color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleCreate} className="btn btn-primary flex-1" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && editingProject && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Edit Project</h2>
            <div className="space-y-4">
              <input value={editProject.name} onChange={(e) => setEditProject({ ...editProject, name: e.target.value })} className="glass-input w-full" placeholder="Project name..." />
              <input value={editProject.description} onChange={(e) => setEditProject({ ...editProject, description: e.target.value })} className="glass-input w-full" placeholder="Description..." />
              <div className="flex items-center gap-3">
                <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Color:</label>
                <input type="color" value={editProject.color} onChange={(e) => setEditProject({ ...editProject, color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEdit(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={saveEdit} className="btn btn-primary flex-1" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatProjectId && currentProject && (
        <div className="modal-overlay" onClick={() => setChatProjectId(null)}>
          <div className="modal-content p-0 overflow-hidden" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-solid)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{currentProject.name}</h3>
              </div>
              <button onClick={() => setChatProjectId(null)} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto space-y-3" style={{ maxHeight: '320px' }}>
              {chatMessages.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet. Start the conversation!</p>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className="flex flex-col" style={{ alignItems: msg.sender === 'You' ? 'flex-end' : 'flex-start' }}>
                    <div className="px-3 py-2 rounded-lg max-w-xs" style={{ background: msg.sender === 'You' ? 'var(--accent-glow)' : 'var(--bg-secondary)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{msg.text}</p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{msg.sender} · {msg.time}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 p-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()} className="glass-input flex-1 text-sm" placeholder="Type a message..." />
              <button onClick={sendChatMessage} className="btn btn-primary btn-sm"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
