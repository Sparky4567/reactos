import { useEffect, useRef, useState } from 'react';
import { recognitionConstructor } from './useVoice';
import { wakeCommand } from './wakeWord';

export function useWakeListening(enabled: boolean, paused: boolean, wakeWord: string, context: string, append: (text: string) => void) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [interim, setInterim] = useState('');
  const appendRef = useRef(append); appendRef.current = append;
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    setError('');
    setInterim('');
    if (!enabled || paused || !visible || !wakeWord.trim()) { setStatus(''); return; }
    const Constructor = recognitionConstructor();
    if (!Constructor || !window.isSecureContext) return;
    let disposed = false;
    let failed = false;
    let armedUntil = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let armTimer: ReturnType<typeof setTimeout> | undefined;
    const r = new Constructor();
    r.lang = navigator.language || 'en-US';
    // Each recognition session ends at a pause, returning to wake-word detection.
    r.continuous = false;
    r.interimResults = true;
    const waiting = () => setStatus(`Waiting for “${wakeWord.trim()}”…`);
    r.onstart = () => { if (!disposed && !armedUntil) waiting(); };
    let delivered = 0;
    r.onresult = event => {
      if (disposed || failed) return;
      const results = Array.from(event.results);
      while (delivered < results.length && results[delivered]!.isFinal) {
        const transcript = results[delivered++]![0].transcript;
        const command = wakeCommand(transcript, wakeWord);
        if (command !== null) {
          if (command) { clearTimeout(armTimer); appendRef.current(command); armedUntil = 0; waiting(); }
          else {
            armedUntil = Date.now() + 8000;
            setStatus('Wake word detected. Speak your message…');
            clearTimeout(armTimer);
            armTimer = setTimeout(() => { armedUntil = 0; if (!disposed) waiting(); }, 8000);
          }
        } else if (Date.now() < armedUntil) {
          clearTimeout(armTimer); appendRef.current(transcript.trim()); armedUntil = 0; waiting();
        }
      }
      const partial = results.slice(delivered).map(result => result[0].transcript).join(' ');
      const command = wakeCommand(partial, wakeWord);
      setInterim(command !== null ? command : Date.now() < armedUntil ? partial : '');
      if (command !== null || Date.now() < armedUntil) setStatus(`Listening: ${command ?? partial}`);
    };
    r.onerror = event => {
      if (disposed || event.error === 'no-speech') return;
      failed = true;
      setStatus('');
      setError(`Continuous listening stopped: ${event.error}. Turn it off and on to retry.`);
    };
    const start = () => {
      if (disposed || failed) return;
      delivered = 0;
      try { r.start(); }
      catch (e) { failed = true; setStatus(''); setError(`Continuous listening stopped: ${(e as Error).message}`); }
    };
    r.onend = () => {
      if (!disposed) setInterim('');
      if (!disposed && !failed) timer = setTimeout(start, 300);
    };
    start();
    return () => {
      disposed = true; clearTimeout(timer); clearTimeout(armTimer);
      r.onstart = r.onresult = r.onerror = r.onend = null;
      r.abort();
    };
  }, [enabled, paused, visible, wakeWord, context]);
  return { status, error, interim };
}
