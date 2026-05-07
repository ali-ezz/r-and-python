/**
 * @fileoverview Main Notes page — Folders, Tags sidebar, grid/list view, advanced search.
 */
import { useState, useMemo } from 'react';
import { useNotesStore, NOTE_CATEGORIES, type NoteCategory, type Note } from '../store/notesStore';
import NoteDetailModal from '../components/NoteDetailModal';

export default function NotesPage() {
  const { notes, folders, allTags, togglePin, archiveNote, restoreNote, deleteFolder, removeTag } = useNotesStore();
  
  const [search, setSearch] = useState('');
  const [filterFolder, setFilterFolder] = useState<string | 'All' | 'Archived'>('All');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | 'All'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    let result = [...notes];
    
    if (filterFolder === 'Archived') {
      result = result.filter(n => n.archived);
    } else {
      result = result.filter(n => !n.archived);
      if (filterFolder !== 'All') result = result.filter(n => n.folder === filterFolder);
    }
    
    if (filterCategory !== 'All') result = result.filter(n => n.category === filterCategory);
    if (filterTag) result = result.filter(n => n.tags.includes(filterTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      // Fuzzy-ish match
      result = result.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)));
    }
    
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return result;
  }, [notes, filterFolder, filterCategory, filterTag, search]);

  const getCatConfig = (cat: NoteCategory) => NOTE_CATEGORIES.find(c => c.id === cat) ?? NOTE_CATEGORIES[4];
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="max-w-7xl fade-in flex h-[calc(100vh-4rem)] gap-6">
      {/* Sidebar: Folders & Tags */}
      <div className="w-56 flex flex-col flex-shrink-0 border-r border-[#E5E5E5] pr-6 py-2 overflow-y-auto">
        <button className="btn-primary text-xs py-3 w-full mb-8" onClick={() => setShowNew(true)}>+ New Note</button>
        
        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">Folders</div>
        <div className="space-y-1 mb-8">
          <button onClick={() => { setFilterFolder('All'); setFilterTag(null); }} className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${filterFolder === 'All' ? 'bg-black text-white' : 'text-[#666] hover:bg-[#F5F5F5]'}`}>All Notes ({notes.filter(n=>!n.archived).length})</button>
          {folders.map(f => {
            const count = notes.filter(n => !n.archived && n.folder === f).length;
            return (
              <div key={f} className="flex items-center group">
                <button onClick={() => setFilterFolder(f)} className={`flex-1 text-left px-3 py-1.5 text-xs transition-colors truncate ${filterFolder === f ? 'bg-black text-white' : 'text-[#666] hover:bg-[#F5F5F5]'}`}>Folder: {f} ({count})</button>
                {f !== 'General' && <button onClick={() => deleteFolder(f)} className="px-2 text-xs text-[#999] opacity-0 group-hover:opacity-100 hover:text-[#9B1C1C]">×</button>}
              </div>
            );
          })}
          <button onClick={() => { setFilterFolder('Archived'); setFilterTag(null); }} className={`w-full text-left px-3 py-1.5 text-xs transition-colors mt-2 ${filterFolder === 'Archived' ? 'bg-[#999] text-white' : 'text-[#999] hover:bg-[#F5F5F5]'}`}>Archive Archive ({notes.filter(n=>n.archived).length})</button>
        </div>

        <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#999] mb-3">Tags</div>
        <div className="flex flex-wrap gap-1">
          {allTags.map(t => (
            <div key={t} className="group relative">
              <button onClick={() => setFilterTag(filterTag === t ? null : t)} className={`px-2 py-1 text-[10px] border transition-colors ${filterTag === t ? 'bg-black text-white border-black' : 'border-[#E5E5E5] text-[#666] hover:border-black'}`}>#{t}</button>
              <button onClick={() => removeTag(t)} className="absolute -top-1 -right-1 bg-white text-[#9B1C1C] text-[8px] w-3 h-3 border border-[#E5E5E5] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#9B1C1C] hover:text-white transition-all">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="search-input w-72">
            <span className="text-[#999]">◎</span>
            <input type="text" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', padding: 0 }} />
          </div>
          <div className="flex items-center gap-3">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as NoteCategory | 'All')} className="text-xs p-2 border border-[#E5E5E5] bg-transparent outline-none">
              <option value="All">All Categories</option>
              {NOTE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
            <div className="flex border border-[#E5E5E5]">
              <button onClick={() => setViewMode('grid')} className={`px-3 py-2 text-xs ${viewMode === 'grid' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>◫</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-2 text-xs border-l border-[#E5E5E5] ${viewMode === 'list' ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>≡</button>
            </div>
          </div>
        </div>

        {/* Notes Grid/List */}
        <div className="flex-1 overflow-y-auto pb-8">
          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-4xl mb-4 opacity-20">◧</div>
              <div className="text-sm text-[#999]">No notes found in this view.</div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
              {filtered.map((note) => {
                const cCfg = getCatConfig(note.category);
                return (
                  <div key={note.id} onClick={() => setActiveNote(note)} className="card group cursor-pointer hover:border-[#999] transition-all relative flex flex-col h-48">
                    {note.pinned && <div className="absolute top-3 right-3 text-xs text-[#C9A961]" title="Pinned">★</div>}
                    <div className="flex gap-2 items-center mb-2 pr-6">
                      <span className="px-1.5 py-0.5 text-[8px] font-medium uppercase" style={{ background: cCfg.bg, color: cCfg.color }}>{note.category}</span>
                      {note.linkedTaskId && <span className="text-[10px] text-[#999]" title="Linked to task">🔗</span>}
                    </div>
                    <h3 className="text-sm font-medium mb-1 line-clamp-1">{note.title}</h3>
                    <p className="text-xs text-[#666] line-clamp-4 flex-1 whitespace-pre-wrap font-mono">{note.content}</p>
                    <div className="mt-2 flex items-center justify-between text-[9px] text-[#999]">
                      <span>{fmtDate(note.updatedAt)}</span>
                      {note.tags.length > 0 && <span>{note.tags.length} tags</span>}
                    </div>
                    <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); togglePin(note.id); }} className="w-6 h-6 flex items-center justify-center text-[10px] bg-white border border-[#E5E5E5] hover:text-[#C9A961]">{note.pinned ? '★' : '☆'}</button>
                      {note.archived ? (
                        <button onClick={(e) => { e.stopPropagation(); restoreNote(note.id); }} className="w-6 h-6 flex items-center justify-center text-[10px] bg-white border border-[#E5E5E5] hover:text-[#2D6A4F]" title="Restore">↻</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); archiveNote(note.id); }} className="w-6 h-6 flex items-center justify-center text-[10px] bg-white border border-[#E5E5E5] hover:text-[#9B1C1C]" title="Archive">Archive</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-0">
              <table className="data-table">
                <thead><tr><th style={{ width: 24 }}></th><th>Title</th><th>Category</th><th>Folder</th><th>Updated</th><th style={{ width: 80 }}></th></tr></thead>
                <tbody>
                  {filtered.map((note) => {
                    const cCfg = getCatConfig(note.category);
                    return (
                      <tr key={note.id} className="cursor-pointer hover:bg-[#FAFAFA]" onClick={() => setActiveNote(note)}>
                        <td>{note.pinned && <span className="text-[#C9A961]">★</span>}</td>
                        <td>
                          <div className="font-medium text-sm flex items-center gap-2">{note.title} {note.linkedTaskId && <span className="text-[10px]">🔗</span>}</div>
                          {note.tags.length > 0 && <div className="flex gap-1 mt-1">{note.tags.map(t=><span key={t} className="text-[9px] bg-[#E5E5E5] text-[#666] px-1 py-0.5">#{t}</span>)}</div>}
                        </td>
                        <td><span className="px-2 py-0.5 text-[10px] uppercase font-medium" style={{ background: cCfg.bg, color: cCfg.color }}>{note.category}</span></td>
                        <td className="text-xs text-[#666]">Folder: {note.folder}</td>
                        <td className="text-xs text-[#999]">{fmtDate(note.updatedAt)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => togglePin(note.id)} className="text-xs text-[#999] hover:text-[#C9A961] px-1">{note.pinned ? '★' : '☆'}</button>
                          {note.archived ? (
                            <button onClick={() => restoreNote(note.id)} className="text-xs text-[#999] hover:text-[#2D6A4F] px-1">↻</button>
                          ) : (
                            <button onClick={() => archiveNote(note.id)} className="text-xs text-[#999] hover:text-[#9B1C1C] px-1">Archive</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNew && <NoteDetailModal note={{ folder: filterFolder !== 'All' && filterFolder !== 'Archived' ? filterFolder : 'General', tags: filterTag ? [filterTag] : [] }} isNew={true} onClose={() => setShowNew(false)} />}
      {activeNote && <NoteDetailModal note={activeNote} isNew={false} onClose={() => setActiveNote(null)} />}
    </div>
  );
}
