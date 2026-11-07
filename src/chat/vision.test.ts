import { expect, test } from 'bun:test';
import { visionRoute, MAX_VISION_BYTES } from './vision';
import { ChatDatabase } from './database';
import { isChatDocument, type ChatDocument } from './document';
import { newSession } from './state';
import { messageForModel } from './imageContext';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function upload(body: BodyInit = png, headers: Record<string, string> = {}, query = 'model=moondream%3Alatest') {
  return new Request(`http://localhost/api/ollama/vision?${query}`, { method: 'POST', body, headers });
}
function upstream(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

test('vision sends the exact selected model and image to Ollama and returns bounded observations', async () => {
  const calls: string[] = [];
  const route = visionRoute(() => 'localhost', upstream((url, init) => {
    calls.push(url);
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('moondream:latest');
    if (url.endsWith('/api/show')) return Response.json({ capabilities: ['completion', 'vision'] });
    expect(body.messages[0].images).toEqual([png.toString('base64')]);
    expect(body.stream).toBe(false);
    expect(body.keep_alive).toBe(0);
    return Response.json({ message: { content: 'A small white image.' } });
  }));
  const res = await route(upload());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ description: 'A small white image.' });
  expect(calls).toHaveLength(2);
});

test('invalid images, oversized streams and foreign origins never reach inference', async () => {
  let calls = 0;
  const route = visionRoute(() => 'localhost', upstream(() => { calls++; throw new Error('Unexpected inference'); }));
  expect((await route(upload(png, { origin: 'http://foreign.test' }))).status).toBe(403);
  expect((await route(upload('not an image'))).status).toBe(415);
  expect((await route(upload(png, {}, ''))).status).toBe(400);
  expect((await route(upload(new Uint8Array(MAX_VISION_BYTES + 1)))).status).toBe(413);
  expect(calls).toBe(0);
});

test('text-only models and servers missing vision capability reporting cannot silently ignore images', async () => {
  for (const info of [{ capabilities: ['completion'] }, { details: { family: 'moondream' } }]) {
    let calls = 0;
    const route = visionRoute(() => 'localhost', upstream(() => { calls++; return Response.json(info); }));
    const response = await route(upload());
    expect(response.status).toBe(400);
    expect(calls).toBe(1);
  }
});

test('vision errors and empty descriptions are surfaced without fabricated success', async () => {
  for (const result of [{ error: 'Failed to load projector' }, { message: { content: '' } }]) {
    const route = visionRoute(() => 'localhost', upstream(url => url.endsWith('/api/show')
      ? Response.json({ capabilities: ['vision'] }) : Response.json(result)));
    expect((await route(upload())).status).toBe(502);
  }
});

test('recognition settings and observations persist while old text-only chats remain valid', () => {
  const session = newSession();
  const doc: ChatDocument = { chat: { sessions: [session], activeId: session.id, personas: [], memories: [] }, settings: { host: 'localhost', model: 'chat', fontScale: 1 } };
  expect(isChatDocument(doc)).toBe(true);
  doc.settings.imageRecognition = true;
  doc.settings.imageModel = 'moondream:latest';
  session.messages.push({ id: 'image', role: 'user', content: 'What color?', imageObservation: { name: 'photo.jpg', model: 'moondream:latest', description: 'A red car.' } });
  expect(isChatDocument(doc)).toBe(true);
  const db = new ChatDatabase(':memory:');
  try {
    db.initialize(doc);
    expect(db.read()!.document).toEqual(doc);
    expect(messageForModel(db.read()!.document.chat.sessions[0]!.messages[0]!).content).toContain('A red car.');
    const invalid = structuredClone(doc);
    invalid.settings.imageRecognition = 'true' as unknown as boolean;
    expect(isChatDocument(invalid)).toBe(false);
    session.messages[0]!.imageObservation!.description = 'x'.repeat(16001);
    expect(isChatDocument(doc)).toBe(false);
  } finally { db.close(); }
});
