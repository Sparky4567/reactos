import type { ChatState } from './state';
export interface ChatSettings { host: string; model: string; fontScale: number; wakeWord?: string }
export interface ChatDocument { chat: ChatState; settings: ChatSettings }
const object = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const unique = (items: { id: string }[]) => new Set(items.map(x => x.id)).size === items.length;
export function isChatDocument(value: unknown): value is ChatDocument {
  if (!object(value) || !object(value.settings) || !object(value.chat)) return false;
  const { chat, settings } = value;
  if (!text(settings.host) || !text(settings.model) || !finite(settings.fontScale) || settings.fontScale < 0.8 || settings.fontScale > 2) return false;
  if (settings.wakeWord !== undefined && (!text(settings.wakeWord) || !settings.wakeWord.trim() || settings.wakeWord.length > 80)) return false;
  if (!text(chat.activeId) || !Array.isArray(chat.sessions) || !chat.sessions.length || !Array.isArray(chat.personas) || !Array.isArray(chat.memories)) return false;
  if (!chat.sessions.every((s: unknown) => object(s) && text(s.id) && text(s.title) && text(s.persona) && typeof s.memoryEnabled === 'boolean' && Array.isArray(s.messages) && s.messages.every((m: unknown) => object(m) && text(m.id) && (m.role === 'user' || m.role === 'assistant') && text(m.content)) && unique(s.messages))) return false;
  if (!chat.sessions.some((s: { id: string }) => s.id === chat.activeId) || !unique(chat.sessions)) return false;
  if (!chat.personas.every((p: unknown) => object(p) && text(p.id) && text(p.name) && text(p.content)) || !unique(chat.personas)) return false;
  return chat.memories.every((m: unknown) => object(m) && text(m.id) && text(m.content) && finite(m.activation) && m.activation >= 0 && m.activation <= 1 && finite(m.importance) && m.importance >= 0 && m.importance <= 1 && finite(m.lastSpike) && finite(m.consolidatedAt) && ['createdAt', 'updatedAt', 'reviewedAt'].every(key => m[key] === undefined || finite(m[key])) && object(m.links) && Object.values(m.links).every(w => finite(w) && w >= 0 && w <= 1)) && unique(chat.memories);
}
