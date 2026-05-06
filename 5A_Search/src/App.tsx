/**
 * @fileoverview Main application router.
 * Handles authentication guarding and client-side routing via hash/state.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import CoursesPage from './pages/CoursesPage';
import SearchPage from './pages/SearchPage';
import WebSearchPage from './pages/WebSearchPage';
import MonitoringPage from './pages/MonitoringPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import NotesPage from './pages/NotesPage';
import TodoPage from './pages/TodoPage';
import CalendarPage from './pages/CalendarPage';
import Layout from './components/layout/Layout';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'web-search' | 'monitoring' | 'users' | 'notes' | 'todo' | 'calendar' | 'audit-logs' | 'settings';

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#/', '');
  if (hash.startsWith('students/')) return 'student-detail';
  if (hash === 'courses') return 'courses';
  if (hash === 'search') return 'search';
  if (hash === 'web-search') return 'web-search';
  if (hash === 'monitoring') return 'monitoring';
  if (hash === 'users') return 'users';
  if (hash === 'students') return 'students';
  if (hash === 'notes') return 'notes';
  if (hash === 'todo') return 'todo';
  if (hash === 'calendar') return 'calendar';
  if (hash === 'audit-logs') return 'audit-logs';
  if (hash === 'settings') return 'settings';
  return 'dashboard';
}

export default function App() {
  const { user, isLoading, loadUser } = useAuthStore();
  const [route, setRoute] = useState<Route>(getRouteFromHash());
  const [studentId, setStudentId] = useState<string>('');

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '');
      if (hash.startsWith('students/')) {
        setStudentId(hash.split('/')[1]);
        setRoute('student-detail');
      } else {
        setRoute(getRouteFromHash());
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (r: Route, id?: string) => {
    if (r === 'student-detail' && id) {
      window.location.hash = `#/students/${id}`;
      setStudentId(id);
    } else {
      window.location.hash = `#/${r === 'dashboard' ? '' : r}`;
    }
    setRoute(r);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center fade-in">
          <div className="text-2xl font-semibold tracking-widest text-black mb-2">SMS</div>
          <div className="text-xs tracking-[0.15em] uppercase text-[#999]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (window.location.hash === '#/signup') return <SignupPage />;
    return <LoginPage />;
  }

  return (
    <Layout route={route} navigate={navigate}>
      {route === 'dashboard' && <DashboardPage navigate={navigate} />}
      {route === 'students' && <StudentsPage navigate={navigate} />}
      {route === 'student-detail' && <StudentDetailPage studentId={studentId} navigate={navigate} />}
      {route === 'courses' && <CoursesPage />}
      {route === 'search' && <SearchPage navigate={navigate} />}
      {route === 'web-search' && <WebSearchPage />}
      {route === 'monitoring' && <MonitoringPage navigate={navigate} />}
      {route === 'users' && <UsersPage navigate={navigate} />}
      {route === 'audit-logs' && <AuditLogsPage navigate={navigate} />}
      {route === 'settings' && <SettingsPage navigate={navigate} />}
      {route === 'notes' && <NotesPage />}
      {route === 'todo' && <TodoPage />}
      {route === 'calendar' && <CalendarPage />}
    </Layout>
  );
}
