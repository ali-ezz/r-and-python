/**
 * @fileoverview Note editor modal — markdown/rich text, version history, tags, folders, task linking.
 */
import { useState } from 'react';
import { useNotesStore, NOTE_CATEGORIES, type NoteCategory, type Note } from '../store/notesStore';
import { useTodoStore } from '../store/todoStore';

export default function NoteDetailModal({ note, isNew, onClose }: { note: Partial<Note>; isNew: boolean; onClose: () => void }) {
  const { addNote, updateNote, deleteNote, folders, allTags, addFolder, addTag, linkTask } = useNotesStore();
  const { todos, linkNote } = useTodoStore();

  const [edit, setEdit] = useState<{
    title: string;
    content: string;
    category: NoteCategory;
    folder: string;
    tags: string;
    linkedTaskId: string | null;
  }>({
    title: note.title || '',
    content: note.content || '',
    category: note.category || 'General',
    folder: note.folder || 'General',
    tags: note.tags?.join(', ') || '',
    linkedTaskId: note.linkedTaskId || null,
  });

  const [tab, setTab] = useState<'editor' | 'preview' | 'history'>('editor');
  const [newFolder, setNewFolder] = useState('');
  const canSave = Boolean(edit.title.trim() || edit.content.trim());

  const save = () => {
    if (!canSave) return;
    const title = edit.title.trim() || 'Untitled Note';
    const tagsArr = edit.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    tagsArr.forEach(t => addTag(t)); // Add any new tags to global pool

    if (isNew) {
      const newNoteId = addNote(title, edit.content, edit.category, edit.folder, tagsArr);
      if (edit.linkedTaskId) {
        linkTask(newNoteId, edit.linkedTaskId);
        linkNote(edit.linkedTaskId, newNoteId);
      }
    } else {
      updateNote(note.id!, {
        title,
        content: edit.content,
        category: edit.category,
        folder: edit.folder,
        tags: tagsArr,
      });
      linkTask(note.id!, edit.linkedTaskId);
      if (edit.linkedTaskId) {
        linkNote(edit.linkedTaskId, note.id!);
      }
    }
    onClose();
  };

  const handleAddFolder = () => {
    if (newFolder.trim()) {
      addFolder(newFolder.trim());
      setEdit({ ...edit, folder: newFolder.trim() });
      setNewFolder('');
    }
  };

  const renderMarkdown = (text: string) => {
    // Very naive markdown parser for preview
    return text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" class="text-blue-600 underline">$1</a>')
      .replace(/\n/gim, '<br />');
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E5E5E5] w-full max-w-4xl h-[85vh] flex flex-col slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <input
            type="text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            placeholder="Note Title..." className="text-xl font-medium border-none p-0 outline-none w-1/2" autoFocus={isNew}
          />
          <div className="flex items-center gap-4">
            <div className="flex border border-[#E5E5E5]">
              <button onClick={() => setTab('editor')} className={`px-3 py-1.5 text-xs ${tab === 'editor' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>Edit</button>
              <button onClick={() => setTab('preview')} className={`px-3 py-1.5 text-xs border-l border-[#E5E5E5] ${tab === 'preview' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>Preview</button>
              {!isNew && <button onClick={() => setTab('history')} className={`px-3 py-1.5 text-xs border-l border-[#E5E5E5] ${tab === 'history' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>History</button>}
            </div>
            <button onClick={onClose} className="text-[#999] hover:text-black text-lg">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-[#E5E5E5]">
            {tab === 'editor' && (
              <textarea
                value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                placeholder="Write your note here using Markdown..."
                className="w-full h-full resize-none border-none outline-none font-mono text-sm leading-relaxed"
              />
            )}
            {tab === 'preview' && (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(edit.content) }}
              />
            )}
            {tab === 'history' && !isNew && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium mb-4">Version History</h3>
                {note.versions?.map((v, i) => (
                  <div key={v.id} className="card p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium">{i === 0 ? 'Current Version' : `Version ${note.versions!.length - i}`}</span>
                      <span className="text-[10px] text-[#999]">{new Date(v.savedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-[#666] line-clamp-2 font-mono bg-[#FAFAFA] p-2">{v.content}</div>
                    {i !== 0 && (
                      <button onClick={() => setEdit({ ...edit, content: v.content })} className="text-[10px] text-[#1E3A5F] hover:underline mt-2">Restore this version</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-64 overflow-y-auto p-4 bg-[#FAFAFA] space-y-6">
            <div>
              <label className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Folder</label>
              <select value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} className="w-full text-xs p-1.5 border border-[#E5E5E5] bg-white mb-2">
                {folders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="flex gap-1">
                <input type="text" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder" className="flex-1 text-xs px-1.5 py-1 border border-[#E5E5E5]" />
                <button onClick={handleAddFolder} className="btn-secondary text-[10px] px-2 py-1">Add</button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Category</label>
              <div className="flex flex-wrap gap-1">
                {NOTE_CATEGORIES.map((cat) => (
                  <button key={cat.id} onClick={() => setEdit({ ...edit, category: cat.id })}
                    className="px-2 py-1 text-[10px] border transition-all"
                    style={edit.category === cat.id ? { background: cat.bg, color: cat.color, borderColor: cat.color } : { borderColor: '#E5E5E5', color: '#666' }}
                  >{cat.id}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Tags (comma-separated)</label>
              <input type="text" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="react, study" className="w-full text-xs p-1.5 border border-[#E5E5E5] bg-white" />
              <div className="flex flex-wrap gap-1 mt-2">
                {allTags.slice(0, 10).map(tag => (
                  <button key={tag} onClick={() => setEdit(prev => ({ ...prev, tags: prev.tags ? `${prev.tags}, ${tag}` : tag }))} className="text-[9px] text-[#666] bg-[#E5E5E5] px-1.5 py-0.5 hover:bg-[#CCC]">+{tag}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] block mb-2">Link to Task</label>
              <select value={edit.linkedTaskId || ''} onChange={(e) => setEdit({ ...edit, linkedTaskId: e.target.value || null })} className="w-full text-xs p-1.5 border border-[#E5E5E5] bg-white">
                <option value="">None</option>
                {todos.filter(t => t.status !== 'archived').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E5E5]">
          {!isNew ? (
            <button onClick={() => { deleteNote(note.id!); onClose(); }} className="text-xs text-[#999] hover:text-[#9B1C1C]">Delete Note</button>
          ) : <div />}
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-4" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-xs py-2 px-4" onClick={save} disabled={!canSave}>Save Note</button>
          </div>
        </div>
      </div>
    </div>
  );
}
