import { useState, useEffect, type FormEvent } from 'react';
import { coursesApi } from '../lib/api';
import { useIsInstructor } from '../store/authStore';

interface Course {
  id: string; code: string; name: string; description?: string;
  credits: number; department: string; maxCapacity: number; isActive?: boolean;
  instructor?: { firstName: string; lastName: string } | null;
  _count?: { enrollments: number };
  enrollmentCount?: number;
}

function getEnrollmentCount(course: Course) {
  return course._count?.enrollments ?? course.enrollmentCount ?? 0;
}

export default function CoursesPage() {
  const isStaff = useIsInstructor();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', credits: '3', department: '', maxCapacity: '30' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchCourses = async () => {
    setLoading(true);
    setError('');
    try {
      setCourses(await coursesApi.list());
    } catch {
      setError('Courses could not be loaded.');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await coursesApi.create({ ...form, credits: parseInt(form.credits), maxCapacity: parseInt(form.maxCapacity) });
      setShowForm(false);
      setForm({ code: '', name: '', description: '', credits: '3', department: '', maxCapacity: '30' });
      fetchCourses();
    } catch {
      setError('Course could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = courses.filter(c =>
    String(c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(c.code || '').toLowerCase().includes(search.toLowerCase()) ||
    String(c.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
          <p className="text-[#666] text-sm mt-1">{courses.length} courses available</p>
        </div>
        {isStaff && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ New Course'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 border border-[#F3B4B4] bg-[#FFF7F7] text-[#9B1C1C] text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card mb-8 scale-in">
          <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-5">New Course</div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-6">
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input type="text" placeholder="CS101" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Course Name *</label>
              <input type="text" placeholder="Introduction to Programming" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Department *</label>
              <input type="text" placeholder="Computer Science" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Credits</label>
              <input type="number" min="1" max="6" value={form.credits} onChange={e=>setForm(f=>({...f,credits:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Capacity</label>
              <input type="number" min="1" value={form.maxCapacity} onChange={e=>setForm(f=>({...f,maxCapacity:e.target.value}))} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Description</label>
              <textarea placeholder="Course description..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} />
            </div>
            <div className="col-span-2">
              <button type="submit" className="btn-primary text-xs" disabled={saving}>{saving ? 'Creating...' : 'Create Course'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="search-input mb-6">
        <span className="text-[#999]">◎</span>
        <input type="text" placeholder="Search courses..." value={search} onChange={e=>setSearch(e.target.value)} style={{border:'none',paddingBottom:0}} />
      </div>

      {/* Courses grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="card">
              <div className="skeleton h-3 w-16 mb-4" />
              <div className="skeleton h-5 w-3/4 mb-2" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#999] text-sm">No courses found</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(course => (
            <div key={course.id} className="card hover:border-[#D0D0D0] slide-up group">
              <div className="flex items-start justify-between mb-3">
                <div className="text-xs font-mono text-[#C9A961] font-medium">{course.code}</div>
                <span className={`badge ${course.isActive !== false ? 'badge-active' : 'badge-inactive'}`}>
                  {course.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="font-semibold text-[#1A1A1A] text-sm leading-snug mb-2">{course.name}</h3>
              {course.description && <p className="text-xs text-[#999] line-clamp-2 mb-3">{course.description}</p>}
              <div className="border-t border-[#F5F5F5] pt-3 flex items-center justify-between text-xs text-[#999]">
                <span>{course.department}</span>
                <span>{course.credits} credits</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-[#999]">
                <span>{getEnrollmentCount(course)}/{course.maxCapacity} enrolled</span>
                {course.instructor && <span>{course.instructor.firstName} {course.instructor.lastName}</span>}
              </div>
              {/* Capacity bar */}
              <div className="mt-3 h-1 bg-[#F5F5F5]">
                <div className="h-1 bg-black transition-all" style={{width:`${Math.min((getEnrollmentCount(course)/course.maxCapacity)*100,100)}%`}} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
