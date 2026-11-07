import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useVoice } from './useVoice';

// Server rendering supplies real hook refs without requiring a DOM or microphone.
// Drive the browser's asynchronous recognition callbacks explicitly below.
function withDictation(run: (voice: ReturnType<typeof useVoice>, recognition: FakeRecognition, text: string[], completions: string[][]) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    SpeechRecognition: FakeRecognition, isSecureContext: true,
  } });
  const text: string[] = [];
  const completions: string[][] = [];
  let voice!: ReturnType<typeof useVoice>;
  function Harness() { voice = useVoice('session', value => text.push(value), () => completions.push([...text])); return null; }
  try {
    renderToStaticMarkup(createElement(Harness));
    voice.dictate();
    const recognition = FakeRecognition.latest;
    recognition.onstart?.();
    run(voice, recognition, text, completions);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

class FakeRecognition {
  static latest: FakeRecognition;
  onstart?: () => void;
  onresult?: (event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void;
  onend?: () => void;
  stops = 0;
  constructor() { FakeRecognition.latest = this; }
  start() {}
  stop() { this.stops++; }
  abort() {}
  result(...results: [string, boolean][]) {
    this.onresult?.({ results: results.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })) });
  }
}

test('release preserves interim words when the browser ends without a final result', () => {
  withDictation((voice, recognition, text) => {
    recognition.result(['hello world', false]);
    voice.finishDictation();
    voice.finishDictation(); // pointerup followed by lostpointercapture
    expect(recognition.stops).toBe(1);
    recognition.onend?.();
    expect(text).toEqual(['hello world']);
  });
});

test('a final result arriving after release replaces interim words without duplication', () => {
  withDictation((voice, recognition, text) => {
    recognition.result(['hello', false]);
    voice.finishDictation();
    recognition.result(['hello world', true]);
    recognition.onend?.();
    expect(text).toEqual(['hello world']);
  });
});

test('already delivered final segments are not repeated when pending words are preserved', () => {
  withDictation((voice, recognition, text) => {
    recognition.result(['first sentence', true], ['last words', false]);
    voice.finishDictation();
    recognition.onend?.();
    expect(text).toEqual(['first sentence', 'last words']);
  });
});


test('completion waits for release and includes every final and pending segment', () => {
  withDictation((voice, recognition, text, completions) => {
    recognition.result(['first sentence', true], ['last words', false]);
    expect(completions).toEqual([]);
    voice.finishDictation();
    expect(completions).toEqual([]);
    recognition.onend?.();
    expect(completions).toEqual([['first sentence', 'last words']]);
  });
});

test('empty and cancelled dictation do not complete a prompt', () => {
  withDictation((voice, recognition, text, completions) => {
    voice.finishDictation();
    recognition.onend?.();
    expect(completions).toEqual([]);
  });
  withDictation((voice, recognition, text, completions) => {
    recognition.result(['cancelled words', true]);
    voice.stopListening();
    recognition.onend?.();
    expect(completions).toEqual([]);
  });
});
