import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatDatabase } from './database';
import { MemoryJsonStorage } from './jsonStorage';
import { newSession } from './state';
import { remember } from './memory';
import type { ChatDocument } from './document';

function sample(): ChatDocument {
  const session = newSession();
  return { chat: { activeId: session.id, sessions: [session], personas: [], memories: remember([], 'User likes TypeScript') }, settings: { host: 'localhost', model: 'test', fontScale: 1 } };
}

test('JSON transfers memories to a fresh database and imports edits and deletions on restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'memories-json-'));
  let db: ChatDatabase | undefined;
  try {
    const path = join(dir, 'memories.json');
    const storage = new MemoryJsonStorage(path);
    db = new ChatDatabase(join(dir, 'first.sqlite'), path);
    const document = sample();
    db.initialize(document);
    expect(storage.read()).toEqual(document.chat.memories);
    const changed = structuredClone(document);
    changed.chat.memories[0]!.content = 'User likes Rust';
    expect(db.save(changed, 1)).toBe(2);
    expect(storage.read()).toEqual(changed.chat.memories);
    expect(db.save(document, 1)).toBeNull();
    expect(storage.read()).toEqual(changed.chat.memories);
    db.close();
    db = new ChatDatabase(join(dir, 'second.sqlite'), path);
    const fresh = sample();
    fresh.settings.model = 'different';
    const imported = db.initialize(fresh);
    expect(imported.document.chat.memories).toEqual(changed.chat.memories);
    expect(imported.document.settings).toEqual(fresh.settings);
    db.close();
    storage.write([]);
    db = new ChatDatabase(join(dir, 'second.sqlite'), path);
    expect(db.read()!.document.chat.memories).toEqual([]);
    expect(db.read()!.revision).toBe(2);
    expect(db.read()!.document.chat.sessions).toEqual(fresh.chat.sessions);
    db.close();
    writeFileSync(path, '{"version":1,"memories":[{"id":"bad"}]}');
    expect(() => new ChatDatabase(join(dir, 'second.sqlite'), path)).toThrow();
    expect(readFileSync(path, 'utf8')).toContain('bad');
    db = new ChatDatabase(join(dir, 'second.sqlite'));
    expect(db.read()!.document.chat.memories).toEqual([]);
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('existing SQLite memories are exported; JSON write failures roll back saves', () => {
  const dir = mkdtempSync(join(tmpdir(), 'memories-json-'));
  let db: ChatDatabase | undefined;
  try {
    const sqlite = join(dir, 'chat.sqlite');
    const path = join(dir, 'memories.json');
    const document = sample();
    db = new ChatDatabase(sqlite);
    db.initialize(document);
    db.close();
    db = new ChatDatabase(sqlite, path);
    expect(new MemoryJsonStorage(path).read()).toEqual(document.chat.memories);
    rmSync(path);
    mkdirSync(path);
    const changed = structuredClone(document);
    changed.chat.memories = [];
    expect(() => db!.save(changed, 1)).toThrow();
    expect(db.read()).toEqual({ revision: 1, document });
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
