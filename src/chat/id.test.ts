import { expect, test } from 'bun:test';
import { chatId } from './id';
import { loadChat, newSession } from './state';
import { remember } from './memory';

test('uses native UUID generation when available', () => {
  expect(chatId({ randomUUID: () => '12345678-1234-4234-8234-123456789abc', getRandomValues: crypto.getRandomValues.bind(crypto) })).toBe('12345678-1234-4234-8234-123456789abc');
});

test('creates unique version 4 UUIDs without randomUUID', () => {
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = Array.from({ length: 1000 }, () => chatId(source));
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('chat startup and memory creation work in an insecure context', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: source });
    expect(newSession().id).toHaveLength(36);
    const chat = loadChat();
    expect(chat.activeId).toBe(chat.sessions[0]!.id);
    expect(remember([], 'Remember this')[0]!.id).toHaveLength(36);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});
