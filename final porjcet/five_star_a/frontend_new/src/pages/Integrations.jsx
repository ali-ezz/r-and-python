import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { Plug, Music, Trash2, ExternalLink, Plus, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

export default function Integrations() {
  const [integrations, setIntegrations] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)
  const [recentTracks, setRecentTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const { addToast } = useAppStore()

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await api.get('/integrations')
      setIntegrations(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e?.response?.status !== 429) setIntegrations([])
    }
  }, [])

  const fetchNowPlaying = useCallback(async () => {
    try {
      const data = await api.get('/integrations/spotify/now-playing')
      if (data && data.title && data.title !== 'Unknown') {
        setNowPlaying(data)
      } else {
        setNowPlaying(null)
      }
    } catch (e) {
      setNowPlaying(null)
    }
  }, [])

  const fetchRecentTracks = useCallback(async () => {
    try {
      const data = await api.get('/integrations/spotify/recent?limit=10')
      const tracks = data?.tracks || (Array.isArray(data) ? data : [])
      setRecentTracks(tracks)
    } catch (e) { }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        await Promise.all([fetchIntegrations(), fetchNowPlaying(), fetchRecentTracks()])
      } catch (e) { }
      finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [fetchIntegrations, fetchNowPlaying, fetchRecentTracks])

  const handleConnect = async (provider) => {
    setConnecting(true)
    try {
      await api.post('/integrations/connect', { provider, settings: {} })
      addToast({ type: 'success', message: `${provider} connected!` })
      fetchIntegrations()
      fetchNowPlaying()
    } catch (e) {
      addToast({ type: 'error', message: e.message || `Failed to connect ${provider}` })
    } finally { setConnecting(false) }
  }

  const handleDisconnect = async (provider) => {
    if (!confirm(`Disconnect ${provider}?`)) return
    try {
      await api.delete(`/integrations/${provider}`)
      addToast({ type: 'success', message: `${provider} disconnected` })
      fetchIntegrations()
      setNowPlaying(null)
      setRecentTracks([])
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to disconnect' })
    }
  }

  const isSpotifyConnected = integrations.some(i => i.provider === 'spotify' && i.is_active)

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-48 skeleton rounded-xl" />)}</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Integrations</h1>
        <p style={{ color: 'var(--text-muted)' }}>Connect your favorite services</p>
      </div>

      {/* Available Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spotify */}
        <div className="glass-card p-6 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#1DB954' }}>
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Spotify</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Listen to music while you work</p>
              </div>
            </div>
            {isSpotifyConnected ? (
              <button onClick={() => handleDisconnect('spotify')} className="btn btn-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--error)' }}>
                <Trash2 className="w-3 h-3" /> Disconnect
              </button>
            ) : (
              <button onClick={() => handleConnect('spotify')} className="btn btn-sm btn-primary" disabled={connecting}>
                {connecting ? 'Connecting...' : <><Plus className="w-3 h-3" /> Connect</>}
              </button>
            )}
          </div>
          {isSpotifyConnected && (
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              {nowPlaying ? (
                <div className="flex items-center gap-3">
                  {nowPlaying.album_art && <img src={nowPlaying.album_art} alt="" className="w-12 h-12 rounded-lg" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{nowPlaying.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{nowPlaying.artist}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#1DB954', color: 'white' }}>Playing</span>
                </div>
              ) : (
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>Nothing playing right now</p>
              )}
            </div>
          )}
        </div>

        {/* Placeholder for future integrations */}
        <div className="glass-card p-6 opacity-60">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <AlertCircle className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-muted)' }}>More Coming Soon</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>We're adding more integrations</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>Google Calendar, Slack, GitHub and more...</p>
        </div>
      </div>

      {/* Recent Tracks */}
      {isSpotifyConnected && recentTracks.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Music className="w-5 h-5" /> Recently Played
          </h2>
          <div className="space-y-2">
            {recentTracks.map((track, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5">
                {track.album_art && <img src={track.album_art} alt="" className="w-10 h-10 rounded-lg flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{track.title || track.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{track.artist || track.artists}</p>
                </div>
                {track.playing_at && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(track.playing_at).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
