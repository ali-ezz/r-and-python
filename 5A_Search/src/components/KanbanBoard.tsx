/**
 * @fileoverview Kanban board component for task management.
 * Displays tasks in columns by status with drag-to-change-status.
 */
import { useTodoStore, STATUS_CONFIG, PRIORITY_CONFIG, isOverdue, type TaskStatus, type Todo } from '../store/todoStore';

const COLUMNS: TaskStatus[] = ['todo', 'in-progress', 'done'];

export default function KanbanBoard({ onOpenTask }: { onOpenTask: (t: Todo) => void }) {
  const { todos, setStatus } = useTodoStore();

  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('taskId', id); };
  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) setStatus(id, status);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <div className="grid grid-cols-3 gap-4 min-h-[400px]">
      {COLUMNS.map((col) => {
        const cfg = STATUS_CONFIG[col];
        const colTasks = todos.filter((t: Todo) => t.status === col)
          .sort((a: Todo, b: Todo) => PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight);
        return (
          <div key={col} className="flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm">{cfg.icon}</span>
              <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999]">{cfg.label}</span>
              <span className="text-[10px] text-[#BBB] ml-auto">{colTasks.length}</span>
            </div>
            <div className="flex-1 space-y-2 bg-[#FAFAFA] border border-dashed border-[#E5E5E5] p-2 min-h-[200px]">
              {colTasks.map((todo: Todo) => {
                const pCfg = PRIORITY_CONFIG[todo.priority];
                const over = isOverdue(todo);
                const stDone = todo.subtasks.filter((s) => s.completed).length;
                return (
                  <div key={todo.id} draggable onDragStart={(e) => handleDragStart(e, todo.id)}
                    onClick={() => onOpenTask(todo)}
                    className={`card p-3 cursor-grab active:cursor-grabbing hover:border-[#999] transition-all ${over ? 'border-l-2 border-l-[#9B1C1C]' : ''}`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-[10px]">{pCfg.icon}</span>
                      <span className="text-xs font-medium flex-1 line-clamp-2">{todo.title}</span>
                    </div>
                    {todo.description && <p className="text-[10px] text-[#999] line-clamp-1 ml-5 mb-1">{todo.description}</p>}
                    <div className="flex items-center gap-2 ml-5 flex-wrap">
                      {todo.subtasks.length > 0 && (
                        <span className="text-[9px] text-[#999]">Subtasks: {stDone}/{todo.subtasks.length}</span>
                      )}
                      {todo.comments.length > 0 && <span className="text-[9px] text-[#999]">Comments: {todo.comments.length}</span>}
                      {todo.attachments.length > 0 && <span className="text-[9px] text-[#999]">Attachments: {todo.attachments.length}</span>}
                      {todo.dueDate && (
                        <span className={`text-[9px] ml-auto ${over ? 'text-[#9B1C1C] font-medium' : 'text-[#999]'}`}>
                          {over ? '! ' : ''}{fmtDate(todo.dueDate)}
                        </span>
                      )}
                    </div>
                    {todo.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 ml-5 flex-wrap">
                        {todo.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0 text-[8px] bg-[#F3F4F6] text-[#666]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div className="text-[10px] text-[#CCC] text-center py-8">Drop tasks here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
