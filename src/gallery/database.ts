import type { Database } from 'bun:sqlite';
import { detectImage, MAX_IMAGE_BYTES, type GalleryImage } from './images';

export function galleryRoutes(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    size INTEGER NOT NULL, createdAt TEXT NOT NULL, bytes BLOB NOT NULL
  )`);
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const foreign = (req: Request) => !!req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin;
  const collection = {
    GET() {
      try { return json(db.query<GalleryImage, []>('SELECT id, name, type, size, createdAt FROM gallery_images ORDER BY createdAt DESC, id').all()); }
      catch { return json({ error: 'Could not load the gallery.' }, 500); }
    },
    async POST(req: Request) {
      if (foreign(req)) return json({ error: 'Invalid origin' }, 403);
      if (Number(req.headers.get('content-length')) > MAX_IMAGE_BYTES) return json({ error: 'Images must be 20 MB or smaller.' }, 413);
      try {
        let name: string;
        try { name = decodeURIComponent(req.headers.get('X-Image-Name') || 'Image').trim().slice(0, 255) || 'Image'; }
        catch { return json({ error: 'Invalid image name.' }, 400); }
        const reader = req.body?.getReader();
        if (!reader) return json({ error: 'Missing image.' }, 400);
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_IMAGE_BYTES) { await reader.cancel(); return json({ error: 'Images must be 20 MB or smaller.' }, 413); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const type = detectImage(bytes);
        if (!type) return json({ error: 'Choose a PNG, JPEG, GIF, WebP, AVIF, or BMP image.' }, 415);
        const image: GalleryImage = { id: crypto.randomUUID(), name, type, size, createdAt: new Date().toISOString() };
        db.query('INSERT INTO gallery_images (id, name, type, size, createdAt, bytes) VALUES (?, ?, ?, ?, ?, ?)').run(image.id, name, type, size, image.createdAt, bytes);
        return json(image, 201);
      } catch { return json({ error: 'Could not save the image. Please try again.' }, 500); }
    },
  };
  const item = {
    GET(req: Request) {
      try {
        const id = new URL(req.url).pathname.split('/').pop() || '';
        const row = db.query<GalleryImage & { bytes: Uint8Array }, [string]>('SELECT * FROM gallery_images WHERE id = ?').get(id);
        if (!row) return json({ error: 'Image not found.' }, 404);
        return new Response(new Uint8Array(row.bytes).buffer, { headers: { 'Content-Type': row.type, 'Content-Length': String(row.size), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name).replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16))}` } });
      } catch { return json({ error: 'Could not read the image.' }, 500); }
    },
    DELETE(req: Request) {
      if (foreign(req)) return json({ error: 'Invalid origin' }, 403);
      try {
        const id = new URL(req.url).pathname.split('/').pop() || '';
        const result = db.query('DELETE FROM gallery_images WHERE id = ?').run(id);
        return result.changes ? new Response(null, { status: 204 }) : json({ error: 'Image not found.' }, 404);
      } catch { return json({ error: 'Could not delete the image.' }, 500); }
    },
  };
  return { collection, item };
}
