import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryJsonStorage } from './jsonStorage';
import { isChatDocument, type ChatDocument } from './document';

export class ChatDatabase {
  readonly db: Database;
  private readonly memories?: MemoryJsonStorage;
  constructor(path: string, memoriesPath?: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true, strict: true });
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS chatbot_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        document TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`);
    try {
      if (memoriesPath) {
        this.memories = new MemoryJsonStorage(memoriesPath);
        const memories = this.memories.read();
        const current = this.read();
        if (current) {
          if (memories !== null && JSON.stringify(memories) !== JSON.stringify(current.document.chat.memories)) {
            current.document.chat.memories = memories;
            this.save(current.document, current.revision);
          } else if (memories === null) this.memories.write(current.document.chat.memories);
        }
      }
    } catch (error) { this.db.close(); throw error; }
  }
  read(): { revision: number; document: ChatDocument } | null {
    const row = this.db.query<{ revision: number; document: string }, []>('SELECT revision, document FROM chatbot_state WHERE id = 1').get();
    if (!row) return null;
    const document: unknown = JSON.parse(row.document);
    if (!isChatDocument(document)) throw new Error('Invalid saved chatbot data');
    return { revision: row.revision, document };
  }
  // A single transaction imports browser data only when there is no saved state.
  initialize(document: ChatDocument) {
    if (!isChatDocument(document)) throw new Error('Invalid chatbot data');
    return this.db.transaction(() => {
      const existing = this.read();
      if (existing) return existing;
      const memories = this.memories?.read();
      if (memories != null) document = { ...document, chat: { ...document.chat, memories } };
      this.db.query('INSERT OR IGNORE INTO chatbot_state (id, revision, document, updated_at) VALUES (1, 1, ?, ?)').run(JSON.stringify(document), new Date().toISOString());
      this.memories?.write(document.chat.memories);
      return this.read()!;
    }).immediate();
  }
  save(document: ChatDocument, revision: number): number | null {
    if (!isChatDocument(document)) throw new Error('Invalid chatbot data');
    return this.db.transaction(() => {
      const result = this.db.query('UPDATE chatbot_state SET document = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?').run(JSON.stringify(document), new Date().toISOString(), revision);
      if (!result.changes) return null;
      this.memories?.write(document.chat.memories);
      return revision + 1;
    }).immediate();
  }
  close() { this.db.close(); }
}

export function chatStateRoutes(database: ChatDatabase) {
  const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  return {
    GET() {
      try { return response(database.read()); }
      catch { return response({ error: 'Could not read the chatbot database.' }, 500); }
    },
    async POST(req: Request) {
      // The app is a single-user desktop. Reject cross-origin browser writes.
      if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return response({ error: 'Invalid origin' }, 403);
      let body: unknown;
      try { body = await req.json(); } catch { return response({ error: 'Invalid JSON' }, 400); }
      if (!isChatDocument(body)) return response({ error: 'Invalid chatbot data' }, 400);
      try { return response(database.initialize(body)); }
      catch { return response({ error: 'Could not initialize the chatbot database.' }, 500); }
    },
    async PUT(req: Request) {
      if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return response({ error: 'Invalid origin' }, 403);
      let body: any;
      try { body = await req.json(); } catch { return response({ error: 'Invalid JSON' }, 400); }
      if (!body || !Number.isSafeInteger(body.revision) || body.revision < 1 || !isChatDocument(body.document)) return response({ error: 'Invalid chatbot data' }, 400);
      try {
        const revision = database.save(body.document, body.revision);
        return revision === null ? response({ error: 'Another window saved changes. Reload to load the latest saved data.' }, 409) : response({ revision });
      } catch { return response({ error: 'Could not save the chatbot database.' }, 500); }
    },
  };
}
