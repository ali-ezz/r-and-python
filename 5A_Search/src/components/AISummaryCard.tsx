import { useState } from "react";
import { AISummary, shareContent, saveBookmark, isBookmarked, removeBookmark, translateText, printResults, SearchResult } from "../api";

interface Props {
  summary: AISummary;
  query: string;
  results: SearchResult[];
  isDark: boolean;
}

export default function AISummaryCard({ summary, query, results, isDark }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(isBookmarked(results[0]?.url || ''));
  const [translating, setTranslating] = useState(false);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleBookmark = () => {
    if (results[0]) {
      if (bookmarked) {
        removeBookmark(results[0].url);
      } else {
        saveBookmark({
          id: Date.now().toString(),
          title: results[0].title,
          url: results[0].url,
          snippet: results[0].snippet,
          timestamp: new Date().toISOString(),
          tags: [query],
        });
      }
      setBookmarked(!bookmarked);
    }
  };

  const handleTranslate = async (lang: string) => {
    setTranslating(true);
    const result = await translateText(summary.summary, lang);
    if (result) {
      setTranslatedSummary(result.translated);
    }
    setTranslating(false);
  };

  const handleShare = () => {
    shareContent(
      `5*A: ${query}`,
      summary.summary,
      window.location.href
    );
  };

  const handlePrint = () => {
    printResults(query, results);
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden mb-6 slide-in-right ${
        isDark ? "bg-[#111] border-[#1f1f1f]" : "bg-gradient-to-br from-[#fafafa] to-[#f5f5f5] border-[#eee]"
      }`}
    >
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isDark ? "border-[#1a1a1a]" : "border-[#eee]"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-[#1a1a1a]" : "bg-black"}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-black"}`}>
                5*A Ai
              </h3>
              <p className={`text-[10px] ${isDark ? "text-[#555]" : "text-[#999]"}`}>
                {summary.readTime} min read
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-lg transition-all ${
                copied
                  ? "text-green-500"
                  : isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#eee]"
              }`}
              title="Copy summary"
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleBookmark}
              className={`p-1.5 rounded-lg transition-all ${
                bookmarked
                  ? "text-yellow-500"
                  : isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#eee]"
              }`}
              title={bookmarked ? "Remove bookmark" : "Save bookmark"}
            >
              <svg className="w-4 h-4" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              className={`p-1.5 rounded-lg transition-all ${isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#eee]"}`}
              title="Share"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={handlePrint}
              className={`p-1.5 rounded-lg transition-all ${isDark ? "text-[#555] hover:text-white hover:bg-[#1a1a1a]" : "text-[#aaa] hover:text-black hover:bg-[#eee]"}`}
              title="Print"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Summary content */}
      <div className="px-5 py-4">
        <h2 className={`text-lg font-semibold mb-3 ${isDark ? "text-white" : "text-black"}`}>
          {summary.title}
        </h2>

        {/* Translation bar */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] uppercase tracking-wider ${isDark ? "text-[#555]" : "text-[#999]"}`}>
            Translate:
          </span>
          {["es", "fr", "de", "ar", "zh", "ja"].map((lang) => (
            <button
              key={lang}
              onClick={() => handleTranslate(lang)}
              disabled={translating}
              className={`px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded transition-all ${
                isDark
                  ? "border-[#222] text-[#555] hover:text-white hover:border-[#444]"
                  : "border-[#ddd] text-[#999] hover:text-black hover:border-[#999]"
              } ${translating ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {lang}
            </button>
          ))}
        </div>

        <p className={`text-sm leading-relaxed font-light ${isDark ? "text-[#bbb]" : "text-[#444]"}`}>
          {translating ? (
            <span className={`inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isDark ? "border-[#555]" : "border-[#ccc]"}`} />
          ) : (
            translatedSummary || summary.summary
          )}
        </p>

        {/* Key points toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2 mt-4 text-xs font-medium transition-colors ${
            isDark ? "text-[#666] hover:text-white" : "text-[#888] hover:text-black"
          }`}
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Key Points ({summary.keyPoints.length})
        </button>

        {expanded && (
          <ul className="mt-3 space-y-2">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className={`flex gap-3 text-sm font-light ${isDark ? "text-[#999]" : "text-[#555]"}`}>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isDark ? "bg-[#444]" : "bg-[#ccc]"}`} />
                {point}
              </li>
            ))}
          </ul>
        )}

        {/* Sources */}
        {summary.sources.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${isDark ? "border-[#1a1a1a]" : "border-[#eee]"}`}>
            <p className={`text-[10px] uppercase tracking-wider mb-2 ${isDark ? "text-[#444]" : "text-[#aaa]"}`}>
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.sources.map((source, i) => (
                <a
                  key={i}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[10px] px-2 py-1 border rounded transition-colors ${
                    isDark
                      ? "border-[#222] text-[#555] hover:text-white hover:border-[#444]"
                      : "border-[#ddd] text-[#888] hover:text-black hover:border-[#999]"
                  }`}
                >
                  Source {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
