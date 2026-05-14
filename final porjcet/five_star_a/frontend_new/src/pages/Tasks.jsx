import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import { Plus, List, Columns, Grid3x3, Calendar as CalendarIcon, Layout, Map, BarChart3, Activity, CheckSquare, X, ChevronLeft, ChevronRight, Trash2, CheckCircle, Circle, Pencil, RefreshCw } from 'lucide-react'
import TaskCard from '../components/TaskCard'
import TaskDetail from '../components/TaskDetail'
import FilterBar from '../components/FilterBar'
import MatrixView from '../components/MatrixView'
import PlannerView from '../views/PlannerView'
import SkylineView from '../views/SkylineView'
import StreamView from '../views/StreamView'
import WorkloadView from '../views/WorkloadView'
import MapView from '../views/MapView'
import ActivityFeed from '../components/ActivityFeed'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'kanban', label: 'Kanban', icon: Columns },
  { id: 'matrix', label: 'Matrix', icon: Grid3x3 },
  { id: 'planner', label: 'Planner', icon: CalendarIcon },
  { id: 'skyline', label: 'Skyline', icon: Layout },
  { id: 'stream', label: 'Stream', icon: Activity },
  { id: 'workload', label: 'Workload', icon: BarChart3 },
  { id: 'map', label: 'Map', icon: Map },
]

