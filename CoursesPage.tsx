import { useState, useEffect } from 'react';
import { studentsApi, coursesApi } from '../lib/api';
import { useIsAdmin, useIsInstructor } from '../store/authStore';

type Route = 'dashboard' | 'students' | 'student-detail' | 'courses' | 'search' | 'monitoring';

interface Grade { id: string; value: number; letterGrade: string; }
interface Enrollment {
  id: string; status: string;
  course: { id: string; code: string; name: string; credits: number; };
  grade: Grade | null;
}
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
  phoneNumber?: string;
  bio?: string;
  user?: { email: string; role: string };
  email?: string;
  enrollments?: Enrollment[];
  _count?: { enrollments: number };
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active', INACTIVE: 'badge-inactive', GRADUATED: 'badge-graduated',
  SUSPENDED: 'badge-suspended', WITHDRAWN: 'badge-withdrawn',
};

export default function StudentDetailPage({ studentId, navigate }: { studentId: string; navigate: (r: Route) => void }) {
  const isAdmin = useIsAdmin();
  const isStaff = useIsInstructor();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [gradeModal, setGradeModal] = useState<{ enrollmentId: string; courseName: string } | null>(null);
  const [gradeData, setGradeData] = useState({ value: '3.0', letterGrade: 'B' });

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const data = await studentsApi.get(studentId);
      setStudent(data);
      setEditData({
        firstName: data.firstName ?? data.first_name ?? '',
        lastName: data.lastName ?? data.last_name ?? '',
        department: data.department ?? '',
        status: data.status ?? 'ACTIVE',
        gpa: String(data.gpa ?? 0),
        bio: data.bio ?? '',
        phoneNumber: data.phoneNumber ?? '',
      });
    } catch { navigate('students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudent(); }, [studentId]);

  const handleSave = async () => {
    setSaving(true);
    await studentsApi.update(studentId, {
      first_name: editData.firstName,
      last_name: editData.lastName,
      department: editData.department,
      gpa: parseFloat(editData.gpa),
    });
    setSaving(false); setEditing(false); fetchStudent();
  };

  const handleGrade = async () => {
    if (!gradeModal) return;
    await coursesApi.grade(gradeModal.enrollmentId, { value: parseFloat(gradeData.value), letterGrade: gradeData.letterGrade });
    setGradeModal(null); fetchStudent();
  };

  const gpaColor = (g: number) => g >= 3.5 ? '#2D6A4F' : g >= 2.5 ? '#C9A961' : '#9B1C1C';

  if (loading) return <div className="fade-in"><div className="skeleton h-4 w-24 mb-8" /><div className="card"><div className="skeleton h-20 w-full mb-4" /></div></div>;
  if (!student) return null;

  return (
    <div className="max-w-4xl fade-in">
      <button className="btn-ghost mb-8 px-0 text-xs" onClick={() => navigate('students')}>← Back to Students</button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="card">
          <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-xl font-semibold mb-5">
            {(String(student.firstName || student.first_name || '?').charAt(0) + String(student.lastName || student.last_name || '?').charAt(0)).toUpperCase()}
          </div>
          {editing ? (
            <div className="space-y-4">
              {['firstName','lastName'].map(f => (
                <div key={f} className="form-group">
                  <label className="form-label">{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                  <input type="text" value={editData[f]??''} onChange={e=>setEditData(d=>({...d,[f]:e.target.value}))} />
                </div>
              ))}
              <div className="form-group">
                 <label className="form-label">Status</label>
                 <select value={editData.status??''} onChange={e=>setEditData(d=>({...d,status:e.target.value}))}>
                   {['ACTIVE','INACTIVE','GRADUATED','SUSPENDED','WITHDRAWN'].map(s=><option key={s} value={s}>{s}</option>)}
                 </select>
               </div>
               <div className="form-group">
                 <label className="form-label">GPA (0–4.0)</label>
                 <input type="number" step="0.01" min="0" max="4" value={editData.gpa??''} onChange={e=>setEditData(d=>({...d,gpa:e.target.value}))} />
               </div>
               <div className="flex gap-2 mt-4">
                 <button className="btn-primary flex-1 text-xs py-2" onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save'}</button>
                 <button className="btn-secondary flex-1 text-xs py-2" onClick={()=>setEditing(false)}>Cancel</button>
               </div>
             </div>
           ) : (
             <>
               <h2 className="text-lg font-semibold">{student.firstName || student.first_name} {student.lastName || student.last_name}</h2>
               <div className="text-xs text-[#999] mt-1">{student.user?.email || student.email || 'No Email Provided'}</div>
               <div className="text-xs font-mono text-[#C9A961] mt-2">{student.studentId || (student.id ? student.id.split('-')[0] : 'N/A')}</div>
               <div className="mt-5 space-y-3 border-t border-[#F5F5F5] pt-5">
                 {[['Department', student.department],['Year', String(student.enrollmentYear || student.enrollment_year)],['Phone', student.phoneNumber??'—']].map(([l,v])=>(
                   <div key={l}><div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">{l}</div><div className="text-sm mt-0.5">{v}</div></div>
                 ))}
                 <div><div className="text-[10px] text-[#999] uppercase tracking-[0.07em]">Status</div><span className={`badge mt-1 ${STATUS_BADGE[student.status || 'ACTIVE'] ?? 'badge-inactive'}`}>{student.status || 'ACTIVE'}</span></div>
                 <div>
                   <div className="text-[10px] text-[#999] uppercase tracking-[0.07em] mb-1">GPA</div>
                   <div className="flex items-center gap-2">
                     <div className="h-2 flex-1 bg-[#F5F5F5]"><div className="h-2" style={{width:`${((student.gpa || 0)/4)*100}%`,background:gpaColor(student.gpa || 0)}} /></div>
                     <span className="text-sm font-semibold" style={{color:gpaColor(student.gpa || 0)}}>{(student.gpa || 0).toFixed(2)}</span>
                   </div>
                 </div>
               </div>
              {(isAdmin||isStaff) && <button className="btn-secondary w-full mt-5 text-xs py-2" onClick={()=>setEditing(true)}>Edit Profile</button>}
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-6">
          {student.bio && <div className="card"><div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">About</div><p className="text-sm text-[#666] leading-relaxed">{student.bio}</p></div>}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F5F5F5]"><div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999]">Courses & Grades ({student._count?.enrollments || 0})</div></div>
            {!(student.enrollments && student.enrollments.length > 0)
              ? <div className="px-5 py-8 text-center text-[#999] text-sm">No enrollments yet</div>
              : <table className="data-table">
                  <thead><tr><th>Course</th><th>Credits</th><th>Status</th><th>Grade</th>{isStaff&&<th/>}</tr></thead>
                  <tbody>
                    {(student.enrollments || []).map(en=>(
                      <tr key={en.id}>
                        <td><div className="font-medium text-sm">{en.course.name}</div><div className="text-[11px] text-[#999] font-mono">{en.course.code}</div></td>
                        <td className="text-sm">{en.course.credits}</td>
                        <td><span className={`badge ${en.status==='ENROLLED'?'badge-enrolled':en.status==='COMPLETED'?'badge-graduated':'badge-dropped'}`}>{en.status}</span></td>
                        <td>{en.grade?<span className="text-sm font-semibold" style={{color:gpaColor(en.grade.value)}}>{en.grade.letterGrade} ({en.grade.value.toFixed(1)})</span>:<span className="text-[#999] text-xs">—</span>}</td>
                        {isStaff&&<td><button className="text-xs text-[#666] hover:text-black" onClick={()=>setGradeModal({enrollmentId:en.id,courseName:en.course.name})}>{en.grade?'Edit':'Add grade'}</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>
      </div>

      {/* Grade Modal */}
      {gradeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="card max-w-sm w-full mx-4 scale-in">
            <h3 className="font-semibold mb-1">{gradeModal.courseName}</h3>
            <p className="text-xs text-[#999] mb-5">Assign grade</p>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Letter Grade</label>
                <select value={gradeData.letterGrade} onChange={e=>setGradeData(d=>({...d,letterGrade:e.target.value}))}>
                  {['A+','A','A-','B+','B','B-','C+','C','C-','D','F'].map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">GPA Points (0–4.0)</label>
                <input type="number" step="0.1" min="0" max="4" value={gradeData.value} onChange={e=>setGradeData(d=>({...d,value:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1 text-xs" onClick={handleGrade}>Save Grade</button>
              <button className="btn-secondary flex-1 text-xs" onClick={()=>setGradeModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
