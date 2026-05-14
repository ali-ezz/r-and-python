import { API_BASE } from '../services/config'

/** Absolute URL for API-hosted paths (/static/..., /uploads/...) or pass-through for http(s). */
export function resolveMediaUrl(path) {
  if (!path || typeof path !== 'string') return ''
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const origin = API_BASE.replace(/\/api\/?$/, '')
  const suffix = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${origin}${suffix}`
}