const STATUSES = ['todo', 'in_progress', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const pageSize = 20

export default function Tasks() {
  const {
    tasks, totalTasks, tasksLoading,
    taskFilters, setTaskFilters, clearTaskFilters, fetchTasks,
    projects, fetchProjects, assignableUsers, fetchAssignableUsers,
    bulkMode, selectedTasks, setBulkMode, toggleTaskSelection, selectAllTasks, clearSelection, bulkUpdateStatus, bulkDeleteTasks, bulkUpdatePriority,
    taskDetailOpen, selectedTask, openTaskDetail, closeTaskDetail,
    addToast,
  } = useAppStore()
  const { user: currentUser } = useAuthStore()

  const [view, setView] = useState('list')
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', project_id: '', priority: 'medium', description: '', due_date: '', location: '', recurrence_rule: '', assigned_to: '' })
  const [showEdit, setShowEdit] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editTaskForm, setEditTaskForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', project_id: '', location: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [page, setPage] = useState(1)
  const [localFilters, setLocalFilters] = useState({ search: '', status: '', priority: '', project_id: '', due_date: '' })
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState('')
  const initialLoadDone = useRef(false)
  const searchTimeout = useRef(null)

  // Load initial data only once
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    fetchProjects()
    fetchAssignableUsers()
    fetchTasks({ skip: 0, limit: pageSize })
  }, [fetchProjects, fetchAssignableUsers, fetchTasks])

  // Reload when page changes
  useEffect(() => {
    if (!initialLoadDone.current) return
    fetchTasks({ skip: (page - 1) * pageSize, limit: pageSize, ...taskFilters })
  }, [page])

  const handleFilterChange = useCallback((newFilters) => {
    const merged = { ...localFilters, ...newFilters }
    setLocalFilters(merged)

    if (newFilters.search !== undefined) {
      clearTimeout(searchTimeout.current)
      searchTimeout.current = setTimeout(() => {
        setTaskFilters({ search: merged.search })
        setPage(1)
        fetchTasks({ skip: 0, limit: pageSize, ...merged })
      }, 500)
    } else {
      setTaskFilters(merged)
      setPage(1)
      fetchTasks({ skip: 0, limit: pageSize, ...merged })
    }
  }, [localFilters, setTaskFilters, fetchTasks])

  const clearFilters = useCallback(() => {
    setLocalFilters({ search: '', status: '', priority: '', project_id: '', due_date: '' })
    clearTaskFilters()
    setPage(1)
    fetchTasks({ skip: 0, limit: pageSize })
  }, [clearTaskFilters, fetchTasks])

  const refreshCurrentPage = useCallback(() => {
    fetchTasks({ skip: (page - 1) * pageSize, limit: pageSize, ...taskFilters })
  }, [fetchTasks, page, taskFilters])

  const handleCreate = async () => {
    if (!newTask.title.trim() || !newTask.project_id) return
    setCreateLoading(true)
    try {
      await api.post('/tasks', {
        title: newTask.title,
        description: newTask.description,
        project_id: newTask.project_id,
        priority: newTask.priority,
        difficulty: 1,
        urgency: 1,
        importance: 1,
        due_date: newTask.due_date || null,
        location: newTask.location || null,
        recurrence_rule: newTask.recurrence_rule || null,
        assigned_to: newTask.assigned_to || null,
      })
      refreshCurrentPage()
      setShowCreate(false)
      setNewTask({ title: '', project_id: '', priority: 'medium', description: '', due_date: '', location: '', recurrence_rule: '', assigned_to: '' })
      addToast({ type: 'success', message: 'Task created!' })
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: e.response?.data?.detail || 'Failed to create task' })
      }
    } finally { setCreateLoading(false) }
  }

  const updateStatus = useCallback(async (task) => {
    if (task.status === 'done') {
      addToast({ type: 'info', message: 'Done tasks cannot move backward' })
      return
    }
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : null
    if (!next) return
    try {
      await api.patch(`/tasks/${task.id}/status`, { status: next })
      refreshCurrentPage()
      addToast({ type: 'success', message: `Task ${next === 'done' ? 'completed' : 'updated'}` })
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: e.response?.data?.detail || 'Status update failed' })
      }
    }
  }, [refreshCurrentPage, addToast])

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return
    try {
      await api.delete(`/tasks/${taskId}`)
      refreshCurrentPage()
      addToast({ type: 'success', message: 'Task deleted' })
    } catch (e) {
      if (e?.response?.status !== 429) {
        addToast({ type: 'error', message: 'Delete failed' })
      }
    }
  }

  const openEditTask = (task) => {
    setEditingTask(task)
    setEditTaskForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      due_date: task.due_date ? String(task.due_date).split('T')[0] : '',
      project_id: task.project_id || '',
      location: task.location || '',
    })
    setShowEdit(true)
  }

  const saveTaskEdit = async () => {
    if (!editingTask) return
    setEditLoading(true)
    try {
      await api.put(`/tasks/${editingTask.id}`, {
        title: editTaskForm.title,
        description: editTaskForm.description || null,
        priority: editTaskForm.priority,
        due_date: editTaskForm.due_date ? editTaskForm.due_date + 'T00:00:00Z' : null,
        project_id: editTaskForm.project_id || editingTask.project_id,
        location: editTaskForm.location || null,
      })
      setShowEdit(false)
      setEditingTask(null)
      refreshCurrentPage()
      addToast({ type: 'success', message: 'Task updated' })
    } catch (e) {
      if (e?.response?.status !== 429) {
        const errorMsg = Array.isArray(e.response?.data?.detail) 
          ? e.response.data.detail[0].msg 
          : e.response?.data?.detail || 'Task update failed';
        addToast({ type: 'error', message: errorMsg })
      }
    } finally {
      setEditLoading(false)
    }
  }

  const moveTaskToStatus = async (taskId, targetStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === targetStatus) return
    const isForward =
      (task.status === 'todo' && targetStatus === 'in_progress') ||
      (task.status === 'in_progress' && targetStatus === 'done')
    if (isForward) {
      try {
        await api.patch(`/tasks/${task.id}/status`, { status: targetStatus })
        refreshCurrentPage()
        addToast({ type: 'success', message: `Moved to ${targetStatus.replace('_', ' ')}` })
      } catch (e) {
        if (e?.response?.status !== 429) {
          addToast({ type: 'error', message: e.response?.data?.detail || 'Could not move task' })
        }
      }
      return
    }
    addToast({ type: 'error', message: 'Invalid transition. Use todo -> in progress -> done.' })
  }

  const getProjectName = (projectId) => projects.find(p => p.id === projectId)?.name || 'Unknown'
  const totalPages = Math.ceil(totalTasks / pageSize)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
          <p style={{ color: 'var(--text-muted)' }}>{totalTasks} total tasks · Page {page} of {totalPages || 1}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-lg p-1 flex gap-0.5 overflow-x-auto">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setView(v.id)} className="px-2 py-1.5 rounded text-xs flex items-center gap-1 transition-colors whitespace-nowrap" style={{ background: view === v.id ? 'var(--accent-glow)' : 'transparent', color: view === v.id ? 'var(--accent-solid)' : 'var(--text-muted)' }}>
                <v.icon className="w-3 h-3" /> <span className="hidden lg:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {!bulkMode ? (
            <div className="flex gap-2">
              {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
                <>
                  <button onClick={() => setBulkMode(true)} className="btn btn-secondary btn-sm">Bulk</button>
                  <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm"><Plus className="w-3 h-3" /> New Task</button>
                </>
              )}
              {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
                <button onClick={async () => {
                  try {
                    const res = await api.post('/tasks/recurrence/run', { limit: 20 })
                    if (res?.count > 0) {
                      addToast({ type: 'success', message: `${res.count} recurring tasks generated` })
                      fetchTasks({ skip: 0, limit: pageSize })
                    } else {
                      addToast({ type: 'info', message: 'No recurring tasks due' })
                    }
                  } catch (e) { addToast({ type: 'error', message: 'Failed to process recurring tasks' }) }
                }} className="btn btn-secondary btn-sm" title="Process recurring tasks">
                  <RefreshCw className="w-3 h-3" /> Recurrence
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedTasks.length} selected</span>
              <button onClick={selectAllTasks} className="btn btn-ghost btn-sm">All</button>
              <select onChange={(e) => e.target.value && bulkUpdateStatus(e.target.value)} className="glass-input" style={{ padding: '4px 8px', fontSize: 12 }} defaultValue="">
                <option value="" disabled>Status →</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select onChange={(e) => e.target.value && bulkUpdatePriority(e.target.value)} className="glass-input" style={{ padding: '4px 8px', fontSize: 12 }} defaultValue="">
                <option value="" disabled>Priority →</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={bulkDeleteTasks} className="btn btn-sm" style={{ background: 'rgba(107,114,128,0.2)', color: 'var(--error)' }}><Trash2 className="w-3 h-3" /></button>
              <button onClick={() => { clearSelection(); setBulkMode(false) }} className="btn btn-ghost btn-sm"><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totalTasks, color: 'var(--accent-primary)' },
          { label: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: 'var(--status-in-progress)' },
          { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: 'var(--warning)' },
          { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="glass-card p-3 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <FilterBar projects={projects} assignableUsers={assignableUsers} filters={localFilters} onFilterChange={handleFilterChange} onClear={clearFilters} />

      {/* Content */}
      {tasksLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="glass-card empty-state py-16">
          <CheckSquare className="w-16 h-16" />
          <h3 className="text-xl mt-4" style={{ color: 'var(--text-primary)' }}>No tasks found</h3>
          <p style={{ color: 'var(--text-muted)' }}>Create a new task or adjust your filters</p>
        </div>
      ) : (
        <>
          {/* List View */}
          {view === 'list' && (
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {bulkMode && <th className="p-3 w-10"><input type="checkbox" checked={selectedTasks.length === tasks.length && tasks.length > 0} onChange={(e) => e.target.checked ? selectAllTasks() : clearSelection()} /></th>}
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Task</th>
                    <th className="text-left p-3 text-sm font-medium hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="text-left p-3 text-sm font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Priority</th>
                    <th className="text-left p-3 text-sm font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Project</th>
                    <th className="text-left p-3 text-sm font-medium hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Due</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} style={{ borderBottom: '1px solid rgba(194,176,150,0.05)' }} className="hover:bg-white/5 transition-colors">
                      {bulkMode && <td className="p-3"><input type="checkbox" checked={selectedTasks.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} /></td>}
                      <td className="p-3">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => openTaskDetail(task)}>
                          <button onClick={(e) => { e.stopPropagation(); updateStatus(task) }} style={{ color: task.status === 'done' ? 'var(--success)' : 'var(--text-muted)' }}>
                            {task.status === 'done' ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <span className="text-sm truncate" style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell"><span className="badge" style={{ background: `${task.status === 'done' ? 'var(--success)' : task.status === 'in_progress' ? 'var(--warning)' : 'var(--status-in-progress)'}20`, color: task.status === 'done' ? 'var(--success)' : task.status === 'in_progress' ? 'var(--warning)' : 'var(--status-in-progress)' }}>{task.status?.replace('_', ' ')}</span></td>
                      <td className="p-3 hidden md:table-cell"><span className={`text-sm priority-${task.priority}`}>{task.priority}</span></td>
                      <td className="p-3 text-sm hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>{getProjectName(task.project_id)}</td>
                      <td className="p-3 text-sm hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
                            <button onClick={() => openEditTask(task)} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Edit task">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {currentUser?.role === 'admin' && (
                            <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:bg-red-500/20" style={{ color: 'var(--text-muted)' }}><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalTasks)} of {totalTasks}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-muted)' }}><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kanban View */}
          {view === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUSES.map((status) => (
                <div key={status} className="flex-shrink-0" style={{ width: 300 }}>
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold capitalize mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span className={`w-2 h-2 rounded-full ${status === 'done' ? 'bg-green-500' : status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                      {status.replace('_', ' ')}
                      <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{tasks.filter(t => t.status === status).length}</span>
                    </h3>
                    <div
                      className={`space-y-2 min-h-[180px] rounded-lg p-2 transition-colors ${dragOverStatus === status ? 'bg-white/5' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverStatus(status)
                      }}
                      onDragLeave={() => setDragOverStatus('')}
                      onDrop={async (e) => {
                        e.preventDefault()
                        const droppedTaskId = e.dataTransfer.getData('text/plain') || draggingTaskId
                        setDragOverStatus('')
                        if (droppedTaskId) {
                          await moveTaskToStatus(droppedTaskId, status)
                        }
                        setDraggingTaskId(null)
                      }}
                    >
                      {tasks.filter(t => t.status === status).map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingTaskId(task.id)
                            e.dataTransfer.setData('text/plain', task.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggingTaskId(null)
                            setDragOverStatus('')
                          }}
                        >
                          <TaskCard 
                            task={task} 
                            project={projects.find(p => p.id === task.project_id)} 
                            onStatusChange={updateStatus} 
                            onDelete={currentUser?.role === 'admin' ? deleteTask : null} 
                            onEdit={(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') ? openEditTask : null} 
                            onOpenDetail={openTaskDetail} 
                            compact 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'matrix' && <MatrixView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
          {view === 'planner' && <PlannerView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
          {view === 'skyline' && <SkylineView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
          {view === 'stream' && <StreamView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
          {view === 'workload' && <WorkloadView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
          {view === 'map' && <MapView tasks={tasks} projects={projects} onStatusChange={updateStatus} onDelete={deleteTask} onEdit={openEditTask} onOpenDetail={openTaskDetail} />}
        </>
      )}

      {/* Activity Toggle */}
      <div className="flex items-center justify-between">
        <button onClick={() => setShowActivity(!showActivity)} className="btn btn-ghost btn-sm">
          <Activity className="w-4 h-4" /> {showActivity ? 'Hide' : 'Show'} Recent Activity
        </button>
      </div>
      {showActivity && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
          <ActivityFeed />
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Create Task</h2>
            <div className="space-y-4">
              <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="glass-input" placeholder="Task title..." />
              <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="glass-input" rows={2} placeholder="Description (optional)" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newTask.project_id} onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })} className="glass-input">
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="glass-input">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} className="glass-input" />
                <input value={newTask.location} onChange={(e) => setNewTask({ ...newTask, location: e.target.value })} className="glass-input" placeholder="Location (optional)" />
                <select value={newTask.assigned_to} onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })} className="glass-input col-span-2">
                  <option value="">Unassigned</option>
                  {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username || user.email}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleCreate} className="btn btn-primary flex-1" disabled={createLoading}>{createLoading ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Edit Task</h2>
            <div className="space-y-4">
              <input value={editTaskForm.title} onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })} className="glass-input" placeholder="Task title..." />
              <textarea value={editTaskForm.description} onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })} className="glass-input" rows={2} placeholder="Description (optional)" />
              <div className="grid grid-cols-2 gap-3">
                <select 
                  value={editTaskForm.project_id} 
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, project_id: e.target.value })} 
                  className="glass-input"
                  disabled={currentUser?.role !== 'admin'}
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={editTaskForm.priority} onChange={(e) => setEditTaskForm({ ...editTaskForm, priority: e.target.value })} className="glass-input">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" value={editTaskForm.due_date} onChange={(e) => setEditTaskForm({ ...editTaskForm, due_date: e.target.value })} className="glass-input" />
                <input value={editTaskForm.location} onChange={(e) => setEditTaskForm({ ...editTaskForm, location: e.target.value })} className="glass-input" placeholder="Location (optional)" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEdit(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={saveTaskEdit} className="btn btn-primary flex-1" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {taskDetailOpen && selectedTask && (
        <TaskDetail task={selectedTask} onClose={closeTaskDetail} onTaskUpdate={refreshCurrentPage} />
      )}
    </div>
  )
}
