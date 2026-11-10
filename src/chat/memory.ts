import { chatId } from './id';
// Browser adaptation of Qualia's neuromorphic memory. See QUALIA-LICENSE.
export interface Trace {
  id: string; content: string; activation: number; importance: number;
  createdAt?: number; updatedAt?: number; reviewedAt?: number;
  lastSpike: number; consolidatedAt: number; links: Record<string, number>;
}
const DAY = 86400000;
const words = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !['the', 'and', 'that', 'this', 'with', 'for', 'you', 'are', 'have'].includes(w)));
export const activation = (m: Trace, now = Date.now()) => m.activation * Math.exp(-0.02 * Math.max(0, now - m.lastSpike) / DAY);
export function remember(memories: Trace[], content: string, now = Date.now()): Trace[] {
  const normalized = content.trim().slice(0, 2000);
  if (!normalized) return memories;
  const existing = memories.find(m => m.content.toLowerCase() === normalized.toLowerCase());
  if (existing) return memories.map(m => m.id === existing.id ? { ...m, activation: Math.min(1, activation(m, now) + 0.15), lastSpike: now } : m);
  return [...memories, { id: chatId(), content: normalized, activation: 0.5, importance: 0.5, createdAt: now, updatedAt: now, lastSpike: now, consolidatedAt: now, links: {} }].slice(-500);
}
export function recall(memories: Trace[], query: string, now = Date.now()) {
  const terms = words(query);
  const matches = memories.map(memory => {
    const tokens = words(memory.content);
    const overlap = [...terms].filter(t => tokens.has(t)).length;
    return { memory, score: overlap / Math.sqrt(Math.max(1, tokens.size * terms.size)) };
  }).filter(m => m.score > 0);
  const active = new Set(matches.map(m => m.memory.id));
  const selected = matches.map(({memory, score}) => ({ memory, score: score * activation(memory, now) * (1 + memory.importance * 0.5) * (1 + Object.entries(memory.links).reduce((n, [id, weight]) => n + (active.has(id) ? weight * 0.3 : 0), 0)) })).sort((a, b) => b.score - a.score).slice(0, 6).map(m => m.memory);
  const ids = new Set(selected.map(m => m.id));
  const updated = memories.map(m => {
    if (!ids.has(m.id)) return m;
    const links = { ...m.links };
    for (const id of ids) if (id !== m.id) links[id] = Math.min(1, (links[id] || 0) + 0.05);
    const nextActivation = Math.min(1, activation(m, now) + 0.15);
    const consolidate = nextActivation >= 0.7 && now - m.consolidatedAt >= 600000;
    return { ...m, activation: nextActivation, lastSpike: now, importance: Math.min(1, m.importance + (consolidate ? 0.05 : 0)), consolidatedAt: consolidate ? now : m.consolidatedAt, links: Object.fromEntries(Object.entries(links).sort((a,b) => b[1] - a[1]).slice(0, 8)) };
  });
  return { selected, memories: updated };
}
export function forget(memories: Trace[], id: string) {
  return memories.filter(m => m.id !== id).map(m => ({ ...m, links: Object.fromEntries(Object.entries(m.links).filter(([key]) => key !== id)) }));
}

export function memoryEditError(memories: Trace[], id: string, content: string, importance: number): string {
  if (!memories.some(m => m.id === id)) return 'This memory no longer exists.';
  if (!content.trim()) return 'Memory text cannot be empty.';
  if (content.trim().length > 2000) return 'Keep memory text within 2,000 characters.';
  if (!Number.isFinite(importance) || importance < 0 || importance > 1) return 'Importance must be between 0% and 100%.';
  if (memories.some(m => m.id !== id && m.content.toLowerCase() === content.trim().toLowerCase())) return 'Another memory already has this text. Edit that memory or delete the duplicate.';
  return '';
}
export function editMemory(memories: Trace[], id: string, content: string, importance: number, now = Date.now()): Trace[] {
  if (memoryEditError(memories, id, content, importance)) return memories;
  const text = content.trim();
  const original = memories.find(m => m.id === id)!;
  const changed = original.content !== text;
  // Corrected text must learn fresh associations instead of retaining links to the old fact.
  const clean = changed ? memories.map(m => ({ ...m, links: Object.fromEntries(Object.entries(m.links).filter(([key]) => key !== id)) })) : memories;
  return clean.map(m => m.id === id ? { ...m, content: text, importance, updatedAt: now, reviewedAt: now,
    ...(changed ? { activation: 0.5, lastSpike: now, consolidatedAt: now, links: {} } : {}),
  } : m);
}
export function reviewMemory(memories: Trace[], id: string, now = Date.now()): Trace[] {
  return memories.map(m => m.id === id ? { ...m, reviewedAt: now } : m);
}
