import { useState, useRef, useEffect, useMemo } from "react";
import { getSuggestions, getRandomFact } from "../api";
import { getShellCommandCount } from "../utils/security";
import BookmarksPanel from "./BookmarksPanel";

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

// ─── Real-time Clock ─────────────────────────────────────────────────────────

function Clock({ isDark }: { isDark: boolean }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`text-xs font-light tracking-[0.15em] tabular-nums ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
      {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
    </div>
  );
}

// ─── Category Grid ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { icon: "bolt", label: "Technology", query: "Artificial Intelligence" },
  { icon: "flask", label: "Science", query: "Quantum Physics" },
  { icon: "palette", label: "Art", query: "Renaissance Art" },
  { icon: "scroll", label: "History", query: "Ancient Civilizations" },
  { icon: "globe", label: "Geography", query: "World Geography" },
  { icon: "dna", label: "Biology", query: "Human Genome" },
  { icon: "music", label: "Music", query: "Classical Music" },
  { icon: "rocket", label: "Space", query: "Space Exploration" },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SearchHome({ onSearch, isDark, onToggleDark, shellCount = 0 }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [fact, setFact] = useState("");
  const [showFact, setShowFact] = useState(true);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem("5*A-recent-searches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
    setFact(getRandomFact());
  }, []);

  // Refresh fact every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setShowFact(false);
      setTimeout(() => {
        setFact(getRandomFact());
        setShowFact(true);
      }, 400);
    }, 15000);
    return () => clearInterval(timer);
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
        setShowBookmarks(false);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "d") { e.preventDefault(); onToggleDark(!isDark); }
        if (e.key === "b") { e.preventDefault(); setShowBookmarks((p) => !p); }
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
    } catch {}
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

  const handleLucky = () => {
    window.open("https://en.wikipedia.org/wiki/Special:Random", "_blank");
  };

  const trendingSearches = [
    "Artificial Intelligence",
    "Climate Change",
    "Space Exploration",
    "Quantum Computing",
    "Renaissance Art",
    "Black Holes",
    "World War II",
    "DNA",
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative px-4 transition-colors duration-500">
      <Particles isDark={isDark} />

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <Clock isDark={isDark} />
          {shellCount > 0 && (
            <span className={`text-[10px] tracking-wider px-2 py-1 rounded-full border ${
              isDark ? "border-[#222] text-[#555]" : "border-[#eee] text-[#999]"
            }`}>
              Session #{shellCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBookmarks(true)}
            className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all duration-300 ${
              isDark
                ? "border-[#333] text-[#555] hover:text-white hover:border-white"
                : "border-[#ddd] text-[#999] hover:text-black hover:border-black"
            }`}
            title="Bookmarks (Ctrl+B)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={() => onToggleDark(!isDark)}
            className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all duration-300 ${
              isDark
                ? "border-[#333] text-[#555] hover:text-white hover:border-white"
                : "border-[#ddd] text-[#999] hover:text-black hover:border-black"
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
      </div>

      {/* History button */}
      {recentSearches.length > 0 && (
        <button
          onClick={() => setShowSuggestions(true)}
          className={`absolute top-14 left-6 px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase border transition-all duration-300 z-10 ${
            isDark
              ? "border-[#222] text-[#444] hover:text-white hover:border-white"
              : "border-[#e5e5e5] text-[#aaa] hover:text-black hover:border-black"
          }`}
        >
          History
        </button>
      )}

      {/* Logo */}
      <div className="mb-6 sm:mb-10 text-center z-10 fade-in px-2">
        <div className="relative inline-block">
          <h1
            className={`text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[0.2em] sm:tracking-[0.3em] leading-none select-none transition-colors duration-500 ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            {"5*A".split("").map((letter, i) => (
              <span
                key={i}
                className="inline-block hover:scale-110 hover:-translate-y-1 transition-transform duration-300"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {letter}
              </span>
            ))}
          </h1>
          {isDark && <div className="absolute inset-0 logo-shimmer rounded-lg" />}
        </div>
        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-5">
          <span className={`h-[1px] w-8 sm:w-16 transition-colors duration-500 ${isDark ? "bg-[#333]" : "bg-[#ddd]"}`} />
          <p className={`text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase font-light transition-colors duration-500 ${isDark ? "text-[#444]" : "text-[#bbb]"}`}>
            Search the world's knowledge
          </p>
          <span className={`h-[1px] w-8 sm:w-16 transition-colors duration-500 ${isDark ? "bg-[#333]" : "bg-[#ddd]"}`} />
        </div>
      </div>

      {/* Search Bar */}
      <div className="w-full max-w-[660px] relative z-20 slide-up px-2" ref={suggestionsRef}>
        <form onSubmit={handleSubmit}>
          <div
            className={`relative flex items-center rounded-full px-4 sm:px-6 py-3 sm:py-4 transition-all duration-300 group ${
              isDark
                ? "bg-[#111] border border-[#222] focus-within:border-[#555] focus-within:shadow-[0_0_30px_rgba(255,255,255,0.03)]"
                : "bg-[#fafafa] border border-[#e5e5e5] focus-within:border-black focus-within:bg-white focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
            }`}
          >
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-4 shrink-0 transition-colors ${isDark ? "text-[#444]" : "text-[#aaa]"}`}
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
              className={`flex-1 bg-transparent outline-none text-base font-light transition-colors ${
                isDark ? "text-white placeholder:text-[#333]" : "text-[#111] placeholder:text-[#c0c0c0]"
              }`}
              autoFocus
            />

            {/* Voice search */}
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`ml-2 p-2 rounded-full transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : isDark ? "text-[#444] hover:text-white" : "text-[#bbb] hover:text-black"
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
                className={`ml-1 p-1.5 rounded-full transition-all ${isDark ? "text-[#444] hover:text-white hover:bg-[#222]" : "text-[#ccc] hover:text-black hover:bg-[#f0f0f0]"}`}
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
            className={`absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden z-50 slide-down glass ${
              isDark ? "bg-[#0f0f0f]/95 border-[#222]" : "bg-white/95 border-[#e8e8e8]"
            }`}
          >
            {inputValue.trim() && suggestions.length > 0
              ? suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-6 py-3 text-left flex items-center gap-3 transition-colors ${
                      index === selectedIndex
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
                      className={`w-full px-6 py-2.5 text-left flex items-center gap-3 transition-colors ${
                        isDark ? "hover:bg-[#141414]" : "hover:bg-[#fafafa]"
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
                    className={`w-full px-6 py-2.5 text-left text-xs tracking-[0.1em] uppercase transition-colors border-t ${
                      isDark ? "text-[#444] border-[#1a1a1a] hover:text-white" : "text-[#bbb] border-[#f0f0f0] hover:text-black"
                    }`}
                  >
                    Clear all history
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3 mt-5 sm:mt-7 z-10 fade-in-delay-2 px-2 flex-wrap justify-center">
        <button
          onClick={() => { if (inputValue.trim()) { saveSearch(inputValue.trim()); onSearch(inputValue.trim()); } }}
          className={`px-6 sm:px-8 py-2 sm:py-2.5 text-[10px] sm:text-[11px] tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium border rounded-full transition-all duration-300 ${
            isDark
              ? "border-[#333] text-[#777] hover:bg-white hover:text-black hover:border-white"
              : "border-[#ddd] text-[#666] hover:bg-black hover:text-white hover:border-black"
          }`}
        >
          Search
        </button>
        <button
          onClick={handleLucky}
          className={`px-6 sm:px-8 py-2 sm:py-2.5 text-[10px] sm:text-[11px] tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium border rounded-full transition-all duration-300 ${
            isDark
              ? "border-[#222] text-[#555] hover:border-[#555] hover:text-[#999]"
              : "border-[#e5e5e5] text-[#aaa] hover:border-[#999] hover:text-[#555]"
          }`}
        >
          I'm Feeling Lucky
        </button>
      </div>

      {/* Categories Grid */}
      <div className="mt-8 sm:mt-14 z-10 fade-in-delay-3 px-2">
        <p className={`text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.25em] uppercase mb-3 sm:mb-4 text-center font-light ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
          Explore
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-2 max-w-lg mx-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => { saveSearch(cat.query); onSearch(cat.query); }}
              className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:py-3 px-1 sm:px-2 rounded-xl transition-all duration-300 group ${
                isDark
                  ? "hover:bg-[#111]"
                  : "hover:bg-[#f8f8f8]"
              }`}
            >
              <span className={`w-5 h-5 group-hover:scale-125 transition-transform duration-300 ${isDark ? "text-[#444]" : "text-[#bbb]"}`}>
                {cat.icon === "bolt" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {cat.icon === "flask" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3v2.25H7.5a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5h-2.25V3m-4.5 0h4.5m-4.5 0a1.5 1.5 0 011.5 1.5v1.5H8.25A1.5 1.5 0 019.75 3z" />
                  </svg>
                )}
                {cat.icon === "palette" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                  </svg>
                )}
                {cat.icon === "scroll" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
                {cat.icon === "globe" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                )}
                {cat.icon === "dna" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.285 1.286 1.285 3.372 0 4.658l-.478.478c-1.286 1.286-3.372 1.286-4.658 0L9.5 15.3M5 14.5l-1.402 1.402c-1.286 1.286-1.286 3.372 0 4.658l.478.478c1.286 1.286 3.372 1.286 4.658 0L15.3 14.5" />
                  </svg>
                )}
                {cat.icon === "music" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                  </svg>
                )}
                {cat.icon === "rocket" && (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                )}
              </span>
              <span className={`text-[9px] tracking-[0.1em] uppercase font-light ${isDark ? "text-[#444]" : "text-[#bbb]"}`}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Trending Searches */}
      <div className="mt-6 sm:mt-10 text-center z-10 fade-in-delay-4 px-2">
        <p className={`text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.25em] uppercase mb-3 sm:mb-4 font-light ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
          Trending
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-xl mx-auto">
          {trendingSearches.map((term, i) => (
            <button
              key={term}
              onClick={() => { setInputValue(term); saveSearch(term); onSearch(term); }}
              className={`px-4 py-1.5 text-[11px] tracking-[0.08em] border rounded-full transition-all duration-300 ${
                isDark
                  ? "border-[#1a1a1a] text-[#555] hover:text-white hover:border-[#555]"
                  : "border-[#eee] text-[#999] hover:text-black hover:border-[#999]"
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Did You Know */}
      <div className={`mt-8 max-w-md text-center z-10 transition-opacity duration-400 ${showFact ? "opacity-100" : "opacity-0"}`}>
        <p className={`text-[10px] tracking-[0.2em] uppercase mb-2 font-light ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
          Did you know?
        </p>
        <p className={`text-xs font-light leading-relaxed ${isDark ? "text-[#444]" : "text-[#aaa]"}`}>
          {fact}
        </p>
      </div>

      {/* Footer */}
      <div className={`absolute bottom-6 left-0 right-0 text-center z-10 transition-colors duration-500 ${isDark ? "text-[#1a1a1a]" : "text-[#eee]"}`}>
        <span className="text-[10px] tracking-[0.15em] font-light">
          5*A SEARCH • {new Date().getFullYear()}
        </span>
      </div>

      {/* Modals */}
      {showBookmarks && (
        <BookmarksPanel
          isDark={isDark}
          onClose={() => setShowBookmarks(false)}
          onSearch={onSearch}
        />
      )}
    </div>
  );
}
