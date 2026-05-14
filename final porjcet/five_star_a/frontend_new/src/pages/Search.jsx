import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Search as SearchIcon, FileText, Folder, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../stores/appStore';

const entityIcons = {
  task: FileText,
  project: Folder,
};

const entityColors = {
  task: 'var(--status-in-progress)',
  project: 'var(--accent-primary)',
};

export default function Search() {
  const navigate = useNavigate();
  const { openTaskDetail } = useAppStore();
  const [tab, setTab] = useState('internal');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ tasks: [], projects: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);
  const iframeRef = useRef(null);
  const { theme } = useTheme();

  // Sync theme with iframe - fast sync on load
  const syncThemeToIframe = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'theme-change',
        isDark: theme === 'dark'
      }, '*'); // Use wildcard for local development
    }
  }, [theme]);

  useEffect(() => {
    // Send theme immediately when it changes
    syncThemeToIframe();

    // Also send theme repeatedly for the first 2 seconds to ensure iframe receives it
    const intervals = [100, 300, 500, 1000, 2000];
    const timers = intervals.map(delay =>
      setTimeout(() => syncThemeToIframe(), delay)
    );

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [theme, syncThemeToIframe]);

  const handleIframeLoad = () => {
    // Send theme immediately when iframe loads, multiple times to ensure it's received
    syncThemeToIframe();
    setTimeout(() => syncThemeToIframe(), 100);
    setTimeout(() => syncThemeToIframe(), 300);
    setTimeout(() => syncThemeToIframe(), 500);
  };

  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setSuggestions({ tasks: [], projects: [] });
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      setSuggestions({
        tasks: data.tasks || [],
        projects: data.projects || [],
      });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSuggestionClick = async (item) => {
    setQuery('');
    setShowSuggestions(false);
    if (item.type === 'task') {
      try {
        const task = await api.get(`/tasks/${item.id}`);
        openTaskDetail(task);
      } catch (error) {
        console.error('Failed to load task details:', error);
      }
      navigate('/tasks');
      return;
    }

    if (item.type === 'project') {
      navigate(`/projects?highlight=${encodeURIComponent(item.id)}`);
      return;
    }
  };

  const handleClickOutside = (e) => {
    if (
      suggestionsRef.current &&
      !suggestionsRef.current.contains(e.target) &&
      e.target !== inputRef.current
    ) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const totalResults = suggestions.tasks.length + suggestions.projects.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Search</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Search tasks, projects, and the web</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('internal')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            background: tab === 'internal' ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
            color: tab === 'internal' ? 'var(--bg-deepest)' : 'var(--text-muted)',
            fontWeight: tab === 'internal' ? 600 : 400
          }}
        >
          <SearchIcon className="w-3 h-3" /> Internal
        </button>
        <button
          onClick={() => setTab('web')}
          className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all"
          style={{
            background: tab === 'web' ? 'var(--accent-gradient)' : 'var(--bg-secondary)',
            color: tab === 'web' ? 'var(--bg-deepest)' : 'var(--text-muted)',
            fontWeight: tab === 'web' ? 600 : 400
          }}
        >
          <Globe className="w-3 h-3" /> Web Search
        </button>
      </div>

      {tab === 'web' ? (
        <div style={{ height: 'calc(100vh - 160px)' }}>
          <iframe
            ref={iframeRef}
            src="http://127.0.0.1:5173"
            title="5A Web Search"
            className="w-full h-full border-0 rounded-xl"
            allow="clipboard-write"
            onLoad={handleIframeLoad}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative" ref={suggestionsRef}>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <SearchIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search tasks and projects..."
                  className="flex-1 bg-transparent outline-none text-base"
                  style={{ color: 'var(--text-primary)' }}
                  autoFocus
                />
                {query && (
                  <button onClick={() => { setQuery(''); setSuggestions({ tasks: [], projects: [] }); setShowSuggestions(false) }} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-4 h-4" />
                  </button>
                )}
                {isSearching && !query && (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                    style={{ color: 'var(--accent-primary)' }} />
                )}
              </div>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && query.trim() && (totalResults > 0 || isSearching) && (
              <div
                className="absolute top-full left-0 right-0 mt-2 glass-card max-h-96 overflow-y-auto z-50"
                style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' }}
              >
                {!isSearching && totalResults > 0 && (
                  <>
                    {/* Tasks */}
                    {suggestions.tasks.length > 0 && (
                      <div className="border-b border-opacity-20" style={{ borderColor: 'var(--text-muted)' }}>
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Tasks
                        </div>
                        {suggestions.tasks.map((item) => {
                          const Icon = entityIcons.task;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSuggestionClick(item)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-all text-left"
                              style={{ background: 'transparent' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: entityColors.task }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {item.title}
                                </div>
                                {item.subtitle && (
                                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Projects */}
                    {suggestions.projects.length > 0 && (
                      <div className="border-b border-opacity-20" style={{ borderColor: 'var(--text-muted)' }}>
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Projects
                        </div>
                        {suggestions.projects.map((item) => {
                          const Icon = entityIcons.project;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSuggestionClick(item)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-all text-left"
                              style={{ background: 'transparent' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: entityColors.project }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {item.title}
                                </div>
                                {item.subtitle && (
                                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {isSearching && (
                  <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm">Searching...</p>
                  </div>
                )}

                {!isSearching && query.trim() && totalResults === 0 && (
                  <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm">No results found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
