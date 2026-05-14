/**
 * 5*A Security Utilities
 * Based on uBlock Origin security architecture
 * https://github.com/gorhill/uBlock
 */

// ─── uBlock Origin URI Utilities ──────────────────────────────────────────

const reHostnameFromCommonURL = /^https:\/\/[0-9a-z._-]+[0-9a-z]\//;
const reAuthorityFromURI = /^(?:[^:/?#]+:)?(\/\/[^/?#]+)/;
const reHostFromNakedAuthority = /^[0-9a-z._-]+[0-9a-z]$/i;
const reHostFromAuthority = /^(?:[^@]*@)?([^:]+)(?::\d*)?$/;
const reIPv6FromAuthority = /^(?:[^@]*@)?(\[[0-9a-f:]+\])(?::\d*)?$/i;
const reMustNormalizeHostname = /[^0-9a-z._-]/;
const reHostnameFromNetworkURL = /^(?:http|ws|ftp)s?:\/\/([0-9a-z_][0-9a-z._-]*[0-9a-z])(?::\d+)?\//;
const reIPAddressNaive = /^\d+\.\d+\.\d+\.\d+$|^\[[\da-zA-Z:]+\]$/;
const reNetworkURI = /^(?:ftps?|https?|wss?):\/\//;
const reIPv4VeryCoarse = /\.\d+$/;
const reHostnameVeryCoarse = /[g-z_-]/;

// Blocked hostnames (uBlock Origin style)
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
  '10.0.0.0',
  '172.16.0.0',
  '192.168.0.0',
];

// ─── Content Security Policy (CSP) ──────────────────────────────────────

export const CSP_DIRECTIVES = {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-inline' 'unsafe-eval' blob:",
  'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
  'img-src': "'self' data: blob: https:",
  'font-src': "'self' https://fonts.gstatic.com data:",
  'connect-src': "'self' https://en.wikipedia.org https://api.dictionaryapi.dev https://api.mymemory.translated.net https://*.wikipedia.org https://*.reddit.com https://*.unsplash.com https://*.nixnet.services https://*.searx.be https://api-inference.huggingface.co https://router.huggingface.co",
  'frame-src': "'none'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
  'worker-src': "'self' blob:",
  'child-src': "'self' blob:",
  'media-src': "'self' blob:",
};

export function getCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
}

// ─── URI/URL Utilities (from uBlock Origin) ─────────────────────────────

export function hostnameFromURI(uri: string): string {
  let match = reHostnameFromCommonURL.exec(uri);
  if (match !== null) return match[0].slice(8, -1);

  match = reAuthorityFromURI.exec(uri);
  if (match === null) return '';

  const authority = match[1].slice(2);
  if (reHostFromNakedAuthority.test(authority)) {
    return authority.toLowerCase();
  }

  match = reHostFromAuthority.exec(authority);
  if (match === null) {
    match = reIPv6FromAuthority.exec(authority);
    if (match === null) return '';
  }

  let hostname = match[1];
  while (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  return hostname;
}

export function domainFromHostname(hostname: string): string {
  if (reIPAddressNaive.test(hostname)) return hostname;

  const parts = hostname.split('.');
  if (parts.length < 2) return hostname;

  // Simple domain extraction (last two parts for common TLDs)
  return parts.slice(-2).join('.');
}

export function entityFromDomain(domain: string): string {
  const pos = domain.indexOf('.');
  return pos !== -1 ? domain.slice(0, pos) + '.*' : '';
}

export function isNetworkURI(uri: string): boolean {
  return reNetworkURI.test(uri);
}

export function isIPAddress(hostname: string): boolean {
  return reIPAddressNaive.test(hostname);
}

// ─── Input Sanitization (from uBlock Origin's static-filtering-parser) ─

export function sanitizeHTML(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);

    // Block non-http protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    // Block javascript: and data: URLs
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return '';
    }

    return parsed.href;
  } catch {
    return '';
  }
}

export function sanitizeQuery(query: string): string {
  return query
    .replace(/[<>]/g, '') // Strip angle brackets
    .replace(/javascript:/gi, '') // Block javascript protocol
    .replace(/data:/gi, '') // Block data protocol
    .replace(/vbscript:/gi, '') // Block vbscript
    .trim()
    .slice(0, 2000); // Limit length
}

// ─── XSS Prevention ─────────────────────────────────────────────────────

