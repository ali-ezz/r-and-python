/**
 * 5A_Search — Advanced Student Search Page
 * Features: debounced input, multi-field filters, URL-synced params,
 * cursor pagination, results table, CSV export, search analytics display.
 */
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { searchApi } from '../lib/api';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'web-search' | 'monitoring' | 'users' | 'notes' | 'todo' | 'calendar' | 'audit-logs' | 'settings';

interface SearchResult {
  id: string; studentId?: string; firstName?: string; first_name?: string; lastName?: string; last_name?: string;
  department: string; enrollmentYear?: number; enrollment_year?: number; gpa: number; status: string;
  email?: string; user?: { email: string }; enrollmentCount?: number; _count?: { enrollments: number }; relevanceScore?: number;
}

interface SearchResponse {
  data: SearchResult[]; total: number; page: number; totalPages: number;
  query: string; durationMs: number; analytics: { hasResults: boolean; resultCount: number };
}

const BADGE: Record<string, string> = {
  ACTIVE:'badge-active',INACTIVE:'badge-inactive',GRADUATED:'badge-graduated',
  SUSPENDED:'badge-suspended',WITHDRAWN:'badge-withdrawn',
};

const DEPTS = ['','Computer Science','Engineering','Mathematics','Physics','Chemistry','Biology','Business Administration','Economics','English Literature','Psychology'];

