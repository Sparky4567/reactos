import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { isChatDocument } from './document';
import type { Trace } from './memory';

function validMemories(memories: unknown): memories is Trace[] {
  return isChatDocument({
    settings: { host: '', model: '', fontScale: 1 },
    chat: { activeId: 'validation', sessions: [{ id: 'validation', title: '', persona: '', memoryEnabled: true, messages: [] }], personas: [], memories },
  });
}

// A portable, versioned memory snapshot. Never treat malformed data as an empty list.
export class MemoryJsonStorage {
  constructor(readonly path: string) {}
  read(): Trace[] | null {
    let source: string;
    try { source = readFileSync(this.path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const data = JSON.parse(source);
    if (data?.version !== 1 || !validMemories(data.memories)) throw new Error(`Invalid memory JSON: ${this.path}`);
    return data.memories;
  }
  write(memories: Trace[]): void {
    if (!validMemories(memories)) throw new Error('Invalid memories');
    const source = JSON.stringify({ version: 1, memories }, null, 2) + '\n';
    // Avoid rewriting the file for saves that only change chats or settings.
    try { if (readFileSync(this.path, 'utf8') === source) return; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${crypto.randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, source, { flag: 'wx' });
      renameSync(temporary, this.path);
    } finally { rmSync(temporary, { force: true }); }
  }
}