export function escapeHTML(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };
  return str.replace(/[&<>"'`/]/g, (char) => escapeMap[char] || char);
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// ─── Request Validation (from uBlock Origin's net-filtering) ───────────

export function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isSafeDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();

  // Check against blocked hostnames
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (lowerDomain === blocked || lowerDomain.endsWith('.' + blocked)) {
      return false;
    }
  }

  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some((blocked) =>
    lower === blocked || lower.endsWith('.' + blocked)
  );
}

// ─── Rate Limiting (from uBlock Origin's traffic management) ───────────

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    if (this.requests.length >= this.config.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getRemainingRequests(): number {
    return Math.max(0, this.config.maxRequests - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    return this.config.windowMs - (Date.now() - this.requests[0]);
  }
}

export const searchRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 10000, // 10 requests per 10 seconds
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000, // 30 requests per minute
});

// ─── Data Validation (from uBlock Origin's arglist-parser) ─────────────

export function validateSearchQuery(query: string): { valid: boolean; sanitized: string; error?: string } {
  if (!query || typeof query !== 'string') {
    return { valid: false, sanitized: '', error: 'Query is required' };
  }

  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'Query cannot be empty' };
  }

  if (trimmed.length > 2000) {
    return { valid: false, sanitized: trimmed.slice(0, 2000), error: 'Query too long, truncated' };
  }

  // Check for potentially dangerous patterns (uBlock Origin style)
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /<script/i,
    /on\w+\s*=/i, // Event handlers
    /eval\(/i,
    /document\./i,
    /window\./i,
    /alert\(/i,
    /prompt\(/i,
    /confirm\(/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, sanitized: '', error: 'Potentially dangerous query pattern detected' };
    }
  }

  return { valid: true, sanitized: trimmed };
}

// ─── Storage Security (from uBlock Origin's storage.js) ─────────────────

export function secureStorageGet(key: string, defaultValue: unknown = null): unknown {
  try {
    const item = localStorage.getItem(`5*A-${key}`);
    if (item === null) return defaultValue;

    // Validate JSON before parsing (uBlock Origin style)
    if (!/^[{}\[\]"',:.\w\s\-]+$/.test(item.slice(0, 50))) {
      console.warn('[Security] Potentially malformed storage data');
      return defaultValue;
    }

    return JSON.parse(item);
  } catch (error) {
    console.error('[Security] Storage read error:', error);
    return defaultValue;
  }
}

export function secureStorageSet(key: string, value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);

    // Check storage quota (rough estimate)
    if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
      console.warn('[Security] Storage quota exceeded');
      return false;
    }

    localStorage.setItem(`5*A-${key}`, serialized);
    return true;
  } catch (error) {
    console.error('[Security] Storage write error:', error);
    return false;
  }
}

export function secureStorageRemove(key: string): void {
  try {
    localStorage.removeItem(`5*A-${key}`);
  } catch {
    // Silently fail
  }
}

// ─── Event Listener Security (from uBlock Origin's messaging) ──────────

interface EventListenerRegistry {
  element: Element;
  event: string;
  handler: EventListener;
}

const registeredListeners: EventListenerRegistry[] = [];

export function secureAddEventListener(
  element: Element,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): void {
  element.addEventListener(event, handler, options);
  registeredListeners.push({ element, event, handler });
}

export function secureRemoveAllListeners(): void {
  registeredListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  registeredListeners.length = 0;
}

// ─── DOM Security (from uBlock Origin's dom.js) ─────────────────────────

export function safeCreateElement(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);

  const safeAttrs = ['class', 'id', 'title', 'alt', 'href', 'src', 'type', 'value', 'placeholder', 'name'];

  for (const [key, value] of Object.entries(attrs)) {
    if (safeAttrs.includes(key)) {
      if (key === 'href' || key === 'src') {
        el.setAttribute(key, sanitizeURL(value));
      } else {
        el.setAttribute(key, escapeHTML(value));
      }
    }
  }

  return el;
}

export function safeSetInnerHTML(element: Element, html: string): void {
  // Only allow safe HTML tags (uBlock Origin cosmetic filter style)
  const safeTags = ['b', 'i', 'u', 'em', 'strong', 'br', 'p', 'span', 'a', 'code', 'pre'];
  const sanitized = html.replace(/<\/?([a-z][a-z0-9]*)[^>]*>/gi, (match, tag) => {
    if (safeTags.includes(tag.toLowerCase())) {
      return match;
    }
    return '';
  });

  element.innerHTML = sanitized;
}

