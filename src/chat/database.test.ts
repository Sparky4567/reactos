import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatDatabase, chatStateRoutes } from './database';
import { newSession } from './state';
import { remember, recall, editMemory, reviewMemory, forget } from './memory';
import type { ChatDocument } from './document';

function sample(): ChatDocument {
  const session = newSession();
  session.title = 'Persistent session';
  session.persona = 'Be concise';
  session.messages = [{ id: 'user-1', role: 'user', content: 'I prefer TypeScript' }, { id: 'assistant-1', role: 'assistant', content: 'Understood.' }];
  const memories = recall(remember([], 'I prefer TypeScript'), 'TypeScript').memories;
  return {
    chat: { sessions: [session], activeId: session.id, personas: [{ id: 'concise', name: 'Concise', content: 'Be concise' }], memories },
    settings: { host: '127.0.0.1', model: 'test-model', fontScale: 1.2 },
  };
}
function request(method: string, body: unknown, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/chat/state', { method, headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });
}
describe('SQLite chat persistence', () => {
  test('restores all data after closing and reopening the on-disk database with no browser storage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reactos-chat-'));
    let db: ChatDatabase | undefined;
    try {
      const path = join(dir, 'nested', 'chatbot.sqlite');
      db = new ChatDatabase(path);
      const document = sample();
      expect(db.read()).toBeNull();
      expect(db.initialize(document)).toEqual({ revision: 1, document });
      document.chat.sessions[0]!.messages.push({ id: 'user-2', role: 'user', content: 'Another message' });
      expect(db.save(document, 1)).toBe(2);
      db.close();
      db = new ChatDatabase(path);
      expect(db.read()).toEqual({ revision: 2, document });
      // Clearing local storage or opening another browser has no role in this read.
      expect(db.initialize(sample())).toEqual({ revision: 2, document });
    } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  test('stale windows cannot overwrite saved messages or resurrect deleted sessions', () => {
    const db = new ChatDatabase(':memory:');
    try {
      const document = sample();
      db.initialize(document);
      const next = sample();
      expect(db.save(next, 1)).toBe(2);
      expect(db.save(document, 1)).toBeNull();
      expect(db.read()!.document).toEqual(next);
      const empty = { ...next, chat: { ...next.chat, memories: [], personas: [] } };
      expect(db.save(empty, 2)).toBe(3);
      expect(db.read()!.document.chat.memories).toEqual([]);
    } finally { db.close(); }
  });
  test('API validates imports and saves, rejects foreign origins and reports conflicts', async () => {
    const db = new ChatDatabase(':memory:');
    try {
      const routes = chatStateRoutes(db);
      expect(await routes.GET().json()).toBeNull();
      expect(routes.GET().headers.get('Cache-Control')).toBe('no-store');
      expect((await routes.POST(request('POST', { chat: {} }))).status).toBe(400);
      const document = sample();
      expect((await routes.POST(request('POST', document, 'http://foreign.test'))).status).toBe(403);
      expect((await routes.POST(request('POST', document))).status).toBe(200);
      const invalid = structuredClone(document);
      invalid.chat.memories[0]!.links = { bad: 'invalid' as unknown as number };
      expect((await routes.PUT(request('PUT', { revision: 1, document: invalid }))).status).toBe(400);
      expect((await routes.PUT(request('PUT', { revision: 1, document }))).status).toBe(200);
      expect((await routes.PUT(request('PUT', { revision: 1, document }))).status).toBe(409);
      expect((await routes.PUT(new Request('http://localhost:3000/api/chat/state', { method: 'PUT', body: '{' }))).status).toBe(400);
      expect(db.read()!.revision).toBe(2);
    } finally { db.close(); }
  });
  test('disk failures return an error instead of a successful save', async () => {
    const db = new ChatDatabase(':memory:');
    db.initialize(sample());
    const routes = chatStateRoutes(db);
    db.close();
    expect(routes.GET().status).toBe(500);
    expect((await routes.PUT(request('PUT', { revision: 1, document: sample() }))).status).toBe(500);
  });
});

describe('Persisted memory management', () => {
  test('review, correction, and deletion survive reopening SQLite without changing chats or settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reactos-memory-review-'));
    let db = new ChatDatabase(join(dir, 'chat.sqlite'));
    try {
      const document = sample();
      const sessionBefore = structuredClone(document.chat.sessions);
      const settingsBefore = structuredClone(document.settings);
      const id = document.chat.memories[0]!.id;
      db.initialize(document);
      document.chat.memories = reviewMemory(document.chat.memories, id, 1000);
      expect(db.save(document, 1)).toBe(2);
      document.chat.memories = editMemory(document.chat.memories, id, 'User prefers Rust', 0.85, 2000);
      expect(db.save(document, 2)).toBe(3);
      db.close(); db = new ChatDatabase(join(dir, 'chat.sqlite'));
      const loaded = db.read()!;
      expect(loaded.document.chat.memories[0]!.content).toBe('User prefers Rust');
      expect(loaded.document.chat.memories[0]!.reviewedAt).toBe(2000);
      expect(loaded.document.chat.memories[0]!.updatedAt).toBe(2000);
      expect(loaded.document.chat.memories[0]!.importance).toBe(0.85);
      loaded.document.chat.memories = forget(loaded.document.chat.memories, id);
      expect(db.save(loaded.document, loaded.revision)).toBe(4);
      db.close(); db = new ChatDatabase(join(dir, 'chat.sqlite'));
      expect(db.read()!.document.chat.memories).toEqual([]);
      expect(db.read()!.document.chat.sessions).toEqual(sessionBefore);
      expect(db.read()!.document.settings).toEqual(settingsBefore);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
