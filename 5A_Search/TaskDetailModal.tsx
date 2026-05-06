/**
 * @fileoverview Task detail modal — edit task, manage subtasks, comments, attachments.
 */
import { useState } from 'react';
import { useTodoStore, PRIORITY_CONFIG, STATUS_CONFIG, type Priority, type TaskStatus, type Todo } from '../store/todoStore';
import { useNotesStore } from '../store/notesStore';

export default function TaskDetailModal({ task, onClose }: { task: Todo; onClose: () => void }) {
  const { updateTodo, setStatus, addSubtask, toggleSubtask, deleteSubtask, addComment, deleteComment, addAttachment, deleteAttachment, linkNote, deleteTodo } = useTodoStore();
  const { notes } = useNotesStore();
  const [tab, setTab] = useState<'details' | 'subtasks' | 'comments' | 'attachments'>('details');
  const [edit, setEdit] = useState({ title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate ?? '', tags: task.tags.join(', ') });
  const [newSub, setNewSub] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newAttName, setNewAttName] = useState('');
  const [newAttUrl, setNewAttUrl] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const save = () => {
    updateTodo(task.id, { title: edit.title, description: edit.description, priority: edit.priority, dueDate: edit.dueDate || null, tags: edit.tags.split(',').map((t) => t.trim()).filter(Boolean) });
    onClose();
  };

  const stDone = task.subtasks.filter((s) => s.completed).length;
  const stPct = task.subtasks.length > 0 ? Math.round((stDone / task.subtasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E5E5E5] w-full max-w-2xl max-h-[85vh] flex flex-col slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-3">
            {(['todo','in-progress','done','archived'] as TaskStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(task.id, s)}
                className={`px-2 py-1 text-[10px] font-medium uppercase border transition-all ${task.status === s ? 'text-white border-transparent' : 'border-[#E5E5E5] text-[#999] hover:border-black'}`}
                style={task.status === s ? { background: STATUS_CONFIG[s].color } : {}}
              >{STATUS_CONFIG[s].label}</button>
            ))}
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-black text-lg">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E5E5]">
          {(['details','subtasks','comments','attachments'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs capitalize ${tab === t ? 'text-black border-b-2 border-black font-medium' : 'text-[#999] hover:text-black'}`}
            >{t}{t === 'subtasks' && task.subtasks.length > 0 ? ` (${stDone}/${task.subtasks.length})` : t === 'comments' && task.comments.length > 0 ? ` (${task.comments.length})` : t === 'attachments' && task.attachments.length > 0 ? ` (${task.attachments.length})` : ''}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'details' && (
            <div className="space-y-4">
              <input type="text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Task title" className="text-lg font-medium" />
              <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Description..." rows={3} className="resize-none" style={{ borderBottom: '1px solid #E5E5E5' }} />
              <div>
                <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Priority</span>
                <div className="flex gap-2">
                  {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG['low']][]).map(([k, c]) => (
                    <button key={k} onClick={() => setEdit({ ...edit, priority: k })}
                      className="px-3 py-1.5 text-xs border transition-all"
                      style={edit.priority === k ? { background: c.bg, color: c.color, borderColor: c.color } : { borderColor: '#E5E5E5', color: '#666' }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Due Date</span>
                  <input type="date" value={edit.dueDate} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} className="text-sm" style={{ borderBottom: '1px solid #E5E5E5' }} />
                </div>
                <div>
                  <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Tags (comma-separated)</span>
                  <input type="text" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="exam, review" className="text-sm" />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Linked Note</span>
                <select value={task.linkedNoteId ?? ''} onChange={(e) => linkNote(task.id, e.target.value || null)} className="text-sm" style={{ borderBottom: '1px solid #E5E5E5', padding: '8px 0' }}>
                  <option value="">None</option>
                  {notes.filter((n) => !n.archived).map((n) => (<option key={n.id} value={n.id}>{n.title}</option>))}
                </select>
              </div>
            </div>
          )}

          {tab === 'subtasks' && (
            <div className="space-y-3">
              {task.subtasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-[#999] mb-1"><span>Progress</span><span>{stPct}%</span></div>
                  <div className="h-1.5 bg-[#F5F5F5]"><div className="h-1.5 bg-black transition-all" style={{ width: `${stPct}%` }} /></div>
                </div>
              )}
              {task.subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-3 group">
                  <button onClick={() => toggleSubtask(task.id, st.id)}
                    className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center text-[8px] ${st.completed ? 'bg-black border-black text-white' : 'border-[#D0D0D0] hover:border-black'}`}
                  >{st.completed && '✓'}</button>
                  <span className={`text-sm flex-1 ${st.completed ? 'line-through text-[#999]' : ''}`}>{st.title}</span>
                  <button onClick={() => deleteSubtask(task.id, st.id)} className="text-[#999] hover:text-[#9B1C1C] text-xs opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input type="text" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add subtask..." className="flex-1 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newSub.trim()) { addSubtask(task.id, newSub.trim()); setNewSub(''); } }} />
                <button onClick={() => { if (newSub.trim()) { addSubtask(task.id, newSub.trim()); setNewSub(''); } }} className="btn-secondary text-xs py-1 px-3">Add</button>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="space-y-3">
              {task.comments.map((c) => (
                <div key={c.id} className="group border-l-2 border-[#E5E5E5] pl-3 py-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium">{c.author}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#999]">{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <button onClick={() => deleteComment(task.id, c.id)} className="text-[#999] hover:text-[#9B1C1C] text-xs opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  </div>
                  <p className="text-xs text-[#666] mt-1">{c.text}</p>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." rows={2} className="flex-1 text-sm resize-none" style={{ borderBottom: '1px solid #E5E5E5' }} />
                <button onClick={() => { if (newComment.trim()) { addComment(task.id, newComment.trim(), 'You'); setNewComment(''); } }} className="btn-secondary text-xs py-1 px-3 self-end">Post</button>
              </div>
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-3">
              {task.attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 group py-1">
                  <span className="text-xs">Attachments:</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1E3A5F] hover:underline flex-1 truncate">{a.name}</a>
                  <button onClick={() => deleteAttachment(task.id, a.id)} className="text-[#999] hover:text-[#9B1C1C] text-xs opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              <div className="space-y-2 mt-3">
                <input type="text" value={newAttName} onChange={(e) => setNewAttName(e.target.value)} placeholder="Link name" className="text-sm" />
                <input type="text" value={newAttUrl} onChange={(e) => setNewAttUrl(e.target.value)} placeholder="https://..." className="text-sm" />
                <button onClick={() => { if (newAttName.trim() && newAttUrl.trim()) { addAttachment(task.id, newAttName.trim(), newAttUrl.trim()); setNewAttName(''); setNewAttUrl(''); } }} className="btn-secondary text-xs py-1 px-3">Add Link</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E5E5]">
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9B1C1C]">Sure?</span>
              <button onClick={() => { deleteTodo(task.id); onClose(); }} className="btn-danger text-xs py-1 px-3">Delete</button>
              <button onClick={() => setConfirmDel(false)} className="text-xs text-[#999]">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="text-xs text-[#999] hover:text-[#9B1C1C]">Delete task</button>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-4" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-xs py-2 px-4" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
