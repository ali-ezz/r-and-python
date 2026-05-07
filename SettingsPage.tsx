/**
 * @fileoverview Audit Log viewer — admin-only page showing all system
 * activity with filtering, pagination, and detailed change diffs.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring' | 'users' | 'audit-logs';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  CREATE: { bg: '#D8F3DC', text: '#2D6A4F', icon: '+' },
  UPDATE: { bg: '#DBEAFE', text: '#1E3A5F', icon: '~' },
  DELETE: { bg: '#FEE2E2', text: '#9B1C1C', icon: '×' },
};

export default function AuditLogsPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { skip: page * limit, limit };
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entity_type = filterEntity;
      const res = await adminApi.auditLogs(params);
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const renderDiff = (prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined) => {
    if (!prev && !next) return <span className="text-[#999] text-xs">No data recorded</span>;
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    return (
      <div className="font-mono text-xs space-y-1 mt-2 p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
        {Array.from(allKeys).map(key => {
          const oldVal = prev?.[key];
          const newVal = next?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          return (
            <div key={key} className={changed ? 'text-[#1A1A1A]' : 'text-[#999]'}>
              <span className="text-[#999]">{key}:</span>{' '}
              {prev && oldVal !== undefined && (
                <span className="line-through text-[#9B1C1C] mr-2">{JSON.stringify(oldVal)}</span>
              )}
              {next && newVal !== undefined && (
                <span className="text-[#2D6A4F]">{JSON.stringify(newVal)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl fade-in pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-[#666] text-sm mt-1">{total} recorded events · System activity log</p>
        </div>
        <button className="btn-secondary text-xs" onClick={fetchLogs}>↻ Refresh</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-[#E5E5E5]">
        <div className="form-group min-w-[140px]">
          <label className="form-label">Action</label>
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }} className="text-sm py-2">
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>
        <div className="form-group min-w-[140px]">
          <label className="form-label">Entity Type</label>
          <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }} className="text-sm py-2">
            <option value="">All Types</option>
            <option value="Student">Student</option>
            <option value="User">User</option>
          </select>
        </div>
        {(filterAction || filterEntity) && (
          <button className="btn-ghost self-end mb-1 text-xs" onClick={() => { setFilterAction(''); setFilterEntity(''); setPage(0); }}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[#FEE2E2] text-[#9B1C1C] border border-[#9B1C1C] text-sm">{error}</div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card flex gap-4 items-start">
              <div className="skeleton w-10 h-10 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-48" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-3 w-16" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-3xl mb-3"></div>
            <div className="text-[#999] text-sm">No audit entries found</div>
          </div>
        ) : logs.map(log => {
          const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
          const isExpanded = expandedId === log.id;

          return (
            <div
              key={log.id}
              className="card cursor-pointer hover:shadow-sm transition-shadow slide-up"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: style.bg, color: style.text }}
                >
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] px-2 py-0.5 font-bold tracking-wider uppercase"
                      style={{ background: style.bg, color: style.text }}
                    >
                      {log.action}
                    </span>
                    <span className="text-sm font-medium text-[#1A1A1A]">{log.entityType}</span>
                    <span className="text-[11px] text-[#999] font-mono">{log.entityId.split('-')[0]}</span>
                  </div>
                  <div className="text-xs text-[#666] mt-1">
                    by {log.actorName || log.actorEmail || 'System'}
                    {log.actorEmail && log.actorName && (
                      <span className="text-[#999]"> ({log.actorEmail})</span>
                    )}
                  </div>
                  {isExpanded && renderDiff(log.previousState, log.newState)}
                </div>
                <div className="text-xs text-[#999] flex-shrink-0 text-right">
                  <div>{formatTime(log.createdAt)}</div>
                  <div className="text-[10px] mt-1">{isExpanded ? '▲ collapse' : '▼ expand'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <div className="text-xs text-[#999]">
            Page {page + 1} of {totalPages} · {total} total entries
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-4" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>
              ← Prev
            </button>
            <button className="btn-secondary text-xs py-2 px-4" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
