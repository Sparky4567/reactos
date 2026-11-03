import type { Database } from 'bun:sqlite';
import { DEFAULT_APPEARANCE, isAppearance, type AppearancePreferences } from './preferences';
export function appearanceRoutes(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS appearance_preferences (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, document TEXT NOT NULL)`);
  db.query('INSERT OR IGNORE INTO appearance_preferences VALUES (1, 1, ?)').run(JSON.stringify(DEFAULT_APPEARANCE));
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  return {
    GET() {
      try {
        const row = db.query<{ revision: number; document: string }, []>('SELECT revision, document FROM appearance_preferences WHERE id = 1').get()!;
        const preferences: unknown = JSON.parse(row.document);
        if (!isAppearance(preferences)) throw new Error('Invalid preferences');
        return json({ revision: row.revision, preferences });
      } catch { return json({ error: 'Could not load desktop preferences.' }, 500); }
    },
    async PUT(req: Request) {
      if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return json({ error: 'Invalid origin' }, 403);
      let body: { revision?: number; preferences?: AppearancePreferences };
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || !Number.isSafeInteger(body.revision) || body.revision! < 1 || !isAppearance(body.preferences)) return json({ error: 'Invalid desktop preferences' }, 400);
      try {
        const result = db.query('UPDATE appearance_preferences SET document = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').run(JSON.stringify(body.preferences), body.revision!);
        return result.changes ? json({ revision: body.revision! + 1 }) : json({ error: 'Appearance changed in another window. Reload the saved preferences to continue.' }, 409);
      } catch { return json({ error: 'Could not save desktop preferences.' }, 500); }
    },
  };
}
