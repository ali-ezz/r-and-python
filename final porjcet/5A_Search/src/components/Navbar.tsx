import { useState } from 'react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Top announcement bar */}
      <div className="bg-black text-white text-center py-2 text-xs tracking-widest uppercase">
        Free shipping on orders over $50 | Free returns
      </div>

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
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
              <div className="hidden md:flex items-center gap-6 text-sm tracking-wide">
                <a href="#women" className="hover:opacity-60 transition-opacity">WOMAN</a>
                <a href="#men" className="hover:opacity-60 transition-opacity">MAN</a>
                <a href="#kids" className="hover:opacity-60 transition-opacity">KIDS</a>
              </div>
            </div>

            {/* Center - Logo */}
            <div className="flex items-center justify-center w-1/3">
              <a href="#" className="text-3xl md:text-4xl font-black tracking-[0.3em] text-black">
                5*A
              </a>
            </div>

            {/* Right - Icons */}
            <div className="flex items-center justify-end gap-2 w-1/3">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 hover:bg-gray-50 transition-colors"
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
              <a href="#new" className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">New In</a>
              <a href="#women" className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Woman</a>
              <a href="#men" className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Man</a>
              <a href="#kids" className="block text-sm tracking-widest uppercase font-semibold hover:opacity-60 transition-opacity">Kids</a>
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <a href="#" className="block text-sm tracking-widest uppercase text-gray-500 hover:opacity-60 transition-opacity">Join Life</a>
                <a href="#" className="block text-sm tracking-widest uppercase text-gray-500 hover:opacity-60 transition-opacity">Help</a>
                <a href="#" className="block text-sm tracking-widest uppercase text-gray-500 hover:opacity-60 transition-opacity">Stores</a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
