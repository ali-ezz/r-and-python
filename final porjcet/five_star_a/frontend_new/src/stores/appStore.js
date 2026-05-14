import { create } from 'zustand'
import { api } from '../services/api'

export const useAppStore = create((set, get) => ({
  // Tasks
  tasks: [],
  totalTasks: 0,
  tasksLoading: false,
  taskFilters: { status: null, priority: null, project_id: null, search: '', due_date: null, assigned_to: null },
  selectedTasks: [],
  bulkMode: false,

  // Projects
  projects: [],
  projectsLoading: false,

  // Users
  assignableUsers: [],
  assignableUsersLoading: false,

  // Dashboard
  dashboardData: null,

  // Activity
  activity: [],
  activityLoading: false,

  // Toast
  toasts: [],

  addToast: (toast) => {
    const id = Date.now()
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Active page
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Quick Add
  quickAddOpen: false,
  toggleQuickAdd: () => set((state) => ({ quickAddOpen: !state.quickAddOpen })),

  // Task detail modal
  selectedTask: null,
  taskDetailOpen: false,
  openTaskDetail: (task) => set({ selectedTask: task, taskDetailOpen: true }),
  closeTaskDetail: () => set({ selectedTask: null, taskDetailOpen: false }),

  // Filter setters
  setTaskFilters: (filters) => set((state) => ({
    taskFilters: { ...state.taskFilters, ...filters }
  })),
  clearTaskFilters: () => set({ taskFilters: { status: null, priority: null, project_id: null, search: '', due_date: null, assigned_to: null } }),

  // Fetch tasks
  fetchTasks: async (filters = {}) => {
    set({ tasksLoading: true })
    try {
      const params = new URLSearchParams({
        skip: filters.skip || 0,
        limit: filters.limit || 50,
        ...(filters.status && { status: filters.status }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.project_id && { project_id: filters.project_id }),
        ...(filters.search && { q: filters.search }),
        ...(filters.due_date && { due_date: filters.due_date }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to }),
      })
      const data = await api.get(`/tasks?${params}`)
      const taskList = data.tasks || data || []
      set({ tasks: taskList, totalTasks: data.total || taskList.length })
    } catch (error) {
      if (error?.response?.status !== 429 && !error.networkError) {
        console.error('Failed to fetch tasks:', error)
        set({ tasks: [], totalTasks: 0 })
      }
    } finally {
      set({ tasksLoading: false })
    }
  },

  // Fetch projects
  fetchProjects: async () => {
    set({ projectsLoading: true })
    try {
      const data = await api.get('/projects')
      set({ projects: data.projects || data || [] })
    } catch (error) {
      if (error?.response?.status !== 429 && !error.networkError) {
        console.error('Failed to fetch projects:', error)
        set({ projects: [] })
      }
    } finally {
      set({ projectsLoading: false })
    }
  },

  fetchAssignableUsers: async () => {
    set({ assignableUsersLoading: true })
    try {
      // Try admin endpoint first, fall back to search for non-admins
      let data
      try {
        data = await api.get(`/users?page=1&page_size=100`)
      } catch (adminErr) {
        // Non-admin users: use search endpoint (accessible to all authenticated users)
        data = await api.get(`/users/search?q=&page=1&page_size=100`)
      }
      set({ assignableUsers: data.users || [] })
    } catch (error) {
      if (error?.response?.status !== 429 && !error.networkError) {
        // Silently fail - non-critical feature
        set({ assignableUsers: [] })
      }
    } finally {
      set({ assignableUsersLoading: false })
    }
  },

  // Fetch dashboard
  fetchDashboard: async () => {
    try {
      const data = await api.get('/views/dashboard/summary')
      set({ dashboardData: data })
    } catch (error) {
      if (error?.response?.status !== 429 && !error.networkError) {
        console.error('Failed to fetch dashboard:', error)
      }
    }
  },

  // Fetch activity
  fetchActivity: async () => {
    set({ activityLoading: true })
    try {
      const data = await api.get('/notifications?skip=0&limit=20')
      const list = data.notifications || data || []
      set({ activity: Array.isArray(list) ? list : [] })
    } catch (error) {
      if (error?.response?.status !== 429 && !error.networkError) {
        console.error('Failed to fetch activity:', error)
      }
    } finally {
      set({ activityLoading: false })
    }
  },

  // Bulk operations
  setBulkMode: (mode) => set({ bulkMode: mode, selectedTasks: [] }),
  toggleTaskSelection: (taskId) => {
    set((state) => {
      const selected = state.selectedTasks.includes(taskId)
        ? state.selectedTasks.filter(id => id !== taskId)
        : [...state.selectedTasks, taskId]
      return { selectedTasks: selected }
    })
  },
  selectAllTasks: () => set((state) => ({ selectedTasks: state.tasks.map(t => t.id) })),
  clearSelection: () => set({ selectedTasks: [] }),

  bulkUpdateStatus: async (status) => {
    const { selectedTasks } = get()
    if (selectedTasks.length === 0) return
    try {
      await api.patch('/tasks/bulk/status', { task_ids: selectedTasks, status })
      get().fetchTasks({ limit: 50 })
      set({ selectedTasks: [], bulkMode: false })
      get().addToast({ type: 'success', message: `${selectedTasks.length} tasks updated` })
    } catch (e) {
      if (e?.response?.status !== 429) {
        get().addToast({ type: 'error', message: 'Bulk update failed' })
      }
    }
  },

  bulkDeleteTasks: async () => {
    const { selectedTasks } = get()
    if (selectedTasks.length === 0) return
    try {
      await api.delete('/tasks/bulk/delete', { task_ids: selectedTasks })
      get().fetchTasks({ limit: 50 })
      set({ selectedTasks: [], bulkMode: false })
      get().addToast({ type: 'success', message: `${selectedTasks.length} tasks deleted` })
    } catch (e) {
      if (e?.response?.status !== 429) {
        get().addToast({ type: 'error', message: 'Bulk delete failed' })
      }
    }
  },

  bulkUpdatePriority: async (priority) => {
    const { selectedTasks } = get()
    if (selectedTasks.length === 0) return
    try {
      await api.patch('/tasks/bulk/priority', { task_ids: selectedTasks, priority })
      get().fetchTasks({ limit: 50 })
      set({ selectedTasks: [], bulkMode: false })
      get().addToast({ type: 'success', message: `${selectedTasks.length} tasks updated` })
    } catch (e) {
      if (e?.response?.status !== 429) {
        get().addToast({ type: 'error', message: 'Bulk update failed' })
      }
    }
  },
}))