function exportCsv(rows: SearchResult[]) {
  const headers = ['Student ID','First Name','Last Name','Department','Year','GPA','Status','Email','Courses'];
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map(r =>
    [r.studentId || r.id, r.firstName || r.first_name, r.lastName || r.last_name, r.department, r.enrollmentYear || r.enrollment_year, (r.gpa||0).toFixed(2), r.status, r.email || r.user?.email || '', r.enrollmentCount || r._count?.enrollments || 0].map(cell).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `students-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function SearchPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [gpaMin, setGpaMin] = useState('0');
  const [gpaMax, setGpaMax] = useState('4');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('relevance');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (params: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.students(params);
      setResults(Array.isArray(res) ? {
        data: res, total: res.length, page: 1, totalPages: 1, query: q, durationMs: 0, analytics: { hasResults: res.length > 0, resultCount: res.length }
      } : res);
    } catch {
      setResults(null);
      setError('Student search could not be loaded.');
    } finally { setLoading(false); }
  }, [q]);

  // Sync URL params
  useEffect(() => {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    if (department) url.searchParams.set('dept', department); else url.searchParams.delete('dept');
    window.history.replaceState({}, '', url.toString());
  }, [q, department]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params: Record<string, unknown> = { q, page, sort, gpaMin: parseFloat(gpaMin), gpaMax: parseFloat(gpaMax) };
      if (department) params.department = department;
      if (status) params.status = status;
      if (year) params.year = parseInt(year);
      doSearch(params);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, department, status, gpaMin, gpaMax, year, page, sort, doSearch]);

  const handleSort = (col: string) => { setSort(col); setPage(1); };
  const hasFilters = department || status || year || parseFloat(gpaMin) !== 0 || parseFloat(gpaMax) !== 4;

  return (
    <div className="max-w-6xl fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">5A Search</h1>
        <p className="text-[#666] text-sm mt-1">Advanced student search — fuzzy matching, filters, export</p>
      </div>

      {error && (
        <div className="mb-6 border border-[#F3B4B4] bg-[#FFF7F7] text-[#9B1C1C] text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Search bar */}
      <div className="search-input mb-4" style={{padding:'14px 20px'}}>
        <span className="text-[#999] text-lg">◎</span>
        <input
          id="search-input"
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by name, student ID, email, department..."
          className="flex-1 text-base"
          style={{border:'none',padding:0}}
          autoFocus
        />
        {q && <button onClick={() => { setQ(''); setPage(1); }} className="text-[#999] hover:text-black text-sm">✕</button>}
      </div>

      {/* Filter toggle + Export */}
      <div className="flex items-center gap-4 mb-6">
        <button
          className={`btn-ghost px-0 text-xs ${showFilters ? 'text-black' : 'text-[#666]'}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '▲' : '▼'} Filters {hasFilters && <span className="badge badge-admin ml-1">{[department,status,year].filter(Boolean).length + (parseFloat(gpaMin)!==0||parseFloat(gpaMax)!==4?1:0)}</span>}
        </button>
        {results && results.data.length > 0 && (
          <button className="btn-ghost px-0 text-xs text-[#C9A961]" onClick={() => exportCsv(results.data)}>
            ↓ Export CSV
          </button>
        )}
        {hasFilters && (
          <button className="btn-ghost px-0 text-xs" onClick={() => { setDepartment(''); setStatus(''); setYear(''); setGpaMin('0'); setGpaMax('4'); setPage(1); }}>
            ✕ Clear all
          </button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card mb-6 scale-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select value={department} onChange={e=>{setDepartment(e.target.value);setPage(1);}}>
                {DEPTS.map(d=><option key={d} value={d}>{d||'All'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
                <option value="">All</option>
                {['ACTIVE','INACTIVE','GRADUATED','SUSPENDED','WITHDRAWN'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group min-w-[120px]">
              <label className="form-label">Year</label>
              <input type="number" min="2000" max="2026" placeholder="2026" value={year} onChange={e=>{setYear(e.target.value);setPage(1);}} />
            </div>
            <div className="form-group">
              <label className="form-label">GPA Range: {gpaMin} – {gpaMax}</label>
              <div className="flex gap-2 items-center mt-2">
                <input type="range" min="0" max="4" step="0.1" value={gpaMin} onChange={e=>{setGpaMin(e.target.value);setPage(1);}} className="flex-1" style={{border:'none',padding:0}} />
                <input type="range" min="0" max="4" step="0.1" value={gpaMax} onChange={e=>{setGpaMax(e.target.value);setPage(1);}} className="flex-1" style={{border:'none',padding:0}} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort bar */}
      {results && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-[#999]">
            {loading ? 'Searching...' : `${results.total} results ${results.durationMs ? `(${results.durationMs}ms)` : ''}`}
          </div>
          <div className="flex gap-2">
            {['relevance','name','gpa','enrollmentYear'].map(s=>(
              <button key={s} onClick={()=>handleSort(s)}
                className={`text-xs px-3 py-1 border transition-all ${sort===s?'border-black bg-black text-white':'border-[#E5E5E5] text-[#666] hover:border-black'}`}>
                {s === 'enrollmentYear' ? 'Year' : s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading && !results ? (
        <div className="card p-0 overflow-hidden">
          <table className="data-table">
            <tbody>
              {Array.from({length:8}).map((_,i)=>(
                <tr key={i}>{Array.from({length:6}).map((_,j)=><td key={j}><div className="skeleton h-3 w-full"/></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !results || results.data.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4 text-[#E5E5E5]">◎</div>
          <div className="text-[#999] text-sm">{q ? `No students found for "${q}"` : 'Start typing to search students'}</div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden mb-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th><th>ID</th><th>Department</th><th>Year</th><th>GPA</th><th>Status</th><th>Courses</th>
              </tr>
            </thead>
            <tbody>
              {results.data.map(r => {
                const fname = String(r.firstName || r.first_name || '?');
                const lname = String(r.lastName || r.last_name || '?');
                const initials = (fname.charAt(0) + lname.charAt(0)).toUpperCase();

                return (
                <tr key={r.id} className="cursor-pointer glass-row" onClick={()=>navigate('student-detail', r.id)}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-xs font-medium text-[#666] relative">
                        {initials}
                        {(r.gpa || 0) < 2.5 && (r.status || 'ACTIVE') === 'ACTIVE' && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF4B2B] shadow-[0_0_8px_#FF4B2B] animate-pulse" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {q ? highlightMatch(`${fname} ${lname}`, q) : `${fname} ${lname}`}
                          {(r.gpa || 0) < 2.5 && (r.status || 'ACTIVE') === 'ACTIVE' && <span className="ai-risk-badge scale-in">Risk</span>}
                        </div>
                        <div className="text-[11px] text-[#999]">{r.email || r.user?.email || 'No Email Provided'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] font-mono text-[#C9A961]">{r.studentId || (r.id ? r.id.split('-')[0] : 'N/A')}</td>
                  <td className="text-sm text-[#666]">{r.department}</td>
                  <td className="text-sm">{r.enrollmentYear || r.enrollment_year}</td>
                  <td>
                    <span className="text-sm font-semibold" style={{color:(r.gpa||0)>=3.5?'#2D6A4F':(r.gpa||0)>=2.5?'#C9A961':'#9B1C1C'}}>
                      {(r.gpa||0).toFixed(2)}
                    </span>
                  </td>
                  <td><span className={`badge ${BADGE[r.status||'ACTIVE']??'badge-inactive'}`}>{r.status||'ACTIVE'}</span></td>
                  <td className="text-sm text-[#999]">{r.enrollmentCount || r._count?.enrollments || 0}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {results && results.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#999]">Page {page} of {results.totalPages}</div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-4" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <button className="btn-secondary text-xs py-2 px-4" disabled={page>=results.totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Highlights matched substring in result text */
function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#C9A961]/20 text-[#B8943A]">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
