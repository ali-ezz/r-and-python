/**
 * @fileoverview Settings page — user profile management, password info, and app config.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getSavedTheme, onThemeChange, toggleTheme } from '../utils/theme';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring' | 'users' | 'audit-logs' | 'settings';

export default function SettingsPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const { user } = useAuthStore();
  const [darkMode, setDarkMode] = useState(() => getSavedTheme() === 'dark');

  useEffect(() => onThemeChange((theme) => setDarkMode(theme === 'dark')), []);

  const toggleDark = () => {
    setDarkMode(toggleTheme() === 'dark');
  };

  return (
    <div className="max-w-3xl fade-in pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-[#666] text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Card */}
      <div className="card mb-6 slide-up">
        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">Your Profile</div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-xl font-semibold">
            {(user?.fullName || user?.email || 'U').split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2)}
          </div>
          <div>
            <div className="text-lg font-semibold">{user?.fullName || 'User'}</div>
            <div className="text-sm text-[#666]">{user?.email}</div>
            <span className={`badge mt-1 ${
              user?.role === 'ADMIN' ? 'badge-admin' :
              user?.role === 'INSTRUCTOR' ? 'badge-instructor' : 'badge-student'
            }`}>{user?.role}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
          <div>
            <div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">User ID</div>
            <div className="text-xs font-mono mt-1">{user?.id?.split('-')[0] || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">Status</div>
            <div className="text-xs mt-1">{user?.isActive ? '✓ Active' : '✕ Disabled'}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">Role</div>
            <div className="text-xs mt-1">{user?.role}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">Session</div>
            <div className="text-xs mt-1">JWT Bearer Token</div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card mb-6 slide-up">
        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">Appearance</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Dark Mode</div>
            <div className="text-xs text-[#666]">Switch between light and dark themes</div>
          </div>
          <button
            onClick={toggleDark}
            className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-[#1A1A1A]' : 'bg-[#E5E5E5]'}`}
          >
            <div className={`theme-toggle-thumb absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* System Info */}
      <div className="card slide-up">
        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">System Information</div>
        <div className="space-y-3">
          {[
            ['Backend', 'FastAPI 0.100+ (Python 3.11)'],
            ['Frontend', 'React 18 + Vite + TypeScript'],
            ['Database', 'PostgreSQL 16 + SQLAlchemy (async)'],
            ['Cache', 'Redis 7 (Cache-Aside Pattern)'],
            ['Auth', 'JWT (HS256) + bcrypt password hashing'],
            ['Monitoring', 'Prometheus + Grafana + Loguru'],
            ['Version', '2.0.0'],
          ].map(([key, value]) => (
            <div key={key} className="flex justify-between items-center py-2 border-b border-[#F5F5F5] last:border-0">
              <span className="text-xs text-[#999]">{key}</span>
              <span className="text-xs font-medium text-[#1A1A1A]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
