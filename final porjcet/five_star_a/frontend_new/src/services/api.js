import { API_BASE } from './config'

function getToken() {
  try {
    const raw = localStorage.getItem('auth-storage')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state?.token || parsed.token || null
  } catch {
    return null
  }
}

async function request(method, path, body, headers = {}) {
  const token = getToken()
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }
  if (body && method !== 'GET') {
    if (body instanceof FormData) {
      delete opts.headers['Content-Type']
      opts.body = body
    } else {
      opts.body = JSON.stringify(body)
    }
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, opts)
  } catch (networkError) {
    const error = new Error('Cannot connect to server')
    error.networkError = true
    throw error
  }

  // Handle 429 - rate limit, don't redirect, just throw
  if (res.status === 429) {
    const error = new Error('Rate limit exceeded - please wait a moment')
    error.response = { status: 429, data: { detail: 'Rate limit exceeded' } }
    throw error
  }

  // Handle 401 - try to refresh token first, then redirect to login if refresh fails
  if (res.status === 401) {
    const pathname = window.location.pathname
    if (!pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/forgot-password')) {
      // Try to refresh the token before logging out
      try {
        const raw = localStorage.getItem('auth-storage')
        if (raw) {
          const parsed = JSON.parse(raw)
          const refreshToken = parsed.state?.refreshToken || parsed.refreshToken
          if (refreshToken) {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              // Update stored tokens and retry the original request
              const updatedState = { ...parsed.state, token: refreshData.access_token, refreshToken: refreshData.refresh_token }
              localStorage.setItem('auth-storage', JSON.stringify({ ...parsed, state: updatedState }))
              opts.headers.Authorization = `Bearer ${refreshData.access_token}`
              res = await fetch(`${API_BASE}${path}`, opts)
              // If the retry still fails, fall through to redirect
              if (res.status !== 401) {
                // Re-process the retry response below
              }
            }
          }
        }
      } catch (refreshError) {
        // Refresh failed, fall through to redirect
      }
      
      // If we still have a 401 after refresh attempt, clear auth and redirect
      if (res.status === 401) {
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }
    return null
  }

  // Handle 403 - Forbidden explicitly for better logging or Toast rendering upstream
  if (res.status === 403) {
    const err = await res.json().catch(() => ({ detail: 'Access denied' }))
    const error = new Error(err.detail || 'Access denied')
    error.response = { data: err, status: 403 }
    throw error
  }

  // For non-JSON responses (CSV, etc), return the response directly
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('text/csv')) {
    return res
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    let errorMessage = 'Request failed'
    if (Array.isArray(err.detail)) {
      errorMessage = err.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ')
    } else if (err.detail) {
      errorMessage = err.detail
    }
    const error = new Error(errorMessage)
    error.response = { data: err, status: res.status }
    throw error
  }

  // Handle empty or whitespace-only responses
  const text = await res.text()
  if (!text || !text.trim()) return null
  try {
    return JSON.parse(text)
  } catch (parseError) {
    const error = new Error('Invalid JSON response from server')
    error.networkError = true
    throw error
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, extraHeaders) => request('POST', path, body, extraHeaders),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body, extraHeaders) => request('DELETE', path, body, extraHeaders),
  getToken,
  getAuthHeaders: () => {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
}

export default api
