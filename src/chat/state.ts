import { chatId } from './id';
import type { Trace } from './memory';
export interface ImageObservation { name: string; model: string; description: string }
export interface Msg { id: string; role: 'user' | 'assistant'; content: string; imageObservation?: ImageObservation }
export interface Session { id: string; title: string; messages: Msg[]; persona: string; memoryEnabled: boolean }
export interface Persona { id: string; name: string; content: string }
export interface ChatState { sessions: Session[]; activeId: string; personas: Persona[]; memories: Trace[] }
export const CHAT_KEY = 'reactos.chat.v1';
export function newSession(): Session { return { id: chatId(), title: 'New chat', messages: [], persona: 'You are a helpful assistant.', memoryEnabled: true }; }
export function loadChat(): ChatState {
  try {
    const data = JSON.parse(localStorage.getItem(CHAT_KEY) || 'null');
    if (data && Array.isArray(data.sessions) && data.sessions.length && data.sessions.every((s: Session) => typeof s.id === 'string' && typeof s.title === 'string' && typeof s.persona === 'string' && Array.isArray(s.messages)) && Array.isArray(data.personas) && Array.isArray(data.memories)) return { ...data, activeId: data.sessions.some((s: Session) => s.id === data.activeId) ? data.activeId : data.sessions[0].id };
  } catch {}
  const session = newSession();
  return { sessions: [session], activeId: session.id, personas: [{ id: 'default', name: 'Helpful assistant', content: session.persona }], memories: [] };
}
