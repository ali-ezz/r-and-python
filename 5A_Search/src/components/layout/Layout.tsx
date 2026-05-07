/**
 * @fileoverview Application layout — sidebar + topbar + main content area.
 * Displays navigation with role-based visibility and user profile section.
 */

import { useEffect, useState } from 'react';
import { useAuthStore, useIsAdmin, useIsInstructor } from '../../store/authStore';
import { getSavedTheme, onThemeChange, toggleTheme, type ThemeMode } from '../../utils/theme';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'web-search' | 'monitoring' | 'users' | 'notes' | 'todo' | 'calendar' | 'audit-logs' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  route: Route;
  navigate: (r: Route) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: '◈' },
  { id: 'users', label: 'Users', icon: '⚇', requiresAdmin: true },
  { id: 'students', label: 'Students', icon: '◉', requiresStaff: true },
  { id: 'courses', label: 'Courses', icon: '◫' },
  { id: 'search', label: 'Students Search', icon: '◎' },
  { id: 'web-search', label: 'Web Search', icon: '⊕' },
  { id: 'notes', label: 'Notes', icon: '◧', section: 'tools' },
  { id: 'todo', label: 'Tasks', icon: '☐', section: 'tools' },
  { id: 'calendar', label: 'Calendar', icon: '▦', section: 'tools' },
  { id: 'monitoring', label: 'Monitoring', icon: '◉', section: 'admin', requiresAdmin: true },
  { id: 'audit-logs', label: 'Audit Trail', icon: '◈', section: 'admin', requiresAdmin: true },
  { id: 'settings', label: 'Settings', icon: '⚙', section: 'admin', requiresAdmin: true },
];

export default function Layout({ children, route, navigate }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const isAdmin = useIsAdmin();
  const isStaff = useIsInstructor();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getSavedTheme());

  useEffect(() => onThemeChange(setTheme), []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const handleThemeToggle = () => {
    setTheme(toggleTheme());
  };

  const activeRoute = route === 'student-detail' ? 'students' : route;

  const visibleNav = navItems.filter((item) => {
    if ('requiresAdmin' in item && item.requiresAdmin && !isAdmin) return false;
    if ('requiresStaff' in item && item.requiresStaff && !isStaff) return false;
    return true;
  });

  const mainNav = visibleNav.filter((item) => !item.section);
  const toolsNav = visibleNav.filter((item) => item.section === 'tools');
  const adminNav = visibleNav.filter((item) => item.section === 'admin');

  const emailName = user?.email?.split('@')[0]?.split('.').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
  const profileName = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ');
  const displayName = user?.fullName || profileName || emailName || 'System User';

  const userInitials = (user?.fullName || user?.email || 'SU')
    .split(' ')
    .map((w: string) => w.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-[#E5E5E5] flex flex-col z-30 transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-6 border-b border-[#E5E5E5] ${!sidebarOpen && 'justify-center'}`}>
          <div className="w-8 h-8 bg-black flex items-center justify-center text-white text-xs font-bold tracking-widest flex-shrink-0">
            S
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-sm font-semibold tracking-widest uppercase">SMS</div>
              <div className="text-[10px] text-[#999] tracking-[0.1em] uppercase">Management</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
          {/* Main Navigation */}
          {mainNav.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id as Route)}
              className={`nav-item w-full text-left ${activeRoute === item.id ? 'active' : ''} ${
                !sidebarOpen ? 'justify-center px-0' : ''
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}

          {/* Tools Section */}
          {toolsNav.length > 0 && (
            <>
              <div className={`my-3 mx-4 border-t border-[#F0F0F0] ${!sidebarOpen && 'mx-2'}`} />
              {sidebarOpen && (
                <div className="px-4 mb-2 text-[9px] font-medium tracking-[0.12em] uppercase text-[#BBB]">
                  Tools
                </div>
              )}
              {toolsNav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as Route)}
                  className={`nav-item w-full text-left ${activeRoute === item.id ? 'active' : ''} ${
                    !sidebarOpen ? 'justify-center px-0' : ''
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span className="text-base">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              ))}
            </>
          )}

          {/* Admin Section */}
          {adminNav.length > 0 && (
            <>
              <div className={`my-3 mx-4 border-t border-[#F0F0F0] ${!sidebarOpen && 'mx-2'}`} />
              {sidebarOpen && (
                <div className="px-4 mb-2 text-[9px] font-medium tracking-[0.12em] uppercase text-[#BBB]">
                  Administration
                </div>
              )}
              {adminNav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as Route)}
                  className={`nav-item w-full text-left ${activeRoute === item.id ? 'active' : ''} ${
                    !sidebarOpen ? 'justify-center px-0' : ''
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span className="text-base">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className={`border-t border-[#E5E5E5] p-4 ${!sidebarOpen && 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-black text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#1A1A1A] truncate">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-[#999] truncate">{user?.email}</div>
                </div>
              </div>
              <span className={`badge ${
                user?.role === 'ADMIN' ? 'badge-admin' :
                user?.role === 'INSTRUCTOR' ? 'badge-instructor' : 'badge-student'
              }`}>{user?.role}</span>
              <button
                onClick={handleThemeToggle}
                className="btn-ghost w-full mt-3 text-left text-xs justify-start px-0 text-[#999] hover:text-black"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                ◐ Toggle Theme
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-ghost w-full mt-1 text-left text-xs justify-start px-0"
              >
                {loggingOut ? 'Signing out...' : '→ Sign out'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button onClick={() => setSidebarOpen(true)} className="text-[#999] hover:text-black text-xs">
                ◈
              </button>
              <button
                onClick={handleThemeToggle}
                className="text-[#999] hover:text-black text-xs"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                ◐
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 -right-3 w-6 h-6 bg-white border border-[#E5E5E5] flex items-center justify-center text-[#999] hover:text-black text-xs"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '←' : '→'}
        </button>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'ml-60' : 'ml-16'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 glass-header border-b border-[#E5E5E5] px-8 h-14 flex items-center justify-between">
          <div className="text-xs tracking-[0.1em] uppercase text-[#999]">
            {navItems.find((n) => n.id === activeRoute)?.label ?? 'Dashboard'}
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('search')}
              className="search-input w-56 text-[#999] text-xs cursor-pointer rounded-full bg-[#F5F5F5] border-transparent"
            >
              <span>◎</span>
              <span>Search anywhere...</span>
            </button>
            <div className="notification-bell text-[#666] text-lg">
              ⚲
            </div>
            {isAdmin && <button className="btn-primary text-[10px] py-1.5 px-3 rounded-full" onClick={() => navigate('students')}>+ Quick Add</button>}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-8 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
