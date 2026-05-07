export default function Footer() {
  const columns = [
    {
      title: 'HELP',
      links: ['Contact Us', 'FAQs', 'Shipping', 'Returns', 'Order Tracking', 'Size Guide'],
    },
    {
      title: 'FOLLOW US',
      links: ['Instagram', 'Facebook', 'Twitter', 'Pinterest', 'YouTube', 'TikTok'],
    },
    {
      title: 'COMPANY',
      links: ['About Us', 'Join Life', 'Careers', 'Press', 'Sustainability', 'Stores'],
    },
    {
      title: 'POLICIES',
      links: ['Privacy Policy', 'Terms of Use', 'Cookie Policy', 'Accessibility', 'Gift Cards'],
    },
  ];

  return (
    <footer className="bg-black text-white">
      {/* Main footer content */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-xs tracking-[0.2em] font-semibold mb-6">
                {column.title}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs text-gray-400 tracking-wide hover:text-white transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="text-2xl font-black tracking-[0.3em]">5*A</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-400 tracking-wide">
            <span>© 2025 5*A. All rights reserved.</span>
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            {/* Instagram */}
            <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            {/* Facebook */}
            <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* Twitter */}
            <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
              </svg>
            </a>
            {/* Pinterest */}
            <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Pinterest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 21.167c1-1.5 2.5-4.5 3-7l1.5 1.5c2.5 0 4.5-2 4.5-4.5 0-3-2.5-4.5-5-4.5s-5.5 1.5-5.5 5c0 1.5.5 2.5 1.5 3l-1 3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
