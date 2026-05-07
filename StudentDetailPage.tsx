import { useState, useEffect, useCallback } from 'react';
import { studentsApi } from '../lib/api';
import { useIsAdmin } from '../store/authStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring';

interface Student {
  id: string;
  studentId?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  department: string;
  enrollmentYear?: number | string;
  enrollment_year?: number | string;
  gpa?: number;
  status?: string;
  user?: { email: string };
  email?: string;
  _count?: { enrollments: number };
}

interface StudentCreateForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
  enrollmentYear: string;
  gpa: string;
}

const EMPTY_STUDENT_FORM: StudentCreateForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  department: 'Computer Science',
  enrollmentYear: '2026',
  gpa: '0',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active',
  INACTIVE: 'badge-inactive',
  GRADUATED: 'badge-graduated',
  SUSPENDED: 'badge-suspended',
  WITHDRAWN: 'badge-withdrawn',
};

const DEPARTMENTS = [
  '', 'Computer Science', 'Engineering', 'Mathematics', 'Physics',
  'Chemistry', 'Biology', 'Business Administration', 'Economics',
  'English Literature', 'Psychology',
];

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function StudentsPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const isAdmin = useIsAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<StudentCreateForm>(EMPTY_STUDENT_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // 2026 Features
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15, sort, order };
      if (department) params.department = department;
      if (status) params.status = status;
      const res = await studentsApi.list(params);
      setStudents(Array.isArray(res) ? res : (res.data || []));
      setTotal(Array.isArray(res) ? res.length : (res.total || 0));
      setTotalPages(Array.isArray(res) ? 1 : (res.totalPages || 1));
    } catch { /* handled by interceptor */ }
    finally { setLoading(false); }
  }, [page, department, status, sort, order]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleSort = (col: string) => {
    if (sort === col) setOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setOrder('asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map(s => s.id)));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await studentsApi.delete(deleteId);
    setDeleteId(null);
    setDeleting(false);
    fetchStudents();
  };

  const handleCreateStudent = async () => {
    setCreating(true);
    setError('');
    try {
      await studentsApi.create({
        email: createForm.email.trim(),
        password: createForm.password,
        first_name: createForm.firstName.trim(),
        last_name: createForm.lastName.trim(),
        department: createForm.department,
        enrollment_year: createForm.enrollmentYear,
        gpa: Number.parseFloat(createForm.gpa) || 0,
      });
      setCreateForm(EMPTY_STUDENT_FORM);
      setShowCreate(false);
      fetchStudents();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create student');
    } finally {
      setCreating(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Students Directory", 14, 20);
    
    const tableData = students.map(s => [
      `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`,
      s.studentId || (s.id ? s.id.split('-')[0] : 'N/A'),
      s.department || '',
      (s.enrollmentYear || s.enrollment_year || '').toString(),
      (s.gpa || 0).toFixed(2),
      s.status || 'ACTIVE'
    ]);

    autoTable(doc, {
      head: [['Name', 'ID', 'Department', 'Year', 'GPA', 'Status']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.save("students-directory.pdf");
  };

  const SortIcon = ({ col }: { col: string }) =>
    sort === col ? <span className="text-[#999]">{order === 'asc' ? ' ↑' : ' ↓'}</span> : null;

  return (
    <div className="max-w-7xl fade-in pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
          <p className="text-[#666] text-sm mt-1">{total} records</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="view-toggle mr-2">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>☰ Table</button>
            <button className={viewMode === 'board' ? 'active' : ''} onClick={() => setViewMode('board')}>◫ Board</button>
          </div>
          <button className="btn-secondary" onClick={handleExportPDF}>
            Export PDF
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Add Student
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-[#FEE2E2] text-[#9B1C1C] border border-[#9B1C1C] text-sm scale-in">
          {error}
          <button className="ml-4 underline" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-[#E5E5E5]">
        <div className="form-group min-w-[180px]">
          <label className="form-label">Department</label>
          <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1); }}
            className="text-sm py-2">
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d || 'All departments'}</option>)}
          </select>
        </div>

        <div className="form-group min-w-[140px]">
          <label className="form-label">Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="text-sm py-2">
            <option value="">All statuses</option>
            {['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {(department || status) && (
          <button
            className="btn-ghost self-end mb-1"
            onClick={() => { setDepartment(''); setStatus(''); setPage(1); }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Data View */}
      {viewMode === 'board' ? (
        <div className="kanban-board fade-in">
          {['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN'].map(colStatus => (
            <div key={colStatus} className="kanban-col slide-up">
              <div className="p-4 border-b border-[#E5E5E5] flex justify-between items-center bg-white">
                <span className="text-xs font-semibold tracking-widest text-[#666]">{colStatus}</span>
                <span className="text-xs text-[#999]">{students.filter(s => (s.status || 'ACTIVE') === colStatus).length}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto scrollbar-hide">
                {students.filter(s => (s.status || 'ACTIVE') === colStatus).map(student => {
                  const fname = String(student.firstName || student.first_name || '?');
                  const lname = String(student.lastName || student.last_name || '?');
                  const isAtRisk = (student.gpa || 0) < 2.5 && colStatus === 'ACTIVE';

                  return (
                    <div key={student.id} className="kanban-card scale-in" onClick={() => navigate('student-detail', student.id)}>
                      {isAtRisk && <div className="absolute -top-2 -right-2 ai-risk-badge">AT RISK</div>}
                      <div className="text-sm font-medium mb-1">{fname} {lname}</div>
                      <div className="text-xs text-[#999] font-mono mb-3">{student.studentId || (student.id ? student.id.split('-')[0] : 'N/A')}</div>
                      <div className="flex justify-between items-center mt-4 border-t border-[#F5F5F5] pt-3">
                        <span className="text-xs text-[#666]">{student.department}</span>
                        <span className="text-xs font-semibold" style={{color: (student.gpa || 0) >= 3.5 ? '#2D6A4F' : (student.gpa || 0) >= 2.5 ? '#C9A961' : '#9B1C1C'}}>GPA {(student.gpa || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="card p-0 overflow-hidden mb-6 fade-in">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: 40}}>
                  <input type="checkbox" className="checkbox-custom" checked={students.length > 0 && selectedIds.size === students.length} onChange={toggleSelectAll} />
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('name')}>
                  Student <SortIcon col="name" />
                </th>
                <th>ID</th>
                <th>Department</th>
                <th className="cursor-pointer" onClick={() => handleSort('enrollmentYear')}>
                  Year <SortIcon col="enrollmentYear" />
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('gpa')}>
                  GPA <SortIcon col="gpa" />
                </th>
                <th>Status</th>
                <th>Courses</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#999] text-sm">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const fname = String(student.firstName || student.first_name || '?');
                  const lname = String(student.lastName || student.last_name || '?');
                  const initials = (fname.charAt(0) + lname.charAt(0)).toUpperCase();
                  const isSelected = selectedIds.has(student.id);
                  const isAtRisk = (student.gpa || 0) < 2.5 && (student.status || 'ACTIVE') === 'ACTIVE';

                  return (
                  <tr key={student.id} className={`cursor-pointer glass-row ${isSelected ? 'bg-[#FAFAFA]' : ''}`}
                    onClick={() => navigate('student-detail', student.id)}>
                    <td onClick={e => e.stopPropagation()}>
                       <input type="checkbox" className="checkbox-custom" checked={isSelected} onChange={() => toggleSelect(student.id)} />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-xs font-medium text-[#666] flex-shrink-0 relative">
                          {initials}
                          {isAtRisk && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF4B2B] shadow-[0_0_8px_#FF4B2B] animate-pulse" title="High Risk" />}
                        </div>
                        <div>
                          <div className="font-medium text-[#1A1A1A] text-sm flex items-center gap-2">
                            {fname} {lname}
                            {isAtRisk && <span className="ai-risk-badge scale-in">Risk</span>}
                          </div>
                          <div className="text-[11px] text-[#999]">{student.user?.email || student.email || 'No Email Provided'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-[12px] text-[#666] font-mono">{student.studentId || (student.id ? student.id.split('-')[0] : 'N/A')}</td>
                    <td className="text-sm text-[#666]">{student.department}</td>
                    <td className="text-sm">{student.enrollmentYear || student.enrollment_year}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-[#F5F5F5] overflow-hidden">
                          <div
                            className="h-full transition-all duration-1000"
                            style={{ width: `${((student.gpa || 0) / 4) * 100}%`, background: (student.gpa || 0) >= 3.5 ? '#2D6A4F' : (student.gpa || 0) >= 2.5 ? '#C9A961' : '#9B1C1C' }}
                          />
                        </div>
                        <span className="text-sm font-medium">{(student.gpa || 0).toFixed(2)}</span>
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <span className={`badge ${STATUS_BADGE[student.status || 'ACTIVE'] ?? 'badge-inactive'}`}>
                        {student.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="text-sm text-[#999]">{student._count?.enrollments || 0}</td>
                    <td onClick={e => e.stopPropagation()} className="relative">
                      <button className="context-menu-trigger" onClick={() => setActionMenuId(actionMenuId === student.id ? null : student.id)}>
                        ⋮
                      </button>
                      {actionMenuId === student.id && (
                        <div className="absolute right-8 top-0 bg-white border border-[#E5E5E5] shadow-xl z-20 py-1 min-w-[140px] slide-up">
                          <div className="px-3 py-2 text-xs hover:bg-[#FAFAFA] cursor-pointer" onClick={() => { setActionMenuId(null); navigate('student-detail', student.id); }}>View Profile</div>
                          <div className="px-3 py-2 text-xs hover:bg-[#FAFAFA] cursor-pointer" onClick={() => { setActionMenuId(null); window.location.href = `mailto:${student.user?.email || student.email || ''}`; }}>Email Student</div>
                          {isAdmin && (
                            <div className="px-3 py-2 text-xs hover:bg-[#FEE2E2] text-[#9B1C1C] cursor-pointer" onClick={() => { setActionMenuId(null); setDeleteId(student.id); }}>Delete</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#999]">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs py-2 px-4"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn-secondary text-xs py-2 px-4"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-sm w-full mx-4 scale-in">
            <h3 className="font-semibold text-lg mb-3">Delete Student</h3>
            <p className="text-[#666] text-sm mb-6">
              This action cannot be undone. All enrollments and grades will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button className="btn-danger flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Student Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-2xl w-full mx-4 scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Add Student</h3>
                <p className="text-xs text-[#999]">Create a student account and academic profile</p>
              </div>
              <button className="text-[#999] hover:text-black text-lg" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" value={createForm.email} onChange={e=>setCreateForm(f=>({...f,email:e.target.value}))} placeholder="student@sms.edu" />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input type="password" value={createForm.password} onChange={e=>setCreateForm(f=>({...f,password:e.target.value}))} placeholder="Password1" />
              </div>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input value={createForm.firstName} onChange={e=>setCreateForm(f=>({...f,firstName:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input value={createForm.lastName} onChange={e=>setCreateForm(f=>({...f,lastName:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select value={createForm.department} onChange={e=>setCreateForm(f=>({...f,department:e.target.value}))}>
                  {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Enrollment Year</label>
                <input value={createForm.enrollmentYear} onChange={e=>setCreateForm(f=>({...f,enrollmentYear:e.target.value}))} maxLength={4} />
              </div>
              <div className="form-group">
                <label className="form-label">GPA</label>
                <input type="number" min="0" max="4" step="0.01" value={createForm.gpa} onChange={e=>setCreateForm(f=>({...f,gpa:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                onClick={handleCreateStudent}
                disabled={creating || !createForm.email.trim() || !createForm.password || !createForm.firstName.trim() || !createForm.lastName.trim()}
              >
                {creating ? 'Creating...' : 'Create Student'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      <div className={`floating-action-bar ${selectedIds.size > 0 ? 'visible' : ''}`}>
        <div className="text-sm font-medium pr-4 border-r border-[#E5E5E5]">
          <span className="bg-black text-white px-2 py-0.5 rounded-full text-xs mr-2">{selectedIds.size}</span>
          Selected
        </div>
        <button className="btn-ghost text-xs" onClick={() => setSelectedIds(new Set())}>Deselect All</button>
        <button className="btn-secondary py-2 text-xs" onClick={handleExportPDF}>Bulk Export</button>
        {isAdmin && <button className="btn-danger py-2 text-xs">Bulk Delete</button>}
      </div>
    </div>
  );
}
