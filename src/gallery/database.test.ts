import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { galleryRoutes } from './database';
import { detectImage, fileSystemImages, MAX_IMAGE_BYTES } from './images';
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), c => c.charCodeAt(0));
const upload = (bytes = png, headers: Record<string, string> = {}) => new Request('http://localhost/api/gallery/images', { method: 'POST', body: new Uint8Array(bytes).buffer, headers: { 'X-Image-Name': encodeURIComponent('Photo 🌻.png'), ...headers } });
describe('Gallery storage', () => {
  test('persists original bytes and metadata across database reopen, and deletes permanently', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reactos-gallery-'));
    let db = new Database(join(dir, 'gallery.sqlite'));
    try {
      let routes = galleryRoutes(db);
      expect(await routes.collection.GET().json()).toEqual([]);
      const uploaded = await routes.collection.POST(upload());
      expect(uploaded.status).toBe(201);
      const image = await uploaded.json();
      expect(image.name).toBe('Photo 🌻.png');
      expect(image.type).toBe('image/png');
      expect(image.size).toBe(png.length);
      db.close();
      db = new Database(join(dir, 'gallery.sqlite'));
      routes = galleryRoutes(db);
      expect(await routes.collection.GET().json()).toEqual([image]);
      const url = `http://localhost/api/gallery/images/${image.id}`;
      const restored = routes.item.GET(new Request(url));
      expect(restored.headers.get('Content-Type')).toBe('image/png');
      expect(restored.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(new Uint8Array(await restored.arrayBuffer())).toEqual(png);
      expect(routes.item.DELETE(new Request(url, { method: 'DELETE' })).status).toBe(204);
      expect(routes.item.GET(new Request(url)).status).toBe(404);
      expect(await routes.collection.GET().json()).toEqual([]);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  test('rejects unsupported content, oversized images, and foreign-origin writes', async () => {
    const db = new Database(':memory:');
    try {
      const routes = galleryRoutes(db);
      expect((await routes.collection.POST(upload(new TextEncoder().encode('<svg onload="alert(1)"/>')))).status).toBe(415);
      expect((await routes.collection.POST(upload(png, { 'content-length': String(MAX_IMAGE_BYTES + 1) }))).status).toBe(413);
      expect((await routes.collection.POST(upload(png, { origin: 'https://foreign.test' }))).status).toBe(403);
      expect(routes.item.DELETE(new Request('http://localhost/api/gallery/images/missing', { method: 'DELETE', headers: { origin: 'https://foreign.test' } })).status).toBe(403);
      expect(await routes.collection.GET().json()).toEqual([]);
    } finally { db.close(); }
  });
  test('finds nested simulated image files without treating arbitrary file content as a source', () => {
    const images = fileSystemImages({ name: 'root', type: 'folder', children: [{ name: 'Pictures', type: 'folder', children: [
      { name: 'image.PNG', type: 'file', content: 'data:image/png;base64,aGVsbG8=' },
      { name: 'empty.jpg', type: 'file', content: '' },
      { name: 'unsafe.gif', type: 'file', content: 'javascript:alert(1)' },
      { name: 'notes.txt', type: 'file', content: 'text' },
    ] }] });
    expect(images).toHaveLength(3);
    expect(images[0]!.path).toEqual(['Pictures', 'image.PNG']);
    expect(images[0]!.src).toStartWith('data:image/png');
    expect(images[1]!.src).toBe('');
    expect(images[2]!.src).toBe('');
    expect(detectImage(png)).toBe('image/png');
    expect(detectImage(new Uint8Array())).toBeNull();
  });
});
