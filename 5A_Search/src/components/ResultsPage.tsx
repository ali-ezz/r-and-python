import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchWeb,
  searchImages,
  searchNews,
  getPageSummary,
  getInstantAnswer,
  getSuggestions,
  getDefinition,
  detectQuickAnswer,
  formatNumber,
  timeAgo,
  generateAISummary,
  SearchResult,
  ImageResult,
  PageSummary,
  InstantAnswer,
  Definition,
  QuickAnswer,
  AISummary,
} from "../api";
import { getShellCommandCount } from "../utils/security";
import AISummaryCard from "./AISummaryCard";
import BookmarksPanel from "./BookmarksPanel";
import CommandPalette from "./CommandPalette";

interface Props {
  query: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSearch: (q: string) => void;
  onGoHome: () => void;
  isDark: boolean;
  onToggleDark: (d: boolean) => void;
}

const TABS = [
  { id: "all", label: "All", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { id: "images", label: "Images", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "news", label: "News", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  { id: "videos", label: "Videos", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "maps", label: "Maps", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
];

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-8">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="max-w-[600px]" style={{ animation: `resultEnter 0.4s ease-out ${i * 0.06}s forwards`, opacity: 0 }}>
          <div className={`h-3 w-24 rounded mb-2.5 ${isDark ? "dark-shimmer" : "shimmer"}`} />
          <div className={`h-5 w-72 rounded mb-2 ${isDark ? "dark-shimmer" : "shimmer"}`} />
          <div className={`h-3 w-full rounded mb-1.5 ${isDark ? "dark-shimmer" : "shimmer"}`} />
          <div className={`h-3 w-3/4 rounded ${isDark ? "dark-shimmer" : "shimmer"}`} />
        </div>
      ))}
    </div>
  );
}

function ImageLoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className={`rounded-xl ${isDark ? "dark-shimmer" : "shimmer"}`}
          style={{ height: `${120 + Math.random() * 160}px` }}
        />
      ))}
    </div>
  );
}

// ─── Image Lightbox ──────────────────────────────────────────────────────────

