import { describe, expect, test } from 'bun:test';
import { activation, editMemory, forget, memoryEditError, recall, remember, reviewMemory } from './memory';

describe('Qualia browser memory', () => {
  test('deduplicates and reinforces an existing memory', () => {
    const first = remember([], 'I prefer TypeScript', 1000);
    const second = remember(first, 'i prefer typescript', 1000);
    expect(second).toHaveLength(1);
    expect(second[0]!.activation).toBeCloseTo(0.65);
  });
  test('decays over time without negative elapsed time', () => {
    const [memory] = remember([], 'TypeScript project', 1000);
    expect(activation(memory!, 1000 + 86400000)).toBeCloseTo(0.5 * Math.exp(-0.02));
    expect(activation(memory!, 0)).toBe(0.5);
  });
  test('recalls relevant memories and learns associations without recalling unrelated facts', () => {
    let memories = remember([], 'TypeScript chatbot project', 1000);
    memories = remember(memories, 'TypeScript preference', 1000);
    memories = remember(memories, 'I enjoy gardening', 1000);
    const result = recall(memories, 'TypeScript chatbot', 2000);
    expect(result.selected).toHaveLength(2);
    expect(result.selected[0]!.content).toContain('chatbot');
    expect(Object.keys(result.memories[0]!.links)).toContain(memories[1]!.id);
    expect(result.memories[2]!.lastSpike).toBe(1000);
    const forgotten = forget(result.memories, memories[1]!.id);
    expect(forgotten).toHaveLength(2);
    expect(Object.keys(forgotten[0]!.links)).toHaveLength(0);
  });
  test('consolidates strong memories only after the interval and caps associations', () => {
    let memories = remember([], 'shared project 0', 0);
    for (let i = 1; i < 15; i++) memories = remember(memories, `shared project ${i}`, 0);
    for (let i = 0; i < 20; i++) memories = recall(memories, `shared project ${i % 15}`, 600001 + i).memories;
    expect(memories.some(m => m.importance > 0.5)).toBe(true);
    expect(memories.every(m => Object.keys(m.links).length <= 8)).toBe(true);
    expect(memories.every(m => m.activation <= 1)).toBe(true);
  });
  test('bounds memory storage and skips empty content', () => {
    expect(remember([], '  ')).toEqual([]);
    let memories = [] as ReturnType<typeof remember>;
    for (let i = 0; i < 510; i++) memories = remember(memories, `Fact ${i}`);
    expect(memories).toHaveLength(500);
  });
});

describe('Memory reviews and corrections', () => {
  test('corrects content, preserves identity and clears old associations in both directions', () => {
    const original = recall(remember(remember([], 'project uses SQLite', 1000), 'project ships tomorrow', 1000), 'project', 2000).memories;
    const id = original[0]!.id;
    expect(Object.keys(original[0]!.links)).toHaveLength(1);
    const corrected = editMemory(original, id, '  preference for PostgreSQL  ', 0.9, 3000);
    expect(corrected[0]!.id).toBe(id);
    expect(corrected[0]!.content).toBe('preference for PostgreSQL');
    expect(corrected[0]!.createdAt).toBe(1000);
    expect(corrected[0]!.updatedAt).toBe(3000);
    expect(corrected[0]!.reviewedAt).toBe(3000);
    expect(corrected[0]!.activation).toBe(0.5);
    expect(corrected[0]!.importance).toBe(0.9);
    expect(corrected.every(m => Object.keys(m.links).length === 0)).toBe(true);
    expect(recall(corrected, 'SQLite', 4000).selected).toHaveLength(0);
    expect(recall(corrected, 'PostgreSQL', 4000).selected[0]!.id).toBe(id);
    expect(original[0]!.content).toBe('project uses SQLite');
  });
  test('reviewing does not reinforce or change memory text and importance-only edits keep associations', () => {
    const original = recall(remember(remember([], 'project SQLite', 1000), 'project Bun', 1000), 'project', 2000).memories;
    const id = original[0]!.id;
    const reviewed = reviewMemory(original, id, 3000);
    expect(reviewed[0]).toEqual({ ...original[0]!, reviewedAt: 3000 });
    expect(reviewed[1]).toBe(original[1]);
    const edited = editMemory(reviewed, id, reviewed[0]!.content, 0, 4000);
    expect(edited[0]!.importance).toBe(0);
    expect(edited[0]!.links).toEqual(original[0]!.links);
    expect(edited[0]!.lastSpike).toBe(2000);
  });
  test('rejects blank, oversized, duplicate and invalid edits without losing data', () => {
    const original = remember(remember([], 'first fact'), 'second fact');
    const id = original[0]!.id;
    for (const [text, importance] of [[' ', 0.5], ['x'.repeat(2001), 0.5], [' SECOND FACT ', 0.5], ['valid', NaN], ['valid', 2]] as [string, number][]) {
      expect(memoryEditError(original, id, text, importance)).not.toBe('');
      expect(editMemory(original, id, text, importance)).toBe(original);
    }
    expect(editMemory(original, 'missing', 'text', 0.5)).toBe(original);
  });
  test('deletion removes reviewed memories and every incoming association', () => {
    const original = recall(remember(remember([], 'project SQLite'), 'project Bun'), 'project').memories;
    const reviewed = reviewMemory(original, original[0]!.id);
    const deleted = forget(reviewed, original[0]!.id);
    expect(deleted).toHaveLength(1);
    expect(Object.keys(deleted[0]!.links)).toHaveLength(0);
    expect(recall(deleted, 'SQLite').selected).toHaveLength(0);
  });
});
