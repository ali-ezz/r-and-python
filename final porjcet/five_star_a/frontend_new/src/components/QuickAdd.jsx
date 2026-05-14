import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { X, FileText, Mic, Mail, Send } from 'lucide-react'
import { api } from '../services/api'

export default function QuickAdd({ onClose }) {
  const { projects, fetchProjects, fetchTasks, addToast } = useAppStore()
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  const handleSubmit = async () => {
    if (!text.trim()) return
    if (!projectId) {
      addToast({ type: 'error', message: 'Please select a project' })
      return
    }

    setLoading(true)
    try {
      if (mode === 'voice') {
        await api.post('/tasks/voice', { project_id: projectId, text })
      } else if (mode === 'email') {
        await api.post('/tasks/email', { project_id: projectId, subject: text, body: '' })
      } else {
        await api.post('/tasks', {
          title: text,
          project_id: projectId,
          priority,
          difficulty: 1,
          urgency: 1,
          importance: 1,
        })
      }
      setText('')
      onClose()
      fetchTasks({ skip: 0, limit: 20 })
      addToast({ type: 'success', message: 'Task created!' })
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: e.response?.data?.detail || 'Failed to create task' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Quick Add Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'text', label: 'Text', icon: FileText },
            { id: 'voice', label: 'Voice', icon: Mic },
            { id: 'email', label: 'Email', icon: Mail },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} className="flex-1 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1" style={{ background: mode === m.id ? 'var(--accent-glow)' : 'transparent', color: mode === m.id ? 'var(--accent-solid)' : 'var(--text-muted)' }}>
              <m.icon className="w-3 h-3" /> {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit() }}
            className="glass-input w-full"
            rows={3}
            placeholder={mode === 'voice' ? 'Describe your task naturally...' : mode === 'email' ? 'Email subject...' : 'Task title...'}
          />

          <div className="grid grid-cols-2 gap-3">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="glass-input">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {mode === 'text' && (
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="glass-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            )}
          </div>

          <button onClick={handleSubmit} className="btn btn-primary w-full" disabled={loading || !text.trim()}>
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Create Task</>}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Ctrl+Enter to submit</p>
        </div>
      </div>
    </div>
  )
}
