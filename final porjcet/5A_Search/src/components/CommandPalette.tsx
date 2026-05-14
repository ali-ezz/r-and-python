import { useState, useEffect, useRef } from "react";

interface Command {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void;
}

interface Props {
  isDark: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSearch: (query: string) => void;
  onToggleDark: () => void;
  onBookmarks: () => void;
}

export default function CommandPalette({
  isDark,
  onClose,
  onNavigate,
  onSearch,
  onToggleDark,
  onBookmarks,
}: Props) {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "search-all", label: "All Results", description: "View all results", shortcut: "Alt+1", action: () => onNavigate("all") },
    { id: "search-images", label: "Images", description: "View image results", shortcut: "Alt+2", action: () => onNavigate("images") },
    { id: "search-news", label: "News", description: "View news results", shortcut: "Alt+3", action: () => onNavigate("news") },
    { id: "search-videos", label: "Videos", description: "View video results", shortcut: "Alt+4", action: () => onNavigate("videos") },
    { id: "search-maps", label: "Maps", description: "View map results", shortcut: "Alt+5", action: () => onNavigate("maps") },
    { id: "bookmarks", label: "Bookmarks", description: "View saved bookmarks", shortcut: "Ctrl+B", action: onBookmarks },
    { id: "dark-mode", label: "Toggle Dark Mode", description: "Switch between light and dark", shortcut: "Ctrl+D", action: onToggleDark },
    { id: "close", label: "Close", description: "Close this panel", shortcut: "Esc", action: onClose },
  ];

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={`relative w-full max-w-lg rounded-2xl border overflow-hidden scale-in ${
          isDark ? "bg-[#0f0f0f] border-[#222]" : "bg-white border-[#eee]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-4 py-3 border-b ${isDark ? "border-[#1a1a1a]" : "border-[#eee]"}`}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className={`w-full bg-transparent outline-none text-sm ${
              isDark ? "text-white placeholder:text-[#444]" : "text-black placeholder:text-[#bbb]"
            }`}
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className={`px-4 py-8 text-center text-sm ${isDark ? "text-[#555]" : "text-[#999]"}`}>
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); onClose(); }}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                  i === selectedIndex
                    ? isDark ? "bg-[#1a1a1a]" : "bg-[#f5f5f5]"
                    : isDark ? "hover:bg-[#141414]" : "hover:bg-[#fafafa]"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${isDark ? "text-white" : "text-black"}`}>
                    {cmd.label}
                  </p>
                  <p className={`text-xs ${isDark ? "text-[#555]" : "text-[#999]"}`}>
                    {cmd.description}
                  </p>
                </div>
                {cmd.shortcut && (
                  <kbd className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                    isDark ? "border-[#333] bg-[#1a1a1a] text-[#555]" : "border-[#ddd] bg-[#f5f5f5] text-[#999]"
                  }`}>
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className={`px-4 py-2 border-t text-xs flex items-center justify-between ${
          isDark ? "border-[#1a1a1a] text-[#444]" : "border-[#eee] text-[#ccc]"
        }`}>
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