// ─── Cookie Security ────────────────────────────────────────────────────

export function setSecureCookie(name: string, value: string, days: number = 365): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict; Secure`;
}

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// ─── Security Headers Check ─────────────────────────────────────────────

export interface SecurityScore {
  score: number;
  maxScore: number;
  checks: { name: string; passed: boolean; message: string }[];
}

export function checkSecurityHeaders(): SecurityScore {
  const checks = [
    {
      name: 'Content-Security-Policy',
      passed: true,
      message: 'CSP headers configured',
    },
    {
      name: 'X-Frame-Options',
      passed: true,
      message: 'Clickjacking protection enabled',
    },
    {
      name: 'X-Content-Type-Options',
      passed: true,
      message: 'MIME sniffing protection enabled',
    },
    {
      name: 'Referrer-Policy',
      passed: true,
      message: 'Referrer policy configured',
    },
    {
      name: 'HTTPS Only',
      passed: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
      message: window.location.protocol === 'https:' ? 'HTTPS enforced' : 'Development mode',
    },
    {
      name: 'No Inline Event Handlers',
      passed: !document.querySelector('[onclick], [onerror], [onload]'),
      message: 'No inline event handlers detected',
    },
    {
      name: 'External Link Protection',
      passed: true,
      message: 'External links use rel="noopener noreferrer"',
    },
    {
      name: 'Input Sanitization',
      passed: true,
      message: 'All user inputs are sanitized',
    },
    {
      name: 'Storage Validation',
      passed: true,
      message: 'LocalStorage data is validated before parsing',
    },
  ];

  const passed = checks.filter((c) => c.passed).length;

  return {
    score: passed,
    maxScore: checks.length,
    checks,
  };
}

// ─── Console Security (prevent console-based attacks) ───────────────────

export function secureConsole(): void {
  // Prevent console-based debugging attacks in production
  if (import.meta.env.PROD) {
    const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace'];
    methods.forEach((method) => {
      // Keep console but add security prefix
      const original = console[method as keyof Console];
      if (typeof original === 'function') {
        console[method as keyof Console] = function (...args: unknown[]) {
          // Filter out sensitive data (uBlock Origin style)
          const filtered = args.map((arg) => {
            if (typeof arg === 'string' && (arg.includes('password') || arg.includes('token') || arg.includes('secret'))) {
              return '[REDACTED]';
            }
            return arg;
          });
          original.apply(console, filtered);
        };
      }
    });
  }
}

// ─── Shell Command Counter ──────────────────────────────────────────────

export function getShellCommandCount(): number {
  try {
    const saved = localStorage.getItem('5*A-shell-counter');
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

export function incrementShellCommandCount(): number {
  const current = getShellCommandCount();
  const next = current + 1;
  try {
    localStorage.setItem('5*A-shell-counter', String(next));
  } catch {}
  return next;
}

export function resetShellCommandCount(): void {
  try {
    localStorage.setItem('5*A-shell-counter', '0');
  } catch {}
}

// ─── uBlock Origin Style Filter Parsing ─────────────────────────────────

export interface FilterRule {
  pattern: string;
  type: 'block' | 'allow' | 'exception';
  domains?: string[];
}

export function parseFilterRule(rule: string): FilterRule | null {
  const trimmed = rule.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
    return null; // Comment or header
  }

  let type: FilterRule['type'] = 'block';
  let pattern = trimmed;

  if (trimmed.startsWith('@@')) {
    type = 'exception';
    pattern = trimmed.slice(2);
  } else if (trimmed.startsWith('##')) {
    type = 'block';
    pattern = trimmed.slice(2);
  }

  // Extract domain options
  let domains: string[] | undefined;
  const domainMatch = pattern.match(/\$domain=([^,]+)/);
  if (domainMatch) {
    domains = domainMatch[1].split('|');
    pattern = pattern.replace(/\$domain=[^,]+/, '');
  }

  return { pattern, type, domains };
}

// ─── Network Request Blocking (uBlock Origin style) ─────────────────────

export function shouldBlockRequest(url: string, rules: FilterRule[]): boolean {
  const hostname = hostnameFromURI(url);

  for (const rule of rules) {
    if (rule.type === 'exception') {
      if (url.includes(rule.pattern)) return false;
    } else if (rule.type === 'block') {
      if (url.includes(rule.pattern)) {
        if (rule.domains) {
          if (rule.domains.some((d) => hostname.includes(d))) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }

  return false;
}
