/**
 * @fileoverview Dashboard page — overview stats, GPA chart, activity feed.
 */

import { useEffect, useState } from 'react';
import { studentsApi } from '../lib/api';
import { useIsInstructor } from '../store/authStore';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring';

interface DashboardStats {
  students: Record<string, number>;
  totalCourses: number;
  totalEnrollments: number;
  avgGpaByDepartment: { department: string; avgGpa: number }[];
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className={`card slide-up ${accent ? 'bg-black text-white border-black' : ''}`}>
      <div className={`text-[10px] font-medium tracking-[0.1em] uppercase mb-3 ${accent ? 'text-[#666]' : 'text-[#999]'}`}>
        {label}
      </div>
      <div className={`text-3xl font-semibold tracking-tight ${accent ? 'text-white' : 'text-[#1A1A1A]'}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-xs mt-2 ${accent ? 'text-[#666]' : 'text-[#999]'}`}>{sub}</div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton h-3 w-20 mb-4" />
      <div className="skeleton h-8 w-16 mb-2" />
      <div className="skeleton h-3 w-24" />
    </div>
  );
}

export default function DashboardPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const isStaff = useIsInstructor();

  useEffect(() => {
    if (!isStaff) { setLoading(false); return; }
    studentsApi.dashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isStaff]);

  const totalStudents = stats
    ? Object.values(stats.students).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-[#666] text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Students"
              value={totalStudents}
              sub={`${stats?.students?.ACTIVE ?? 0} active`}
              accent
            />
            <StatCard
              label="Graduated"
              value={stats?.students?.GRADUATED ?? '—'}
              sub="All time"
            />
            <StatCard
              label="Courses"
              value={stats?.totalCourses ?? '—'}
              sub="Available"
            />
            <StatCard
              label="Enrollments"
              value={stats?.totalEnrollments ?? '—'}
              sub="Total records"
            />
          </>
        )}
      </div>

      {/* Status Breakdown + GPA by Dept */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        {/* Student Status */}
        <div className="card">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">
            Students by Status
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-2 w-2 rounded-full" />
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-3 w-8" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'ACTIVE', label: 'Active', color: '#2D6A4F', bg: '#D8F3DC' },
                { key: 'GRADUATED', label: 'Graduated', color: '#1E3A5F', bg: '#DBEAFE' },
                { key: 'INACTIVE', label: 'Inactive', color: '#666', bg: '#F3F4F6' },
                { key: 'SUSPENDED', label: 'Suspended', color: '#9B1C1C', bg: '#FEE2E2' },
                { key: 'WITHDRAWN', label: 'Withdrawn', color: '#B5451B', bg: '#FDEBD0' },
              ].map(({ key, label, color, bg }) => {
                const count = stats?.students?.[key] ?? 0;
                const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#1A1A1A]">{label}</span>
                        <span className="text-[#999]">{count}</span>
                      </div>
                      <div className="h-1 bg-[#F5F5F5]">
                        <div
                          className="h-1 transition-all duration-700"
                          style={{ width: `${pct}%`, background: bg, border: `1px solid ${color}20` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-[#999] w-8 text-right">{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GPA by Department */}
        <div className="card">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">
            Avg GPA by Department
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton h-3 w-10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(stats?.avgGpaByDepartment ?? []).slice(0, 6).map(({ department, avgGpa }) => (
                <div key={department} className="flex items-center gap-3">
                  <div className="flex-1 text-sm text-[#1A1A1A] truncate">{department}</div>
                  <div className="w-20 h-1 bg-[#F5F5F5]">
                    <div
                      className="h-1 bg-black transition-all duration-700"
                      style={{ width: `${(avgGpa / 4.0) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-[#1A1A1A] w-10 text-right">
                    {avgGpa.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary text-xs py-3 px-6" onClick={() => navigate('students')}>
            View All Students
          </button>
          <button className="btn-secondary text-xs py-3 px-6" onClick={() => navigate('search')}>
            Search Students
          </button>
          <button className="btn-secondary text-xs py-3 px-6" onClick={() => navigate('courses')}>
            Manage Courses
          </button>
        </div>
      </div>
    </div>
  );
}
