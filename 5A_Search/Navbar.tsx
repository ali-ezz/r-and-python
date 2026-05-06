import { useState, useEffect } from 'react';
import { getSavedTheme, onThemeChange, toggleTheme } from '../utils/theme';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => getSavedTheme() === 'dark');

  useEffect(() => onThemeChange((theme) => setIsDark(theme === 'dark')), []);

  const toggleDarkMode = () => {
    setIsDark(toggleTheme() === 'dark');
  };

  return (
    <>
      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left - Hamburger menu */}
            <div className="flex items-center gap-4 w-1/3">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-gray-50 transition-colors"
                aria-label="Menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div className="hidden md:flex items-center gap-6 text-sm tracking-wide dark:text-gray-200">
                <a href="#/dashboard" className="hover:opacity-60 transition-opacity">DASHBOARD</a>
                <a href="#/students" className="hover:opacity-60 transition-opacity">STUDENTS</a>
                <a href="#/courses" className="hover:opacity-60 transition-opacity">COURSES</a>
              </div>
            </div>

            {/* Center - Logo */}
            <div className="flex items-center justify-center w-1/3">
              <a href="#/dashboard" className="text-3xl md:text-4xl font-black tracking-[0.3em] text-black dark:text-white">
                SMS
              </a>
            </div>

            {/* Right - Icons */}
            <div className="flex items-center justify-end gap-2 w-1/3">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white"
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>

              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white"
                aria-label="Search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-50 transition-colors hidden md:block" aria-label="Account">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-50 transition-colors relative" aria-label="Cart">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  0
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div
          className={`overflow-hidden transition-all duration-300 border-t border-gray-100 ${
            searchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
            <div className="flex items-center gap-3 border-b border-black pb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="SEARCH"
                className="flex-1 text-sm tracking-widest outline-none bg-transparent placeholder:text-gray-400"
                autoFocus={searchOpen}
              />
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`fixed inset-0 z-[60] transition-all duration-300 ${
            menuOpen ? 'visible' : 'invisible'
          }`}
        >
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
              menuOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={`absolute left-0 top-0 bottom-0 w-80 bg-white transition-transform duration-300 ${
              menuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <span className="text-lg font-semibold tracking-wider">MENU</span>
              <button onClick={() => setMenuOpen(false)} className="p-1 hover:bg-gray-50">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <a href="#/dashboard" onClick={() => setMenuOpen(false)} className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Dashboard</a>
              <a href="#/students" onClick={() => setMenuOpen(false)} className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Students</a>
              <a href="#/courses" onClick={() => setMenuOpen(false)} className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Courses</a>
              <a href="#/search" onClick={() => setMenuOpen(false)} className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Search</a>
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <a href="#/monitoring" onClick={() => setMenuOpen(false)} className="block text-sm tracking-widest uppercase text-gray-500 hover:opacity-60 transition-opacity">Monitoring</a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
