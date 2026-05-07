import { useState, useEffect } from "react";
import { Bookmark, getBookmarks, removeBookmark } from "../api";

interface Props {
  isDark: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export default function BookmarksPanel({ isDark, onClose, onSearch }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  const handleDelete = (url: string) => {
    removeBookmark(url);
    setBookmarks(getBookmarks());
  };

  const filtered = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(filter.toLowerCase()) ||
      b.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase()))
  );

  const timeAgo = (dateStr: string): string => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={`relative w-full max-w-lg max-h-[80vh] rounded-2xl border overflow-hidden slide-down ${
          isDark ? "bg-[#0f0f0f] border-[#222]" : "bg-white border-[#eee]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b ${isDark ? "border-[#1a1a1a]" : "border-[#eee]"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 ${isDark ? "text-[#666]" : "text-[#999]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-black"}`}>
                Bookmarks
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-[#1a1a1a] text-[#555]" : "bg-[#f0f0f0] text-[#999]"}`}>
                {bookmarks.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#f0f0f0]"}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search filter */}
          <div className={`mt-3 flex items-center border rounded-lg px-3 py-2 ${isDark ? "border-[#222] bg-[#111]" : "border-[#eee] bg-[#fafafa]"}`}>
            <svg className={`w-4 h-4 mr-2 ${isDark ? "text-[#444]" : "text-[#ccc]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter bookmarks..."
              className={`flex-1 bg-transparent outline-none text-sm ${isDark ? "text-white placeholder:text-[#444]" : "text-[#111] placeholder:text-[#ccc]"}`}
            />
          </div>
        </div>

        {/* Bookmarks list */}
        <div className="overflow-y-auto max-h-[60vh]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? "text-[#222]" : "text-[#eee]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className={`text-sm ${isDark ? "text-[#444]" : "text-[#999]"}`}>
                {bookmarks.length === 0 ? "No bookmarks yet" : "No matching bookmarks"}
              </p>
              <p className={`text-xs mt-1 ${isDark ? "text-[#333]" : "text-[#ccc]"}`}>
                {bookmarks.length === 0 ? "Save interesting results for later" : "Try a different filter"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#111]">
              {filtered.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className={`px-5 py-4 group transition-colors ${isDark ? "hover:bg-[#111]" : "hover:bg-[#fafafa]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-black"}`}>
                        {bookmark.title}
                      </h3>
                      <p className={`text-xs mt-1 line-clamp-2 ${isDark ? "text-[#666]" : "text-[#888]"}`}>
                        {bookmark.snippet}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] ${isDark ? "text-[#444]" : "text-[#ccc]"}`}>
                          {timeAgo(bookmark.timestamp)}
                        </span>
                        {bookmark.tags.length > 0 && (
                          <div className="flex gap-1">
                            {bookmark.tags.slice(0, 2).map((tag) => (
                              <button
                                key={tag}
                                onClick={() => onSearch(tag)}
                                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                  isDark
                                    ? "bg-[#1a1a1a] text-[#555] hover:text-white"
                                    : "bg-[#f0f0f0] text-[#999] hover:text-black"
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#eee]"}`}
                        title="Open"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDelete(bookmark.url)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-[#555] hover:text-red-400 hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-red-500 hover:bg-[#fee]"}`}
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
