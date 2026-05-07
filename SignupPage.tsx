/**
 * @fileoverview System Monitoring page — live health status, real system stats
 * from the API, Redis/DB health, and live audit feed.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring' | 'users' | 'audit-logs';

interface SystemStats {
  users: {
    total: number;
    byRole: Record<string, number>;
    active: number;
    inactive: number;
  };
  students: {
    total: number;
    avgGpa: number;
    byDepartment: { department: string; count: number; avgGpa: number }[];
  };
  activity: { last24h: number };
  services: { database: string; redis: string };
}

interface HealthData {
  status: string;
  services: { database: string; redis: string };
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: string;
}

function MetricDial({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center py-8">
      <div className="relative w-28 h-28 mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#F5F5F5" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${value * 2.51} 251`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold text-[#1A1A1A]">{value}{suffix || '%'}</span>
        </div>
      </div>
      <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999]">{label}</div>
    </div>
  );
}

function ServiceBadge({ name, status }: { name: string; status: string }) {
  const isUp = status === 'up';
  return (
    <div className="flex items-center gap-3 p-4 border border-[#E5E5E5]">
      <div className={`w-3 h-3 rounded-full ${isUp ? 'bg-[#2D6A4F] shadow-[0_0_8px_#2D6A4F]' : 'bg-[#9B1C1C] shadow-[0_0_8px_#9B1C1C]'} ${isUp ? '' : 'animate-pulse'}`} />
      <div className="flex-1">
        <div className="text-sm font-medium text-[#1A1A1A]">{name}</div>
        <div className={`text-xs ${isUp ? 'text-[#2D6A4F]' : 'text-[#9B1C1C]'}`}>
          {isUp ? 'Operational' : 'Down'}
        </div>
      </div>
      <span className={`text-[10px] px-2 py-0.5 font-semibold tracking-wider uppercase ${isUp ? 'bg-[#D8F3DC] text-[#2D6A4F]' : 'bg-[#FEE2E2] text-[#9B1C1C]'}`}>
        {status.toUpperCase()}
      </span>
    </div>
  );
}

export default function MonitoringPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes, logsRes] = await Promise.allSettled([
        adminApi.systemStats(),
        adminApi.health(),
        adminApi.auditLogs({ skip: 0, limit: 10 }),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (logsRes.status === 'fulfilled') setRecentLogs(logsRes.value.data || []);
      setLastRefresh(new Date());
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const overallStatus = health?.status || 'unknown';
  const statusColor = overallStatus === 'healthy' ? '#2D6A4F' : overallStatus === 'degraded' ? '#B5451B' : '#9B1C1C';

  const ACTION_BADGE: Record<string, { bg: string; text: string }> = {
    CREATE: { bg: '#D8F3DC', text: '#2D6A4F' },
    UPDATE: { bg: '#DBEAFE', text: '#1E3A5F' },
    DELETE: { bg: '#FEE2E2', text: '#9B1C1C' },
  };

  return (
    <div className="max-w-7xl fade-in pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">System Monitoring</h1>
          <p className="text-[#666] text-sm mt-1">
            Live health metrics · Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary text-xs" onClick={() => navigate('audit-logs')}>View Full Audit Log</button>
          <button className="btn-secondary text-xs" onClick={fetchAll}>↻ Refresh</button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className="card mb-8 flex items-center gap-4 slide-up" style={{ borderLeft: `4px solid ${statusColor}` }}>
        <div className={`w-4 h-4 rounded-full`} style={{ background: statusColor, boxShadow: `0 0 12px ${statusColor}` }} />
        <div>
          <div className="text-lg font-semibold text-[#1A1A1A] capitalize">{overallStatus}</div>
          <div className="text-xs text-[#666]">All systems {overallStatus === 'healthy' ? 'operational' : 'experiencing issues'}</div>
        </div>
      </div>

      {/* Service Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <ServiceBadge name="PostgreSQL Database" status={health?.services?.database || 'unknown'} />
        <ServiceBadge name="Redis Cache" status={health?.services?.redis || 'unknown'} />
        <ServiceBadge name="FastAPI Server" status="up" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card"><div className="skeleton h-3 w-20 mb-4" /><div className="skeleton h-8 w-16" /></div>
          ))
        ) : (
          <>
            <MetricDial label="Active Users" value={stats ? Math.round((stats.users.active / Math.max(stats.users.total, 1)) * 100) : 0} color="#2D6A4F" />
            <MetricDial label="Avg GPA" value={stats ? Math.round((stats.students.avgGpa / 4) * 100) : 0} color="#1E3A5F" suffix="" />
            <div className="card flex flex-col justify-center">
              <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">Total Users</div>
              <div className="text-4xl font-semibold text-[#1A1A1A] mb-1">{stats?.users.total ?? '—'}</div>
              <div className="space-y-1 mt-3">
                {stats && Object.entries(stats.users.byRole).map(([role, count]) => (
                  <div key={role} className="flex justify-between text-xs">
                    <span className="text-[#999]">{role}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card flex flex-col justify-center">
              <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">Activity (24h)</div>
              <div className="text-4xl font-semibold text-[#1A1A1A] mb-1">{stats?.activity.last24h ?? 0}</div>
              <div className="text-xs text-[#999] mt-2">Audit events recorded</div>
              <div className="mt-4 border-t border-[#F5F5F5] pt-4">
                <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-1">Avg GPA</div>
                <div className="text-sm font-semibold">{stats?.students.avgGpa?.toFixed(2) || '—'}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Department Breakdown + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Department Stats */}
        <div className="card">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">Students by Department</div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-3 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {(stats?.students.byDepartment || []).map(({ department, count, avgGpa }) => {
                const maxCount = Math.max(...(stats?.students.byDepartment || []).map(d => d.count), 1);
                return (
                  <div key={department} className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-[#1A1A1A] truncate">{department}</div>
                    <div className="w-24 h-1.5 bg-[#F5F5F5] overflow-hidden">
                      <div className="h-full bg-[#1A1A1A] transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <div className="text-xs font-medium text-[#1A1A1A] w-8 text-right">{count}</div>
                    <div className="text-xs text-[#999] w-12 text-right">{avgGpa.toFixed(2)}</div>
                  </div>
                );
              })}
              {(!stats?.students.byDepartment?.length) && <div className="text-sm text-[#999]">No data yet</div>}
            </div>
          )}
        </div>

        {/* Recent Audit Feed */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex justify-between items-center">
            <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#1A1A1A]">Live Audit Feed</div>
            <button className="text-[10px] text-[#666] hover:text-black" onClick={() => navigate('audit-logs')}>View all →</button>
          </div>
          <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4"><div className="skeleton w-12 h-5" /><div className="skeleton h-4 flex-1" /></div>
              ))
            ) : recentLogs.length === 0 ? (
              <div className="text-center py-8 text-[#999] text-sm">No recent activity</div>
            ) : recentLogs.map(log => {
              const badge = ACTION_BADGE[log.action] || ACTION_BADGE.UPDATE;
              const timeAgo = (() => {
                const diff = Date.now() - new Date(log.createdAt).getTime();
                const min = Math.floor(diff / 60000);
                if (min < 1) return 'Just now';
                if (min < 60) return `${min}m ago`;
                const hr = Math.floor(min / 60);
                if (hr < 24) return `${hr}h ago`;
                return `${Math.floor(hr / 24)}d ago`;
              })();

              return (
                <div key={log.id} className="flex gap-4 slide-up">
                  <div className="w-14 h-5 flex items-center justify-center text-[10px] font-bold" style={{ background: badge.bg, color: badge.text }}>
                    {log.action}
                  </div>
                  <div className="flex-1 text-sm text-[#1A1A1A]">
                    <span className="font-medium">{log.actorName || log.actorEmail || 'System'}</span>
                    <span className="text-[#666]"> {log.action.toLowerCase()}d a </span>
                    <span className="font-medium">{log.entityType}</span>
                  </div>
                  <div className="text-xs text-[#999] flex-shrink-0">{timeAgo}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
