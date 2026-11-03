import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appearanceRoutes } from './database';
import { DEFAULT_APPEARANCE, WALLPAPERS, workspace, type DesktopStyle } from './preferences';
const put = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });
describe('Desktop appearance persistence', () => {
  test('defaults to Ubuntu and restores all three styles, theme and wallpaper after reopening SQLite', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reactos-appearance-'));
    let db = new Database(join(dir, 'preferences.sqlite'));
    try {
      let routes = appearanceRoutes(db);
      expect(await routes.GET().json()).toEqual({ revision: 1, preferences: DEFAULT_APPEARANCE });
      let revision = 1;
      for (const desktopStyle of ['ubuntu', 'win11', 'chromeos'] as DesktopStyle[]) {
        const preferences = { desktopStyle, theme: 'light', wallpaper: WALLPAPERS[desktopStyle] };
        const response = await routes.PUT(put({ revision, preferences }));
        expect(response.status).toBe(200);
        revision++;
        db.close();
        db = new Database(join(dir, 'preferences.sqlite'));
        routes = appearanceRoutes(db);
        expect(await routes.GET().json()).toEqual({ revision, preferences });
      }
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  test('rejects stale writes, malformed preferences, and foreign origins without losing the saved choice', async () => {
    const db = new Database(':memory:');
    try {
      const routes = appearanceRoutes(db);
      const preferences = { ...DEFAULT_APPEARANCE, desktopStyle: 'chromeos' };
      expect((await routes.PUT(put({ revision: 1, preferences }))).status).toBe(200);
      expect((await routes.PUT(put({ revision: 1, preferences: DEFAULT_APPEARANCE }))).status).toBe(409);
      expect((await routes.PUT(put({ revision: 2, preferences: { ...preferences, desktopStyle: 'unknown' } }))).status).toBe(400);
      expect((await routes.PUT(put({ revision: 2, preferences: { ...preferences, theme: 'unknown' } }))).status).toBe(400);
      expect((await routes.PUT(put({ revision: 2, preferences: { ...preferences, wallpaper: 'red;display:none' } }))).status).toBe(400);
      expect((await routes.PUT(put({ revision: 2, preferences }, 'https://foreign.test'))).status).toBe(403);
      expect(await routes.GET().json()).toEqual({ revision: 2, preferences });
      expect(routes.GET().headers.get('Cache-Control')).toBe('no-store');
    } finally { db.close(); }
  });
  test('reserves space for each shell on desktop and compact screens', () => {
    expect(workspace('ubuntu', 1440, 900)).toEqual({ width: 1364, height: 864 });
    expect(workspace('ubuntu', 390, 844)).toEqual({ width: 390, height: 748 });
    expect(workspace('win11', 1440, 900)).toEqual({ width: 1440, height: 852 });
    expect(workspace('chromeos', 1440, 900)).toEqual({ width: 1440, height: 824 });
  });
});
