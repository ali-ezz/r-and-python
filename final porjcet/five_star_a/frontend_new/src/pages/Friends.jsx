import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import { Users, UserPlus, Clock, X, Check, UserMinus, UserX } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

export default function Friends() {
  const { addToast } = useAppStore()
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [friendCount, setFriendCount] = useState(0)

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api.get('/friends')
      setFriends(Array.isArray(data) ? data : [])
    } catch (e) { setFriends([]) }
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      const data = await api.get('/friends/pending')
      setRequests(Array.isArray(data) ? data : [])
    } catch (e) { setRequests([]) }
  }, [])

  const fetchCount = useCallback(async () => {
    try {
      const data = await api.get('/friends/count')
      setFriendCount(data?.count || 0)
    } catch (e) { /* optional */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchFriends(), fetchRequests(), fetchCount()]).finally(() => setLoading(false))
  }, [fetchFriends, fetchRequests, fetchCount])

  const sendRequest = async () => {
    if (!username.trim()) {
      addToast({ type: 'warning', message: 'Enter a username or email' })
      return
    }
    setActionLoading('send')
    try {
      await api.post('/friends/request', { email_or_username: username })
      setUsername('')
      fetchRequests()
      addToast({ type: 'success', message: 'Friend request sent!' })
    } catch (e) {
      addToast({ type: 'error', message: e.message || 'Failed to send request' })
    } finally { setActionLoading(null) }
  }

  const acceptRequest = async (id) => {
    setActionLoading(`accept-${id}`)
    try {
      await api.post(`/friends/${id}/accept`)
      fetchFriends()
      fetchRequests()
      fetchCount()
      addToast({ type: 'success', message: 'Friend added!' })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to accept request' })
    } finally { setActionLoading(null) }
  }

  const declineRequest = async (id) => {
    setActionLoading(`decline-${id}`)
    try {
      await api.post(`/friends/${id}/decline`)
      fetchRequests()
      addToast({ type: 'success', message: 'Request declined' })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to decline request' })
    } finally { setActionLoading(null) }
  }

  const removeFriend = async (id) => {
    setActionLoading(`remove-${id}`)
    try {
      await api.delete(`/friends/${id}`)
      fetchFriends()
      fetchCount()
      addToast({ type: 'success', message: 'Friend removed' })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to remove friend' })
    } finally { setActionLoading(null) }
  }

  const blockFriend = async (id) => {
    setActionLoading(`block-${id}`)
    try {
      await api.post(`/friends/${id}/block`)
      fetchFriends()
      fetchCount()
      addToast({ type: 'success', message: 'Friend blocked' })
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to block friend' })
    } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Friends</h1>
        <p style={{ color: 'var(--text-muted)' }}>{friendCount || friends.length} friends</p>
      </div>

      {/* Add Friend */}
      <div className="glass-card p-4">
        <div className="flex gap-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendRequest()} className="glass-input flex-1" placeholder="Username or email..." />
          <button onClick={sendRequest} disabled={actionLoading === 'send'} className="btn btn-primary disabled:opacity-50">
            {actionLoading === 'send' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" /> Add</>}
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Clock className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /> Pending Requests ({requests.length})</h2>
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(194,176,150,0.05)' }}>
                <div className="flex items-center gap-3">
                  <div className="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-gradient)', color: 'var(--bg-deepest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{(req.user_username || 'U')[0]}</div>
                  <div><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{req.user_username || 'Unknown'}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{req.user_email}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => acceptRequest(req.id)} disabled={actionLoading === `accept-${req.id}`} className="p-2 rounded-lg transition-colors hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50" style={{ color: 'var(--success)' }}><Check className="w-4 h-4" /></button>
                  <button onClick={() => declineRequest(req.id)} disabled={actionLoading === `decline-${req.id}`} className="p-2 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50" style={{ color: 'var(--error)' }}><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Users className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /> Friends ({friends.length})</h2>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
        ) : friends.length === 0 ? (
          <div className="empty-state py-8"><Users className="w-12 h-12" /><h3 className="mt-2" style={{ color: 'var(--text-primary)' }}>No friends yet</h3></div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ background: 'rgba(194,176,150,0.05)' }}>
                <div className="flex items-center gap-3">
                  <div className="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-gradient)', color: 'var(--bg-deepest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{(friend.friend_username || 'U')[0]}</div>
                  <div><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{friend.friend_username || 'Unknown'}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{friend.friend_email || ''}</p></div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => blockFriend(friend.id)} disabled={actionLoading === `block-${friend.id}`} className="p-2 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50" style={{ color: 'var(--text-muted)' }} title="Block"><UserX className="w-4 h-4" /></button>
                  <button onClick={() => removeFriend(friend.id)} disabled={actionLoading === `remove-${friend.id}`} className="p-2 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50" style={{ color: 'var(--text-muted)' }} title="Remove"><UserMinus className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
