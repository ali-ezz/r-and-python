import { useState, useRef, useEffect, useMemo } from "react";
import { getSuggestions } from "../api";
import { getShellCommandCount } from "../utils/security";

interface Props {
  onSearch: (query: string) => void;
  isDark: boolean;
  onToggleDark: (dark: boolean) => void;
  shellCount?: number;
}

// ─── Floating Particles ─────────────────────────────────────────────────────

function Particles({ isDark }: { isDark: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 5,
      opacity: 0.1 + Math.random() * 0.3,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: isDark ? `rgba(255,255,255,${p.opacity})` : `rgba(0,0,0,${p.opacity * 0.5})`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SearchHome({ onSearch, isDark, onToggleDark, shellCount = 0 }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem("5*A-recent-searches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch { }
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.trim()) {
        const results = await getSuggestions(inputValue);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "d") { e.preventDefault(); onToggleDark(!isDark); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isDark, onToggleDark]);

  const saveSearch = (query: string) => {
    try {
      const saved = localStorage.getItem("5*A-recent-searches");
      const recent: string[] = saved ? JSON.parse(saved) : [];
      const updated = [query, ...recent.filter((s) => s !== query)].slice(0, 12);
      localStorage.setItem("5*A-recent-searches", JSON.stringify(updated));
      setRecentSearches(updated);
    } catch { }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      saveSearch(inputValue.trim());
      onSearch(inputValue.trim());
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    saveSearch(suggestion);
    onSearch(suggestion);
    setShowSuggestions(false);
  };

  const handleVoiceSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      saveSearch(transcript);
      onSearch(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative px-4 transition-colors duration-500">
      <Particles isDark={isDark} />

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Top bar - bookmarks button only */}
      <div className="absolute top-0 right-0 px-6 py-4 z-10">
        <button
          onClick={() => onToggleDark(!isDark)}
          className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all duration-300 ${isDark
              ? "border-[#333333] text-[#A3A3A3] hover:text-[#FFFFFF] hover:border-[#E5E5E5] bg-[#1A1A1A]"
              : "border-[#E0E0E0] text-[#737373] hover:text-[#000000] hover:border-[#1A1A1A] bg-[#FFFFFF]"
            }`}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-[660px] relative z-20 slide-up px-2" ref={suggestionsRef}>
        <form onSubmit={handleSubmit}>
          <div
            className={`relative flex items-center rounded-full px-4 sm:px-6 py-3 sm:py-4 transition-all duration-300 group ${isDark
                ? "bg-[#1A1A1A] border border-[#333333] focus-within:border-[#E5E5E5] focus-within:shadow-[0_0_24px_rgba(229,229,229,0.06)]"
                : "bg-[#FFFFFF] border border-[#E0E0E0] focus-within:border-[#1A1A1A] focus-within:bg-[#FFFFFF] focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
              }`}
          >
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-4 shrink-0 transition-colors ${isDark ? "text-[#A3A3A3]" : "text-[#737373]"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setSelectedIndex(-1); }}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (inputValue.trim() && suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Search anything..."
              className={`flex-1 bg-transparent outline-none text-base font-light transition-colors ${isDark ? "text-[#FFFFFF] placeholder:text-[#A3A3A3]" : "text-[#000000] placeholder:text-[#737373]"
                }`}
              autoFocus
            />

            {/* Voice search */}
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`ml-2 p-2 rounded-full transition-all ${isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : isDark ? "text-[#A3A3A3] hover:text-[#FFFFFF]" : "text-[#737373] hover:text-[#000000]"
                }`}
              title="Voice search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Clear button */}
            {inputValue && (
              <button
                type="button"
                onClick={() => { setInputValue(""); inputRef.current?.focus(); }}
                className={`ml-1 p-1.5 rounded-full transition-all ${isDark ? "text-[#A3A3A3] hover:text-[#FFFFFF] hover:bg-[#333333]" : "text-[#737373] hover:text-[#000000] hover:bg-[#E5E5E5]"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Keyboard hint */}
            {!inputValue && (
              <div className={`hidden sm:flex items-center gap-1 ml-2`}>
                <kbd className={`px-2 py-0.5 rounded text-[10px] border ${isDark ? "border-[#222] text-[#333]" : "border-[#e5e5e5] text-[#ccc]"}`}>/</kbd>
              </div>
            )}
          </div>
        </form>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div
            className={`absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden z-50 slide-down glass ${isDark ? "bg-[#0f0f0f]/95 border-[#222]" : "bg-white/95 border-[#e8e8e8]"
              }`}
          >
            {inputValue.trim() && suggestions.length > 0
              ? suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full px-6 py-3 text-left flex items-center gap-3 transition-colors ${index === selectedIndex
                      ? isDark ? "bg-[#1a1a1a]" : "bg-[#f5f5f5]"
                      : isDark ? "hover:bg-[#141414]" : "hover:bg-[#fafafa]"
                    }`}
                >
                  <svg className={`w-4 h-4 shrink-0 ${isDark ? "text-[#333]" : "text-[#ccc]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className={`text-sm font-light ${isDark ? "text-[#bbb]" : "text-[#333]"}`}>
                    {suggestion}
                  </span>
                  <svg className={`w-3 h-3 ml-auto ${isDark ? "text-[#333]" : "text-[#ddd]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                  </svg>
                </button>
              ))
              : !inputValue.trim() && recentSearches.length > 0 && (
                <div>
                  <div className={`px-6 py-2 text-[10px] tracking-[0.2em] uppercase font-medium ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                    Recent Searches
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSuggestionClick(term)}
                      className={`w-full px-6 py-2.5 text-left flex items-center gap-3 transition-colors ${isDark ? "hover:bg-[#141414]" : "hover:bg-[#fafafa]"
                        }`}
                    >
                      <svg className={`w-4 h-4 shrink-0 ${isDark ? "text-[#333]" : "text-[#ccc]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm font-light flex-1 ${isDark ? "text-[#666]" : "text-[#888]"}`}>
                        {term}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = recentSearches.filter((s) => s !== term);
                          localStorage.setItem("5*A-recent-searches", JSON.stringify(updated));
                          setRecentSearches(updated);
                        }}
                        className={`text-xs opacity-30 hover:opacity-100 transition-opacity ${isDark ? "text-white" : "text-black"}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      localStorage.removeItem("5*A-recent-searches");
                      setRecentSearches([]);
                    }}
                    className={`w-full px-6 py-2.5 text-left text-xs tracking-[0.1em] uppercase transition-colors border-t ${isDark ? "text-[#444] border-[#1a1a1a] hover:text-white" : "text-[#bbb] border-[#f0f0f0] hover:text-black"
                      }`}
                  >
                    Clear all history
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`absolute bottom-6 left-0 right-0 text-center z-10 transition-colors duration-500 ${isDark ? "text-[#1a1a1a]" : "text-[#eee]"}`}>
        <span className="text-[10px] tracking-[0.15em] font-light">
          5*A SEARCH • {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}
