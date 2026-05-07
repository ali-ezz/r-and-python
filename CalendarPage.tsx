/**
 * @fileoverview Main Tasks page — List & Kanban views, bulk actions, filters.
 */
import { useState, useMemo } from 'react';
import { useTodoStore, PRIORITY_CONFIG, STATUS_CONFIG, isOverdue, type TaskStatus, type Priority, type TodoFilter, type TodoSort, type Todo } from '../store/todoStore';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal';

export default function TodoPage() {
  const { todos, selectedIds, toggleSelect, selectAll, clearSelection, bulkSetStatus, bulkSetPriority, bulkDelete, addTodo, markAllStatus } = useTodoStore();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [sortBy, setSortBy] = useState<TodoSort>('created');
  const [activeTask, setActiveTask] = useState<Todo | null>(null);

  const [newTitle, setNewTitle] = useState('');

  const completedCount = todos.filter((t) => t.status === 'done').length;
  const activeCount = todos.filter((t) => t.status !== 'done' && t.status !== 'archived').length;
  const progressPct = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  const filtered = useMemo(() => {
    let result = [...todos];
    switch (filter) {
      case 'todo': result = result.filter((t) => t.status === 'todo'); break;
      case 'in-progress': result = result.filter((t) => t.status === 'in-progress'); break;
      case 'done': result = result.filter((t) => t.status === 'done'); break;
      case 'archived': result = result.filter((t) => t.status === 'archived'); break;
      case 'overdue': result = result.filter(isOverdue); break;
    }
    result.sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight;
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1; if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [todos, filter, sortBy]);

  const handleCreate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTitle.trim()) {
      addTodo({ title: newTitle.trim(), description: '', priority: 'medium', dueDate: null, tags: [] });
      setNewTitle('');
    }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <div className="max-w-6xl fade-in flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-[#666] text-sm mt-1">{activeCount} active · {completedCount} done</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex border border-[#E5E5E5]">
            <button onClick={() => setView('kanban')} className={`px-3 py-2 text-xs ${view === 'kanban' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>Kanban</button>
            <button onClick={() => setView('list')} className={`px-3 py-2 text-xs border-l border-[#E5E5E5] ${view === 'list' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>List</button>
          </div>
        </div>
      </div>

      {/* Progress & Quick Add */}
      <div className="flex gap-4 mb-6 flex-shrink-0">
        <div className="flex-1 card py-2 px-4 flex items-center gap-3">
          <span className="text-lg text-[#999]">+</span>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={handleCreate} placeholder="Add task and press Enter..." className="flex-1 text-sm bg-transparent border-none p-0 outline-none" />
        </div>
        <div className="w-48 card py-2 px-4 flex flex-col justify-center">
          <div className="flex justify-between text-[10px] text-[#999] uppercase tracking-wider mb-1"><span>Progress</span><span>{progressPct}%</span></div>
          <div className="h-1 bg-[#F5F5F5]"><div className="h-1 bg-black transition-all" style={{ width: `${progressPct}%` }} /></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex gap-2">
          {(['all', 'todo', 'in-progress', 'done', 'overdue', 'archived'] as TodoFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs border transition-colors capitalize ${filter === f ? 'bg-black text-white border-black' : 'border-[#E5E5E5] text-[#666] hover:border-black'}`}>{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-[#999]">Sort:</span>
          {(['created', 'priority', 'dueDate', 'title'] as TodoSort[]).map((s) => (
            <button key={s} onClick={() => setSortBy(s)} className={`px-2 py-1 text-xs capitalize ${sortBy === s ? 'text-black font-medium' : 'text-[#999] hover:text-black'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#1A1A1A] text-white px-4 py-2 flex items-center justify-between mb-4 flex-shrink-0 text-sm slide-up">
          <div className="flex items-center gap-4">
            <span>{selectedIds.length} selected</span>
            <button onClick={clearSelection} className="text-[#999] hover:text-white text-xs">Clear</button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-[#999] uppercase">Set Status:</span>
            {(['todo', 'in-progress', 'done', 'archived'] as TaskStatus[]).map((s) => (
              <button key={s} onClick={() => bulkSetStatus(s)} className="text-xs hover:underline capitalize">{s}</button>
            ))}
            <span className="text-[#333]">|</span>
            <button onClick={bulkDelete} className="text-xs text-[#FF6B6B] hover:underline">Delete Selected</button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {view === 'kanban' ? (
          <KanbanBoard onOpenTask={setActiveTask} />
        ) : (
          <div className="card p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} className="text-center">
                    <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filtered.length} onChange={(e) => e.target.checked ? selectAll() : clearSelection()} />
                  </th>
                  <th>Title</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 100 }}>Priority</th>
                  <th style={{ width: 100 }}>Due</th>
                  <th style={{ width: 100 }} className="text-right">Metrics</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const sCfg = STATUS_CONFIG[t.status];
                  const pCfg = PRIORITY_CONFIG[t.priority];
                  const over = isOverdue(t);
                  return (
                    <tr key={t.id} className="cursor-pointer hover:bg-[#FAFAFA]" onClick={() => setActiveTask(t)}>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                      </td>
                      <td>
                        <div className={`font-medium text-sm ${t.status === 'done' || t.status === 'archived' ? 'text-[#999] line-through' : ''}`}>{t.title}</div>
                        {t.tags.length > 0 && <div className="flex gap-1 mt-1">{t.tags.map(tag => <span key={tag} className="px-1.5 text-[9px] bg-[#F3F4F6] text-[#666]">{tag}</span>)}</div>}
                      </td>
                      <td><span className="px-2 py-0.5 text-[10px] uppercase font-medium" style={{ background: sCfg.bg, color: sCfg.color }}>{sCfg.label}</span></td>
                      <td><span className="px-2 py-0.5 text-[10px] uppercase font-medium" style={{ background: pCfg.bg, color: pCfg.color }}>{pCfg.label}</span></td>
                      <td className={`text-xs ${over ? 'text-[#9B1C1C] font-medium' : 'text-[#666]'}`}>{over ? '! ' : ''}{fmtDate(t.dueDate) || '-'}</td>
                      <td className="text-right text-[10px] text-[#999] space-x-2">
                        {t.subtasks.length > 0 && <span>Subtasks: {t.subtasks.filter(s=>s.completed).length}/{t.subtasks.length}</span>}
                        {t.comments.length > 0 && <span>Comments: {t.comments.length}</span>}
                        {t.attachments.length > 0 && <span>Attachments: {t.attachments.length}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-8 text-sm text-[#999]">No tasks match filter.</div>}
          </div>
        )}
      </div>

      {activeTask && <TaskDetailModal task={activeTask} onClose={() => setActiveTask(null)} />}
    </div>
  );
}
