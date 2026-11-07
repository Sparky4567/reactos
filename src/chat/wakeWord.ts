// Match whole words at the start of a recognized sentence, never a substring.
export function wakeCommand(transcript: string, wakeWord: string): string | null {
  const words = wakeWord.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = transcript.trim().match(new RegExp(`^${escaped}(?=$|[\\s,.:;!?])(?:[\\s,.:;!?]+)?`, 'iu'));
  return match ? transcript.trim().slice(match[0].length).trim() : null;
}