function Lightbox({
  image,
  onClose,
  isDark,
}: {
  image: ImageResult | null;
  onClose: () => void;
  isDark: boolean;
}) {
  if (!image) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-10"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full mx-4">
        <img
          src={image.thumbnail}
          alt={image.title}
          className="lightbox-image mx-auto"
        />
        <div className="text-center mt-4">
          <h3 className="text-white text-lg font-medium">{image.title}</h3>
          {image.description && (
            <p className="text-white/60 text-sm font-light mt-1 max-w-lg mx-auto">
              {image.description}
            </p>
          )}
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block mt-3 text-xs tracking-[0.1em] uppercase border-b pb-0.5 transition-colors ${
              isDark ? "border-white/30 text-white/60 hover:text-white hover:border-white" : "text-white/60"
            }`}
          >
            View source →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Answer Box ────────────────────────────────────────────────────────

function QuickAnswerBox({
  quickAnswer,
  definition,
  isDark,
}: {
  quickAnswer: QuickAnswer;
  definition: Definition | null;
  isDark: boolean;
}) {
  if (quickAnswer.type === "none" && !definition) return null;

  return (
    <div
      className={`rounded-2xl border p-5 mb-6 slide-in-right ${
        isDark ? "bg-[#111] border-[#1f1f1f]" : "bg-[#f9f9f9] border-[#eee]"
      }`}
    >
      {quickAnswer.type === "calculator" && (
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
            <svg className={`w-7 h-7 ${isDark ? "text-[#666]" : "text-[#999]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
            </svg>
          </div>
          <div>
            <p className={`text-[10px] tracking-[0.2em] uppercase mb-1 ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
              Calculator Result
            </p>
            <p className={`text-2xl font-light tabular-nums ${isDark ? "text-white" : "text-black"}`}>
              {typeof quickAnswer.data === "string" && (
                <span className={`text-sm mr-2 ${isDark ? "text-[#555]" : "text-[#999]"}`}>
                  {quickAnswer.data} =
                </span>
              )}
              {quickAnswer.value}
            </p>
          </div>
        </div>
      )}

      {quickAnswer.type === "time" && (
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
            <svg className={`w-7 h-7 ${isDark ? "text-[#666]" : "text-[#999]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className={`text-[10px] tracking-[0.2em] uppercase mb-1 ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
              Current {quickAnswer.value?.includes(":") ? "Time" : "Date"}
            </p>
            <p className={`text-2xl font-light ${isDark ? "text-white" : "text-black"}`}>
              {quickAnswer.value}
            </p>
          </div>
        </div>
      )}

      {definition && (
        <div className="mt-4 first:mt-0">
          <div className="flex items-center gap-3 mb-3">
            <svg className={`w-6 h-6 ${isDark ? "text-[#666]" : "text-[#999]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div>
              <span className={`text-lg font-medium ${isDark ? "text-white" : "text-black"}`}>
                {definition.word}
              </span>
              {definition.phonetic && (
                <span className={`ml-2 text-sm font-light ${isDark ? "text-[#666]" : "text-[#999]"}`}>
                  {definition.phonetic}
                </span>
              )}
            </div>
          </div>
          {definition.meanings.map((m, mi) => (
            <div key={mi} className="mb-3 last:mb-0">
              <span className={`text-[10px] tracking-[0.15em] uppercase font-medium ${isDark ? "text-[#666]" : "text-[#999]"}`}>
                {m.partOfSpeech}
              </span>
              <ol className="mt-1 space-y-1">
                {m.definitions.map((d, di) => (
                  <li key={di} className={`text-sm font-light leading-relaxed ${isDark ? "text-[#aaa]" : "text-[#555]"}`}>
                    <span className={`mr-2 ${isDark ? "text-[#444]" : "text-[#ccc]"}`}>{di + 1}.</span>
                    {d.definition}
                    {d.example && (
                      <span className={`block ml-5 mt-0.5 text-xs italic ${isDark ? "text-[#555]" : "text-[#aaa]"}`}>
                        "{d.example}"
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Knowledge Panel ─────────────────────────────────────────────────────────

function KnowledgePanel({
  summary,
  instantAnswer,
  isDark,
  onSearch,
}: {
  summary: PageSummary | null;
  instantAnswer: InstantAnswer | null;
  isDark: boolean;
  onSearch: (q: string) => void;
}) {
  const data = summary;
  const hasAbstract = instantAnswer?.AbstractText;
  if (!data && !hasAbstract) return null;

  return (
    <div
      className={`rounded-2xl border overflow-hidden max-w-[360px] slide-in-right ${
        isDark ? "bg-[#0e0e0e] border-[#1a1a1a]" : "bg-[#fafafa] border-[#eee]"
      }`}
    >
      {data?.thumbnail && (
        <div className="relative overflow-hidden">
          <img
            src={data.thumbnail.source}
            alt={data.title}
            className="w-full h-52 object-cover"
            loading="lazy"
          />
          <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? "from-[#0e0e0e]" : "from-[#fafafa]"} via-transparent to-transparent`} />
        </div>
      )}

      <div className="p-5 -mt-8 relative z-10">
        <h3 className={`text-xl font-semibold mb-1 ${isDark ? "text-white" : "text-black"}`}>
          {data?.title || instantAnswer?.Heading}
        </h3>
        {data?.description && (
          <p className={`text-xs tracking-wide uppercase mb-3 ${isDark ? "text-[#555]" : "text-[#999]"}`}>
            {data.description}
          </p>
        )}
        <p className={`text-sm leading-relaxed font-light ${isDark ? "text-[#999]" : "text-[#555]"}`}>
          {(data?.extract || instantAnswer?.AbstractText || "").slice(0, 300)}
          {(data?.extract || instantAnswer?.AbstractText || "").length > 300 && "..."}
        </p>

        <div className="flex gap-3 mt-4">
          {data?.content_urls?.desktop?.page && (
            <a
              href={data.content_urls.desktop.page}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs tracking-[0.1em] uppercase border-b pb-0.5 transition-colors ${
                isDark ? "border-[#444] text-[#777] hover:text-white hover:border-white" : "border-[#ccc] text-[#666] hover:text-black hover:border-black"
              }`}
            >
              Wikipedia ↗
            </a>
          )}
          {instantAnswer?.AbstractURL && (
            <a
              href={instantAnswer.AbstractURL}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs tracking-[0.1em] uppercase border-b pb-0.5 transition-colors ${
                isDark ? "border-[#444] text-[#777] hover:text-white hover:border-white" : "border-[#ccc] text-[#666] hover:text-black hover:border-black"
              }`}
            >
              Source ↗
            </a>
          )}
        </div>

        {/* Related topics */}
        {instantAnswer?.RelatedTopics && instantAnswer.RelatedTopics.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
            <p className={`text-[10px] tracking-[0.2em] uppercase mb-3 font-medium ${isDark ? "text-[#555]" : "text-[#999]"}`}>
              Related Topics
            </p>
            <div className="space-y-2">
              {instantAnswer.RelatedTopics.slice(0, 6).map(
                (topic, i) =>
                  topic.Text && (
                    <button
                      key={i}
                      onClick={() => onSearch(topic.Text.split(" - ")[0] || topic.Text.slice(0, 30))}
                      className={`block text-xs font-light text-left transition-colors w-full ${
                        isDark ? "text-[#666] hover:text-white" : "text-[#888] hover:text-black"
                      }`}
                    >
                      <span className={`mr-1.5 ${isDark ? "text-[#333]" : "text-[#ddd]"}`}>→</span>
                      {topic.Text.length > 70 ? topic.Text.slice(0, 70) + "..." : topic.Text}
                    </button>
                  )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── People Also Ask ─────────────────────────────────────────────────────────

function PeopleAlsoAsk({ query, isDark, onSearch }: { query: string; isDark: boolean; onSearch: (q: string) => void }) {
  const questions = [
    `What is ${query}?`,
    `Why is ${query} important?`,
    `How does ${query} work?`,
    `When was ${query} discovered?`,
  ];

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="mb-8">
      <p className={`text-[10px] tracking-[0.2em] uppercase mb-3 font-medium ${isDark ? "text-[#444]" : "text-[#bbb]"}`}>
        People Also Ask
      </p>
      <div className="space-y-2 max-w-[650px]">
        {questions.map((q, i) => (
          <div
            key={i}
            className={`border rounded-xl overflow-hidden transition-all duration-300 ${
              isDark ? "border-[#1a1a1a] hover:border-[#333]" : "border-[#eee] hover:border-[#ccc]"
            }`}
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className={`w-full px-5 py-3.5 flex items-center justify-between text-left transition-colors ${
                isDark ? "hover:bg-[#111]" : "hover:bg-[#fafafa]"
              }`}
            >
              <span className={`text-sm font-light ${isDark ? "text-[#bbb]" : "text-[#333]"}`}>
                {q}
              </span>
              <svg
                className={`w-4 h-4 shrink-0 transition-transform duration-300 ${expanded === i ? "rotate-180" : ""} ${isDark ? "text-[#444]" : "text-[#ccc]"}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expanded === i && (
              <div className={`px-5 py-3 border-t text-sm font-light leading-relaxed ${
                isDark ? "border-[#1a1a1a] text-[#777]" : "border-[#eee] text-[#666]"
              }`}>
                <p>Search for the answer to this question.</p>
                <button
                  onClick={() => onSearch(q)}
                  className={`mt-2 text-xs tracking-[0.1em] uppercase border-b pb-0.5 transition-colors ${
                    isDark ? "border-[#444] text-[#666] hover:text-white hover:border-white" : "border-[#ccc] text-[#999] hover:text-black hover:border-black"
                  }`}
                >
                  Search →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ResultsPage({
  query, activeTab, onTabChange, onSearch, onGoHome, isDark, onToggleDark, theme, onThemeChange,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pageSummary, setPageSummary] = useState<PageSummary | null>(null);
  const [instantAnswer, setInstantAnswer] = useState<InstantAnswer | null>(null);
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [quickAnswer, setQuickAnswer] = useState<QuickAnswer>({ type: "none" });
  const [inputValue, setInputValue] = useState(query);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [lightboxImage, setLightboxImage] = useState<ImageResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shellCount] = useState(getShellCommandCount());
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(query); }, [query]);

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

  // Fetch suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.trim()) {
        const s = await getSuggestions(inputValue);
        setSuggestions(s);
      } else {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // ─── Perform Search ──────────────────────────────────────────────────

  const performSearch = useCallback(
    async (searchQuery: string, newOffset = 0) => {
      if (!searchQuery.trim()) return;
      setIsLoading(true);
      const start = performance.now();

      // Quick answer detection
      const qa = detectQuickAnswer(searchQuery);
      setQuickAnswer(qa);

      // Try dictionary for single words
      if (searchQuery.trim().split(/\s+/).length <= 3 && qa.type === "none") {
        getDefinition(searchQuery).then(setDefinition);
      } else {
        setDefinition(null);
      }

      try {
        if (activeTab === "all") {
          const [webData, summary, ddg] = await Promise.all([
            searchWeb(searchQuery, newOffset),
            getPageSummary(searchQuery),
            getInstantAnswer(searchQuery),
          ]);
          const elapsed = (performance.now() - start) / 1000;
          setResults(webData.results);
          setTotalHits(webData.totalHits);
          setSearchTime(elapsed);
          setPageSummary(summary);
          setInstantAnswer(ddg);
        } else if (activeTab === "images") {
          const imgData = await searchImages(searchQuery, newOffset);
          const elapsed = (performance.now() - start) / 1000;
          setImageResults(imgData.results);
          setTotalHits(imgData.totalHits || 0);
          setSearchTime(elapsed);
        } else if (activeTab === "news") {
          const newsData = await searchNews(searchQuery, newOffset);
          const elapsed = (performance.now() - start) / 1000;
          setResults(newsData.results);
          setTotalHits(newsData.totalHits);
          setSearchTime(elapsed);
        }
        setOffset(newOffset);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab]
  );

  useEffect(() => { performSearch(query); }, [query, activeTab, performSearch]);

  // Generate AI summary when results change
  useEffect(() => {
    if (results.length > 0 && activeTab === "all") {
      const summary = generateAISummary(query, results, pageSummary);
      setAiSummary(summary);
    } else {
      setAiSummary(null);
    }
  }, [results, query, pageSummary, activeTab]);

  // ─── Handlers ────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setShowSuggestions(false);
      onSearch(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, -1)); }
    else if (e.key === "Escape") { setShowSuggestions(false); }
  };

  const handleSuggestionClick = (s: string) => { setInputValue(s); setShowSuggestions(false); onSearch(s); };

  const copyLink = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  const loadMore = () => { performSearch(query, offset + 15); mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };

  const currentPage = Math.floor(offset / 15) + 1;

  // ─── Global Keyboard Shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        setShowBookmarks(false);
        setShowCommandPalette(false);
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "d") { e.preventDefault(); onToggleDark(!isDark); }
        if (e.key === "h") { e.preventDefault(); onGoHome(); }
        if (e.key === "b") { e.preventDefault(); setShowBookmarks((p) => !p); }
        if (e.key === "k") { e.preventDefault(); setShowCommandPalette((p) => !p); }
      }
    };
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, [isDark, onToggleDark, onGoHome]);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen transition-colors duration-500">
      {/* Lightbox */}
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} isDark={isDark} />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 border-b glass ${isDark ? "bg-[#0a0a0a]/80 border-[#151515]" : "bg-white/80 border-[#eee]"}`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 py-2 sm:py-3">
            {/* Logo */}
            <button
              onClick={onGoHome}
              className={`shrink-0 text-xl sm:text-2xl font-black tracking-[0.15em] sm:tracking-[0.2em] transition-all duration-300 ${isDark ? "text-white hover:opacity-60" : "text-black hover:opacity-60"}`}
            >
              5*A
            </button>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl relative" ref={suggestionsRef}>
              <form onSubmit={handleSubmit}>
                <div className={`flex items-center border rounded-full px-4 py-2.5 transition-all duration-300 ${
                  isDark
                    ? "border-[#222] focus-within:border-[#555] bg-[#111]"
                    : "border-[#e5e5e5] focus-within:border-black bg-[#f8f8f8]"
                }`}>
                  <svg className={`w-4 h-4 mr-3 shrink-0 ${isDark ? "text-[#444]" : "text-[#aaa]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setSelectedIndex(-1); }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => inputValue.trim() && suggestions.length > 0 && setShowSuggestions(true)}
                    className={`flex-1 bg-transparent outline-none text-sm font-light ${isDark ? "text-white placeholder:text-[#333]" : "text-[#111] placeholder:text-[#bbb]"}`}
                  />
                  {inputValue && (
                    <button
                      type="button"
                      onClick={() => { setInputValue(""); inputRef.current?.focus(); }}
                      className={`ml-2 p-1 ${isDark ? "text-[#444] hover:text-white" : "text-[#ccc] hover:text-black"}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </form>

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-2xl overflow-hidden z-50 slide-down glass ${
                  isDark ? "bg-[#0f0f0f]/95 border-[#222]" : "bg-white/95 border-[#e8e8e8]"
                }`}>
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestionClick(s)}
                      className={`w-full px-5 py-2.5 text-left flex items-center gap-3 text-sm transition-colors ${
                        i === selectedIndex
                          ? isDark ? "bg-[#1a1a1a]" : "bg-[#f5f5f5]"
                          : isDark ? "hover:bg-[#141414]" : "hover:bg-[#fafafa]"
                      }`}
                    >
                      <svg className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-[#333]" : "text-[#ccc]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className={`font-light ${isDark ? "text-[#bbb]" : "text-[#333]"}`}>{s}</span>
                      <svg className={`w-3 h-3 ml-auto ${isDark ? "text-[#333]" : "text-[#ddd]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons - essential only */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowBookmarks(true)}
                className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-all ${
                  isDark ? "border-[#333] text-[#555] hover:text-white hover:border-white" : "border-[#ddd] text-[#999] hover:text-black hover:border-black"
                }`}
                title="Bookmarks (Ctrl+B)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <button
                onClick={() => setShowCommandPalette(true)}
                className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-all ${
                  isDark ? "border-[#333] text-[#555] hover:text-white hover:border-white" : "border-[#ddd] text-[#999] hover:text-black hover:border-black"
                }`}
                title="Commands (Ctrl+K)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => onToggleDark(!isDark)}
                className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-all ${
                  isDark ? "border-[#333] text-[#555] hover:text-white hover:border-white" : "border-[#ddd] text-[#999] hover:text-black hover:border-black"
                }`}
                title="Dark mode (Ctrl+D)"
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

          {/* Tabs */}
          <nav className="flex gap-0.5 sm:gap-1 -mb-px overflow-x-auto scrollbar-hide pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.12em] uppercase whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? isDark ? "text-white border-white" : "text-black border-black"
                    : isDark ? "text-[#444] border-transparent hover:text-[#777] hover:border-[#333]" : "text-[#aaa] border-transparent hover:text-[#555] hover:border-[#ddd]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main ref={mainRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 page-transition-enter">
        {/* Result stats */}
        {!isLoading && totalHits > 0 && (
          <p className={`text-xs font-light mb-5 ${isDark ? "text-[#444]" : "text-[#aaa]"}`}>
            About {formatNumber(totalHits)} results ({searchTime.toFixed(2)} seconds)
          </p>
        )}

        {/* ─── ALL TAB ─────────────────────────────────────────────────── */}
        {activeTab === "all" && (
          <div className="flex gap-8">
            <div className="flex-1 max-w-[650px]">
              {/* AI Summary */}
              {aiSummary && (
                <AISummaryCard
                  summary={aiSummary}
                  query={query}
                  results={results}
                  isDark={isDark}
                />
              )}

              {/* Quick answer */}
              <QuickAnswerBox quickAnswer={quickAnswer} definition={definition} isDark={isDark} />

              {/* People Also Ask */}
              {!isLoading && results.length > 0 && (
                <PeopleAlsoAsk query={query} isDark={isDark} onSearch={onSearch} />
              )}

              {isLoading ? (
                <LoadingSkeleton isDark={isDark} />
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result, i) => (
                    <div
                      key={result.pageid || i}
                      className="result-enter group"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block -mx-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                          isDark ? "hover:bg-[#111]" : "hover:bg-[#fafafa]"
                        }`}
                      >
                        {/* Source & URL */}
                        <div className={`flex items-center gap-2 mb-1 text-xs font-light ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                          {(() => {
                            try {
                              const urlObj = new URL(result.url);
                              const domain = urlObj.hostname.replace('www.', '');
                              const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                              return (
                                <>
                                  <img src={favicon} alt="" className="w-4 h-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  <span className="truncate">{domain}</span>
                                  <span className="opacity-40">›</span>
                                  <span className="truncate max-w-[200px]">{urlObj.pathname.slice(0, 40)}</span>
                                </>
                              );
                            } catch {
                              return <span>{result.url.slice(0, 50)}</span>;
                            }
                          })()}
                        </div>

                        {/* Title */}
                        <h3 className={`text-[17px] font-medium mb-1 group-hover:underline underline-offset-2 decoration-1 ${
                          isDark ? "text-[#7ea8f0]" : "text-[#1a0dab]"
                        }`}>
                          {result.title}
                        </h3>

                        {/* Snippet */}
                        <p className={`text-sm leading-relaxed font-light ${isDark ? "text-[#777]" : "text-[#555]"}`}>
                          {result.snippet.length > 200 ? result.snippet.slice(0, 200) + '...' : result.snippet}
                        </p>

                        {/* Meta */}
                        <div className={`flex items-center gap-3 mt-2 text-[10px] tracking-wide ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                          {result.wordcount ? <span>{formatNumber(result.wordcount)} words</span> : null}
                          {result.wordcount && <span>~{Math.max(1, Math.ceil(result.wordcount / 200))} min read</span>}
                          {result.timestamp ? (
                            <>
                              <span>•</span>
                              <span>{timeAgo(result.timestamp)}</span>
                            </>
                          ) : null}
                        </div>
                      </a>

                      {/* Action buttons */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
                        <button
                          onClick={() => copyLink(result.url, i)}
                          className={`p-1.5 rounded-lg transition-all ${
                            copiedIndex === i
                              ? "text-green-500"
                              : isDark ? "hover:bg-[#1a1a1a] text-[#444] hover:text-white" : "hover:bg-[#f0f0f0] text-[#ccc] hover:text-black"
                          }`}
                          title="Copy link"
                        >
                          {copiedIndex === i ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div className="flex items-center justify-center gap-2 pt-8 pb-4">
                    {offset > 0 && (
                      <button
                        onClick={() => { performSearch(query, Math.max(0, offset - 15)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className={`px-5 py-2 text-[11px] tracking-[0.15em] uppercase border rounded-full transition-all ${
                          isDark ? "border-[#222] text-[#666] hover:text-white hover:border-white" : "border-[#ddd] text-[#888] hover:text-black hover:border-black"
                        }`}
                      >
                        ← Prev
                      </button>
                    )}

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((p) => (
                        <button
                          key={p}
                          onClick={() => { performSearch(query, (p - 1) * 15); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={`w-8 h-8 text-xs rounded-full transition-all ${
                            p === currentPage
                              ? isDark ? "bg-white text-black" : "bg-black text-white"
                              : isDark ? "text-[#555] hover:text-white" : "text-[#999] hover:text-black"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={loadMore}
                      className={`px-5 py-2 text-[11px] tracking-[0.15em] uppercase border rounded-full transition-all ${
                        isDark ? "border-[#222] text-[#666] hover:text-white hover:border-white" : "border-[#ddd] text-[#888] hover:text-black hover:border-black"
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              ) : !isLoading && (
                <div className="text-center py-16 fade-in">
                  <div className={`text-7xl mb-4 ${isDark ? "text-[#1a1a1a]" : "text-[#eee]"}`}>∅</div>
                  <p className={`text-sm font-light ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                    No results found for &ldquo;{query}&rdquo;
                  </p>
                  <p className={`text-xs font-light mt-2 ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                    Try different keywords or check your spelling
                  </p>
                </div>
              )}
            </div>

            {/* Knowledge Panel */}
            {(pageSummary || instantAnswer?.AbstractText) && (
              <div className="hidden lg:block shrink-0 pt-0">
                <KnowledgePanel
                  summary={pageSummary}
                  instantAnswer={instantAnswer}
                  isDark={isDark}
                  onSearch={onSearch}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── IMAGES TAB ───────────────────────────────────────────────── */}
        {activeTab === "images" && (
          <div>
            {isLoading ? (
              <ImageLoadingSkeleton isDark={isDark} />
            ) : imageResults.length > 0 ? (
              <>
                <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4 fade-in">
                  {imageResults.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImage(img)}
                      className={`block w-full group break-inside-avoid rounded-xl overflow-hidden border transition-all duration-300 text-left ${
                        isDark
                          ? "border-[#1a1a1a] hover:border-[#444]"
                          : "border-[#eee] hover:border-[#ccc] hover:shadow-lg"
                      }`}
                    >
                      <div className="overflow-hidden relative">
                        <img
                          src={img.thumbnail}
                          alt={img.title}
                          className="w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className={`text-xs font-medium truncate mb-0.5 ${isDark ? "text-[#ccc]" : "text-[#333]"}`}>
                          {img.title}
                        </h4>
                        <p className={`text-[10px] font-light line-clamp-1 ${isDark ? "text-[#444]" : "text-[#aaa]"}`}>
                          {img.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    className={`px-6 py-2.5 text-[11px] tracking-[0.15em] uppercase border rounded-full transition-all ${
                      isDark ? "border-[#222] text-[#666] hover:text-white hover:border-white" : "border-[#ddd] text-[#888] hover:text-black hover:border-black"
                    }`}
                  >
                    Load more images
                  </button>
                </div>
              </>
            ) : !isLoading && (
              <div className="text-center py-16 fade-in">
                <div className={`text-7xl mb-4 ${isDark ? "text-[#1a1a1a]" : "text-[#eee]"}`}>⊘</div>
                <p className={`text-sm font-light ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                  No images found for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── NEWS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "news" && (
          <div className="max-w-[650px]">
            {isLoading ? (
              <LoadingSkeleton isDark={isDark} />
            ) : results.length > 0 ? (
              <div className="space-y-1 fade-in">
                {results.map((result, i) => (
                  <a
                    key={result.pageid || i}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block group border-l-2 pl-5 py-4 -mx-2 px-3 rounded-r-xl transition-all duration-200 result-enter ${
                      isDark ? "border-[#222] hover:border-white hover:bg-[#0e0e0e]" : "border-[#ddd] hover:border-black hover:bg-[#fafafa]"
                    }`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className={`flex items-center gap-2 mb-1.5 text-[10px] tracking-wide uppercase ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                      {result.timestamp && <span>{timeAgo(result.timestamp)}</span>}
                      <span>•</span>
                      <span>Wikipedia</span>
                    </div>
                    <h3 className={`text-base font-medium mb-1.5 group-hover:underline underline-offset-2 ${isDark ? "text-[#7ea8f0]" : "text-[#1a0dab]"}`}>
                      {result.title}
                    </h3>
                    <p className={`text-sm font-light leading-relaxed ${isDark ? "text-[#666]" : "text-[#555]"}`}>
                      {result.snippet}...
                    </p>
                  </a>
                ))}
                <div className="flex justify-center pt-6">
                  <button
                    onClick={loadMore}
                    className={`px-6 py-2.5 text-[11px] tracking-[0.15em] uppercase border rounded-full transition-all ${
                      isDark ? "border-[#222] text-[#666] hover:text-white hover:border-white" : "border-[#ddd] text-[#888] hover:text-black hover:border-black"
                    }`}
                  >
                    More news →
                  </button>
                </div>
              </div>
            ) : !isLoading && (
              <div className="text-center py-16 fade-in">
                <div className={`text-6xl mb-4 ${isDark ? "text-[#1a1a1a]" : "text-[#eee]"}`}>∅</div>
                <p className={`text-sm font-light ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                  No news found for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── VIDEOS TAB ───────────────────────────────────────────────── */}
        {activeTab === "videos" && (
          <div className="fade-in">
            <div className={`text-center py-12 rounded-2xl border ${isDark ? "border-[#151515]" : "border-[#eee]"}`}>
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? "bg-[#111]" : "bg-[#f5f5f5]"}`}>
                <svg className={`w-8 h-8 ${isDark ? "text-[#444]" : "text-[#ccc]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className={`text-sm font-light mb-4 ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                Search YouTube for &ldquo;{query}&rdquo; videos
              </p>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-block px-6 py-2.5 text-[11px] tracking-[0.15em] uppercase border rounded-full transition-all ${
                  isDark ? "border-[#222] text-[#666] hover:text-white hover:border-white" : "border-[#ddd] text-[#888] hover:text-black hover:border-black"
                }`}
              >
                Search on YouTube →
              </a>
            </div>

            {!isLoading && results.length > 0 && (
              <div className="mt-8">
                <p className={`text-[10px] tracking-[0.2em] uppercase mb-4 font-light ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                  Related Articles
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {results.slice(0, 6).map((result, i) => (
                    <a
                      key={result.pageid || i}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block p-4 border rounded-xl transition-all group result-enter ${
                        isDark ? "border-[#151515] hover:border-[#333] hover:bg-[#0e0e0e]" : "border-[#eee] hover:border-[#ccc] hover:shadow-sm"
                      }`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <h4 className={`text-sm font-medium mb-1.5 group-hover:underline ${isDark ? "text-[#bbb]" : "text-[#333]"}`}>
                        {result.title}
                      </h4>
                      <p className={`text-xs font-light line-clamp-2 ${isDark ? "text-[#555]" : "text-[#999]"}`}>
                        {result.snippet}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── MAPS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "maps" && (
          <div className="fade-in">
            <div className={`rounded-2xl overflow-hidden border ${isDark ? "border-[#151515]" : "border-[#eee]"}`}>
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`}
                style={{ width: "100%", height: "500px", border: 0 }}
                title="Map"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-center">
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs tracking-[0.1em] uppercase border-b pb-0.5 transition-colors ${
                  isDark ? "border-[#333] text-[#666] hover:text-white hover:border-white" : "border-[#ccc] text-[#999] hover:text-black hover:border-black"
                }`}
              >
                View on OpenStreetMap →
              </a>
            </div>
          </div>
        )}

        {/* ─── Related Searches ──────────────────────────────────────────── */}
        {activeTab !== "maps" && activeTab !== "videos" && !isLoading && results.length > 0 && (
          <div className="mt-12 pt-8 border-t max-w-[650px]">
            <p className={`text-[10px] tracking-[0.2em] uppercase mb-4 font-light ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
              Related Searches
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                `${query} history`,
                `${query} facts`,
                `${query} definition`,
                `how does ${query} work`,
                `${query} examples`,
                `${query} overview`,
              ].map((related) => (
                <button
                  key={related}
                  onClick={() => { setInputValue(related); onSearch(related); }}
                  className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-light border rounded-xl transition-all duration-200 ${
                    isDark
                      ? "border-[#151515] text-[#555] hover:text-white hover:border-[#444] hover:bg-[#0e0e0e]"
                      : "border-[#f0f0f0] text-[#888] hover:text-black hover:border-[#ccc] hover:bg-[#fafafa]"
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-[#333]" : "text-[#ddd]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {related}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`mt-12 border-t ${isDark ? "border-[#111]" : "border-[#eee]"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <span className={`text-xs tracking-[0.15em] font-black ${isDark ? "text-[#222]" : "text-[#ddd]"}`}>
                5*A
              </span>
              <span className={`text-[10px] tracking-wide font-light ${isDark ? "text-[#222]" : "text-[#ddd]"}`}>
                Powered by 5*A
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer"
                className={`text-[10px] tracking-[0.1em] uppercase font-light transition-colors ${isDark ? "text-[#222] hover:text-white" : "text-[#ddd] hover:text-black"}`}>
                Wikipedia
              </a>
              <a href="https://duckduckgo.com" target="_blank" rel="noopener noreferrer"
                className={`text-[10px] tracking-[0.1em] uppercase font-light transition-colors ${isDark ? "text-[#222] hover:text-white" : "text-[#ddd] hover:text-black"}`}>
                DuckDuckGo
              </a>
              <span className={`text-[10px] tracking-wide font-light ${isDark ? "text-[#222]" : "text-[#ddd]"}`}>
                © {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
      {showBookmarks && (
        <BookmarksPanel
          isDark={isDark}
          onClose={() => setShowBookmarks(false)}
          onSearch={onSearch}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          isDark={isDark}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={onTabChange}
          onSearch={onSearch}
          onToggleDark={() => onToggleDark(!isDark)}
        />
      )}
    </div>
  );
}
