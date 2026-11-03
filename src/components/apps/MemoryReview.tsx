import { useId, useState } from 'react';
import { activation, editMemory, forget, memoryEditError, remember, reviewMemory, type Trace } from '@/chat/memory';
interface Props {
  memories: Trace[];
  onChange: (update: (memories: Trace[]) => Trace[]) => void;
  disabled: boolean;
}
const timestamp = (time?: number) => time === undefined ? 'Not recorded' : new Date(time).toLocaleString();
function MemoryCard({ memory, memories, onChange, disabled }: Props & { memory: Trace }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [importance, setImportance] = useState(memory.importance);
  const [error, setError] = useState('');
  const id = useId();
  const links = Object.entries(memory.links).flatMap(([id, weight]) => {
    const target = memories.find(m => m.id === id);
    return target ? [{ ...target, weight }] : [];
  });
  const save = () => {
    const error = memoryEditError(memories, memory.id, content, importance);
    if (error) { setError(error); return; }
    onChange(current => editMemory(current, memory.id, content, importance));
    setError(''); setEditing(false);
  };
  return <article className="memory-card" aria-label={`Memory: ${memory.content.slice(0, 80)}`}>
    <div className="memory-card-heading"><span className={`memory-review-badge ${memory.reviewedAt === undefined ? '' : 'reviewed'}`}>{memory.reviewedAt === undefined ? 'Needs review' : 'Reviewed'}</span><span>Activation {Math.round(activation(memory) * 100)}% · Importance {Math.round(memory.importance * 100)}%</span></div>
    {editing ? <form className="memory-edit-form" onSubmit={e => { e.preventDefault(); save(); }}>
      <fieldset disabled={disabled}>
        <label htmlFor={`${id}-text`}>Memory text</label>
        <textarea id={`${id}-text`} autoFocus rows={4} maxLength={2000} value={content} onChange={e => { setContent(e.target.value); setError(''); }} aria-describedby={error ? `${id}-error` : undefined} />
        <div className="memory-edit-label"><label htmlFor={`${id}-importance`}>Importance</label><span>{Math.round(importance * 100)}%</span></div>
        <input id={`${id}-importance`} type="range" min={0} max={1} step={0.05} value={importance} onChange={e => setImportance(Number(e.target.value))} />
        <p className="chatbot-hint">Higher importance increases recall priority. Changing the text resets its learned associations.</p>
        {error && <p id={`${id}-error`} className="chatbot-error" role="alert">{error}</p>}
        <div className="memory-card-actions"><button type="submit" disabled={!content.trim()}>Save changes</button><button type="button" onClick={() => { setEditing(false); setError(''); }}>Cancel</button></div>
      </fieldset>
    </form> : <>
      <p className="memory-content">{memory.content}</p>
      <div className="memory-card-actions">
        <button disabled={disabled} onClick={() => { setContent(memory.content); setImportance(memory.importance); setError(''); setEditing(true); }}><i className="fa fa-pencil" aria-hidden="true" /> Edit</button>
        <button disabled={disabled} onClick={() => onChange(current => reviewMemory(current, memory.id))}><i className="fa fa-check" aria-hidden="true" /> {memory.reviewedAt === undefined ? 'Mark reviewed' : 'Review again'}</button>
        <button disabled={disabled} className="memory-delete" onClick={() => { if (confirm(`Delete this shared memory?\n\n${memory.content}\n\nThis removes it from future memory recall. Chat messages are kept.`)) onChange(current => forget(current, memory.id)); }}><i className="fa fa-trash-o" aria-hidden="true" /> Delete</button>
      </div>
    </>}
    <details className="memory-details"><summary>Memory details · {links.length} association{links.length === 1 ? '' : 's'}</summary>
      <dl><dt>Added</dt><dd>{timestamp(memory.createdAt)}</dd><dt>Last activated</dt><dd>{timestamp(memory.lastSpike)}</dd><dt>Last changed</dt><dd>{timestamp(memory.updatedAt)}</dd><dt>Reviewed</dt><dd>{memory.reviewedAt === undefined ? 'Not yet reviewed' : timestamp(memory.reviewedAt)}</dd></dl>
      {links.length > 0 && <ul>{links.map(m => <li key={m.id}>{m.content} <span>({Math.round(m.weight * 100)}% association)</span></li>)}</ul>}
    </details>
  </article>;
}
export function MemoryReview({ memories, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const searchId = useId();
  const unreviewed = memories.filter(m => m.reviewedAt === undefined).length;
  const visible = memories.filter(m => m.content.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'all' || (filter === 'unreviewed' ? m.reviewedAt === undefined : m.reviewedAt !== undefined))).sort((a, b) => sort === 'importance' ? b.importance - a.importance : sort === 'activation' ? activation(b) - activation(a) : (b.updatedAt ?? b.createdAt ?? b.lastSpike) - (a.updatedAt ?? a.createdAt ?? a.lastSpike));
  return <section className="chatbot-memory-review" aria-label="Memory review">
    <div className="memory-review-heading"><div><h2>Memory review</h2><p>{memories.length} memories · {unreviewed} need review</p></div><button disabled={disabled || !memories.length} className="memory-delete" onClick={() => { if (confirm(`Delete all ${memories.length} shared memories? This cannot be undone. Chat messages are kept.`)) { onChange(() => []); setNotice('All memories deleted.'); } }}>Delete all memories</button></div>
    <p className="memory-scope-note">Memories are shared across sessions and saved to SQLite. Edits apply to future recall. Deleting a memory keeps existing chat messages, which can still be used as conversation context.</p>
    {disabled && <p className="memory-scope-note" role="status">Memory changes are paused while a response is being generated or saving is unavailable.</p>}
    <form className="memory-add-form" onSubmit={e => { e.preventDefault(); if (!draft.trim() || disabled) return; onChange(current => remember(current, draft)); setDraft(''); setNotice('Memory added.'); }}>
      <label htmlFor={`${searchId}-add`}>Add a memory</label><div><textarea id={`${searchId}-add`} rows={2} maxLength={2000} disabled={disabled} placeholder="A fact, preference, or instruction to remember…" value={draft} onChange={e => setDraft(e.target.value)} /><button disabled={disabled || !draft.trim()}>Remember</button></div>
    </form>
    <div className="memory-review-filters">
      <label htmlFor={searchId}>Search memories<input id={searchId} type="search" placeholder="Search memory text…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Review status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All memories</option><option value="unreviewed">Needs review</option><option value="reviewed">Reviewed</option></select></label>
      <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently changed</option><option value="importance">Importance</option><option value="activation">Activation</option></select></label>
    </div>
    <p className="memory-result-count" role="status">Showing {visible.length} of {memories.length} memories{notice ? ` · ${notice}` : ''}</p>
    <div className="memory-review-list">{visible.map(memory => <MemoryCard key={memory.id} memory={memory} memories={memories} onChange={onChange} disabled={disabled} />)}</div>
    {!visible.length && <div className="memory-review-empty"><i className="fa fa-lightbulb-o" aria-hidden="true" /><p>{memories.length ? 'No memories match your search or review filter.' : 'No memories yet. Add one above or chat with memory enabled.'}</p></div>}
  </section>;
}
