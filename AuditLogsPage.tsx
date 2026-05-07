/**
 * @fileoverview Admin User Management page — full CRUD, role changes,
 * user activation/deactivation, search, and user profile cards.
 */

import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring' | 'users' | 'audit-logs';

interface UserData {
  id: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  gpa?: number;
  enrollmentYear?: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type AccountRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

interface AccountForm {
  email: string;
  password: string;
  fullName: string;
  role: AccountRole;
  isActive: boolean;
  firstName: string;
  lastName: string;
  department: string;
  enrollmentYear: string;
  gpa: string;
}

const EMPTY_ACCOUNT_FORM: AccountForm = {
  email: '',
  password: '',
  fullName: '',
  role: 'INSTRUCTOR',
  isActive: true,
  firstName: '',
  lastName: '',
  department: '',
  enrollmentYear: '2026',
  gpa: '0',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ADMIN:      { bg: '#1A1A1A', text: '#FFFFFF', border: '#1A1A1A' },
  INSTRUCTOR: { bg: '#1E3A5F', text: '#FFFFFF', border: '#1E3A5F' },
  STUDENT:    { bg: '#F5F5F5', text: '#1A1A1A', border: '#E5E5E5' },
};

export default function UsersPage({ navigate }: { navigate: (r: Route, id?: string) => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(EMPTY_ACCOUNT_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<AccountForm>(EMPTY_ACCOUNT_FORM);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.getUsers();
      setUsers(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Filtering
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'ALL' && u.role !== filterRole) return false;
    if (filterStatus === 'ACTIVE' && !u.isActive) return false;
    if (filterStatus === 'INACTIVE' && u.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const totalActive = users.filter(u => u.isActive).length;
  const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
  const totalStudents = users.filter(u => u.role === 'STUDENT').length;
  const totalInstructors = users.filter(u => u.role === 'INSTRUCTOR').length;

  const openEdit = (u: UserData) => {
    setEditUser(u);
    setEditForm({
      email: u.email,
      password: '',
      fullName: u.fullName || '',
      role: u.role as AccountRole,
      isActive: u.isActive,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      department: u.department || '',
      enrollmentYear: u.enrollmentYear || '2026',
      gpa: String(u.gpa ?? 0),
    });
  };

  const buildAccountPayload = (form: AccountForm, includePassword: boolean) => {
    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      full_name: form.fullName.trim(),
      role: form.role,
      is_active: form.isActive,
    };
    if (includePassword) payload.password = form.password;
    if (form.role === 'STUDENT') {
      payload.first_name = form.firstName.trim() || form.fullName.trim().split(' ')[0] || 'New';
      payload.last_name = form.lastName.trim() || form.fullName.trim().split(' ').slice(1).join(' ') || 'Student';
      payload.department = form.department.trim() || 'Undecided';
      payload.enrollment_year = form.enrollmentYear || '2026';
      payload.gpa = Number.parseFloat(form.gpa) || 0;
    }
    return payload;
  };

  const handleCreateUser = async () => {
    setCreating(true);
    setError(null);
    try {
      await authApi.createUser(buildAccountPayload(createForm, true));
      setShowCreate(false);
      setCreateForm(EMPTY_ACCOUNT_FORM);
      setSuccessMsg('User created successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await authApi.updateUser(editUser.id, buildAccountPayload(editForm, false));
      setEditUser(null);
      setSuccessMsg('User updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await authApi.deleteUser(deleteConfirm.id);
      setDeleteConfirm(null);
      setSuccessMsg('User deleted permanently');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-7xl fade-in pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">User Management</h1>
          <p className="text-[#666] text-sm mt-1">
            {users.length} accounts · {totalActive} active
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Account
        </button>
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div className="mb-6 px-4 py-3 bg-[#D8F3DC] border border-[#2D6A4F] text-[#2D6A4F] text-sm scale-in flex items-center gap-2">
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card slide-up bg-black text-white border-black">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase mb-2 text-[#666]">Total Users</div>
          <div className="text-3xl font-semibold">{users.length}</div>
          <div className="text-xs text-[#666] mt-1">{totalActive} active</div>
        </div>
        <div className="card slide-up">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase mb-2 text-[#999]">Admins</div>
          <div className="text-3xl font-semibold text-[#1A1A1A]">{totalAdmins}</div>
          <div className="text-xs text-[#999] mt-1">System administrators</div>
        </div>
        <div className="card slide-up">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase mb-2 text-[#999]">Instructors</div>
          <div className="text-3xl font-semibold text-[#1A1A1A]">{totalInstructors}</div>
          <div className="text-xs text-[#999] mt-1">Teaching staff</div>
        </div>
        <div className="card slide-up">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase mb-2 text-[#999]">Students</div>
          <div className="text-3xl font-semibold text-[#1A1A1A]">{totalStudents}</div>
          <div className="text-xs text-[#999] mt-1">Enrolled accounts</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-[#E5E5E5]">
        <div className="form-group flex-1 min-w-[250px]">
          <label className="form-label">Search Users</label>
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="form-group min-w-[140px]">
          <label className="form-label">Role</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="text-sm py-2">
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="STUDENT">Student</option>
          </select>
        </div>
        <div className="form-group min-w-[140px]">
          <label className="form-label">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm py-2">
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[#FEE2E2] text-[#9B1C1C] border border-[#9B1C1C] text-sm scale-in">
          {error}
          <button className="ml-4 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Users Table */}
      <div className="card p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>GPA</th>
              <th>Status</th>
              <th>Joined</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton h-4 w-40" /></td>
                  <td><div className="skeleton h-4 w-16" /></td>
                  <td><div className="skeleton h-4 w-20" /></td>
                  <td><div className="skeleton h-4 w-10" /></td>
                  <td><div className="skeleton h-4 w-16" /></td>
                  <td><div className="skeleton h-4 w-20" /></td>
                  <td />
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[#999] text-sm">
                  No users found matching your criteria
                </td>
              </tr>
            ) : filteredUsers.map(u => {
              const displayName = u.fullName || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email.split('@')[0].split('.').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' '));
              const initials = displayName.split(' ').map((w: string) => w.charAt(0).toUpperCase()).join('').slice(0, 2);
              const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.STUDENT;
              const isExpanded = expandedId === u.id;
              const isSelf = currentUser?.id === u.id;

              return (
                <tr key={u.id} className={`glass-row ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(u.id)}>
                      <div
                        className="w-9 h-9 flex items-center justify-center text-xs font-semibold flex-shrink-0"
                        style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-[#1A1A1A] flex items-center gap-2">
                          {displayName}
                          {isSelf && <span className="text-[10px] px-1.5 py-0.5 bg-[#F5F5F5] text-[#999] border border-[#E5E5E5]">You</span>}
                        </div>
                        <div className="text-[11px] text-[#999]">{u.email}</div>
                        {isExpanded && u.firstName && (
                          <div className="text-[11px] text-[#666] mt-1">
                            Profile: {u.firstName} {u.lastName}
                            {u.enrollmentYear && ` · Class of ${u.enrollmentYear}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className="text-[10px] px-2.5 py-1 font-semibold tracking-wider uppercase"
                      style={{ background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}` }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="text-sm text-[#666]">{u.department || '—'}</td>
                  <td>
                    {u.gpa != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-1.5 bg-[#F5F5F5] overflow-hidden">
                          <div className="h-full" style={{ width: `${(u.gpa / 4) * 100}%`, background: u.gpa >= 3.5 ? '#2D6A4F' : u.gpa >= 2.5 ? '#C9A961' : '#9B1C1C' }} />
                        </div>
                        <span className="text-xs font-medium">{u.gpa.toFixed(2)}</span>
                      </div>
                    ) : <span className="text-[#999] text-xs">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="text-sm text-[#666]">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="text-[11px] px-2 py-1 border border-[#E5E5E5] hover:border-black transition-colors"
                        onClick={() => openEdit(u)}
                        title="Edit user"
                      >
                        Edit
                      </button>
                      {!isSelf && (
                        <button
                          className="text-[11px] px-2 py-1 border border-[#FEE2E2] text-[#9B1C1C] hover:bg-[#FEE2E2] transition-colors"
                          onClick={() => setDeleteConfirm(u)}
                          title="Delete user"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Showing count */}
      <div className="mt-4 text-xs text-[#999]">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* ─── Create User Modal ────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-2xl w-full mx-4 scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Create Account</h3>
                <p className="text-xs text-[#999]">Add an admin, instructor, or student user</p>
              </div>
              <button className="text-[#999] hover:text-black text-lg" onClick={() => setShowCreate(false)}>×</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="dr.ahmed@sms.edu"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 chars, 1 uppercase, 1 number"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Dr. Ahmed Hassan"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as AccountRole }))}
                >
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="STUDENT">Student</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {createForm.role === 'STUDENT' && (
              <div className="mt-5 p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-4">Student Profile</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input value={createForm.department} onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))} placeholder="Computer Science" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enrollment Year</label>
                    <input value={createForm.enrollmentYear} onChange={(e) => setCreateForm((f) => ({ ...f, enrollmentYear: e.target.value }))} maxLength={4} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GPA</label>
                    <input type="number" min="0" max="4" step="0.01" value={createForm.gpa} onChange={(e) => setCreateForm((f) => ({ ...f, gpa: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1 text-xs"
                onClick={handleCreateUser}
                disabled={creating || !createForm.email.trim() || !createForm.password}
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
              <button className="btn-secondary flex-1 text-xs" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit User Modal ──────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-2xl w-full mx-4 scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 flex items-center justify-center text-sm font-semibold"
                style={{ background: ROLE_COLORS[editUser.role]?.bg, color: ROLE_COLORS[editUser.role]?.text }}
              >
                {(editUser.fullName || editUser.email).split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="font-semibold text-lg">Edit User</h3>
                <p className="text-xs text-[#999]">{editUser.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as AccountRole }))}
                >
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="form-label mb-0">Account Status</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isActive ? 'bg-[#2D6A4F]' : 'bg-[#E5E5E5]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-[#666]">{editForm.isActive ? 'Active' : 'Disabled'}</span>
              </div>

              {(editForm.role === 'STUDENT' || editUser.firstName) && (
                <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
                  <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">Student Profile</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label">First Name</label>
                      <input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name</label>
                      <input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <input value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Year</label>
                      <input value={editForm.enrollmentYear} onChange={(e) => setEditForm((f) => ({ ...f, enrollmentYear: e.target.value }))} maxLength={4} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GPA</label>
                      <input type="number" min="0" max="4" step="0.01" value={editForm.gpa} onChange={(e) => setEditForm((f) => ({ ...f, gpa: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1 text-xs" onClick={handleSaveUser} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn-secondary flex-1 text-xs" onClick={() => setEditUser(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-sm w-full mx-4 scale-in">
            <h3 className="font-semibold text-lg mb-2">Delete User</h3>
            <p className="text-[#666] text-sm mb-2">
              Are you sure you want to permanently delete this user?
            </p>
            <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] mb-4 text-sm">
              <div className="font-medium">{deleteConfirm.fullName || deleteConfirm.email}</div>
              <div className="text-xs text-[#999]">{deleteConfirm.email} · {deleteConfirm.role}</div>
            </div>
            <p className="text-xs text-[#9B1C1C] mb-6">
              ⚠ This action cannot be undone. The user's student profile and all associated data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button className="btn-danger flex-1" onClick={handleDeleteUser} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
