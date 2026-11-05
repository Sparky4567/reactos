import { useEffect, useRef, useState } from 'react';

type Mode = 'off' | 'piper' | 'piper-small' | 'web';
const KEY = 'reactos.chat.voice';
// Both voices support the phonemizer's extended IDs, including syllabic mark 144.
const VOICES = { piper: 'en_US-amy-medium', 'piper-small': 'en_US-lessac-low' } as const;
type PiperMode = keyof typeof VOICES;
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
function recognitionConstructor() {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
function load(): Mode {
  try { const mode = localStorage.getItem(KEY); if (mode === 'web' || mode === 'piper' || mode === 'piper-small') return mode; } catch {}
  return 'off';
}
// Only imported after the browser user explicitly enables Piper.
let inferenceQueue: Promise<unknown> = Promise.resolve();
const piperSessions = new Map<PiperMode, Promise<import('@mintplex-labs/piper-tts-web').TtsSession>>();
function getPiper(mode: PiperMode, progress: (message: string) => void) {
  const existing = piperSessions.get(mode);
  if (existing) return existing;
  const pending = inferenceQueue.then(async () => {
    const tts = await import('@mintplex-labs/piper-tts-web');
    // The library otherwise changes voiceId without reloading the model/config.
    // Keep a separate initialized instance for each voice.
    tts.TtsSession._instance = null;
    return tts.TtsSession.create({
      voiceId: VOICES[mode],
      progress: p => progress(p.total ? `Loading voice: ${Math.round(p.loaded / p.total * 100)}%` : 'Loading voice…'),
    });
  }).catch(error => {
    piperSessions.delete(mode);
    throw error;
  });
  inferenceQueue = pending.catch(() => {});
  piperSessions.set(mode, pending);
  return pending;
}

export function useVoice(context: string, append: (text: string) => void) {
  const [mode, setMode] = useState<Mode>(load);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const holding = useRef(false);
  const currentMode = useRef(mode);
  const generation = useRef(0);
  const mounted = useRef(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef('');
  const recognition = useRef<Recognition | null>(null);
  const appendRef = useRef(append); appendRef.current = append;
  const webSupported = 'speechSynthesis' in window;
  const dictationSupported = !!recognitionConstructor() && window.isSecureContext;
  const report = (message: string) => { if (mounted.current) setStatus(message); };
  const stop = () => {
    generation.current++;
    audio.current?.pause(); audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    if (webSupported) window.speechSynthesis.cancel();
    if (mounted.current) { setBusy(false); setPlaying(false); setStatus(''); }
  };
  const stopListening = () => {
    holding.current = false;
    const r = recognition.current;
    recognition.current = null;
    if (r) { r.onresult = r.onerror = r.onend = r.onstart = null; r.abort(); }
    if (mounted.current) { setListening(false); setInterim(''); }
  };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(); stopListening(); };
  }, []);
  useEffect(() => { stop(); stopListening(); }, [context]);
  const choose = (next: Mode) => {
    stop(); currentMode.current = next; setMode(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  const enablePiper = async (next: PiperMode = currentMode.current === 'piper-small' ? 'piper-small' : 'piper') => {
    const label = next === 'piper-small' ? 'Lessac small (low quality)' : 'Amy medium';
    if (!window.confirm(`Enable Piper? Download the English ${label} voice (about 63 MB), plus speech runtime files, from Hugging Face/CDNs. The model is cached in this browser; speech runs locally. Enabling allows automatic downloads again if the browser clears its cache. Continue?`)) return;
    if (!window.isSecureContext || !navigator.storage?.getDirectory) {
      report('Piper requires HTTPS or localhost and browser file storage. Try On [Web].'); return;
    }
    choose(next);
    const id = generation.current;
    setBusy(true); report('Loading voice…');
    try { await getPiper(next, message => { if (id === generation.current) report(message); }); if (id === generation.current) report('Piper ready.'); }
    catch (e) { if (id === generation.current) report(`Piper unavailable: ${(e as Error).message}. Try On [Web].`); }
    finally { if (id === generation.current && mounted.current) setBusy(false); }
  };
  const speak = async (text: string) => {
    if (currentMode.current === 'off' || !text.trim()) return;
    stop(); stopListening();
    const id = generation.current;
    setBusy(true);
    try {
      if (currentMode.current === 'web') {
        if (!webSupported) throw new Error('Browser speech is unavailable.');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => { if (id === generation.current && mounted.current) setPlaying(true); };
        utterance.onend = () => { if (id === generation.current) stop(); };
        utterance.onerror = event => { if (id === generation.current) { stop(); report(`Speech: ${event.error}. Use Read aloud to retry.`); } };
        window.speechSynthesis.speak(utterance);
      } else {
        report('Preparing speech…');
        const session = await getPiper(currentMode.current as PiperMode, message => { if (id === generation.current) report(message); });
        if (id !== generation.current) return;
        // The Piper singleton shares its phonemizer: serialize inference across chat windows.
        const pending = inferenceQueue.then(() => id === generation.current ? session.predict(text) : null);
        inferenceQueue = pending.catch(() => {});
        const wav = await pending;
        if (!wav) return;
        if (id !== generation.current) return;
        url.current = URL.createObjectURL(wav);
        const player = new Audio(url.current); audio.current = player;
        player.onended = () => { if (id === generation.current) stop(); };
        player.onerror = () => { if (id === generation.current) { stop(); report('Audio playback failed. Use Read aloud to retry.'); } };
        await player.play(); if (id === generation.current && mounted.current) { setPlaying(true); report(''); }
      }
    } catch (e) {
      if (id === generation.current && mounted.current) { stop(); report(`Speech unavailable: ${(e as Error).message}. Try On [Web] or Read aloud.`); }
    }
  };
  const finishDictation = () => {
    if (!holding.current) return;
    holding.current = false;
    // stop(), unlike abort(), delivers the final words spoken before release.
    recognition.current?.stop();
    if (mounted.current) setListening(false);
  };
  useEffect(() => {
    const release = () => finishDictation();
    const hide = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  const dictate = () => {
    if (recognition.current) return;
    const Constructor = recognitionConstructor();
    if (!Constructor || !dictationSupported) return;
    stop(); holding.current = true;
    const r = new Constructor(); recognition.current = r;
    r.lang = navigator.language || 'en-US'; r.continuous = true; r.interimResults = true;
    let delivered = 0;
    let pending = '';
    r.onstart = () => {
      if (recognition.current !== r) return;
      if (!holding.current) return;
      setListening(true);
    };
    r.onresult = event => {
      if (recognition.current !== r) return;
      const results = Array.from(event.results);
      const final: string[] = [];
      while (delivered < results.length && results[delivered]!.isFinal) {
        final.push(results[delivered]![0].transcript); delivered++;
      }
      if (final.length) appendRef.current(final.join(' '));
      pending = results.slice(delivered).map(result => result[0].transcript).join(' ');
      setInterim(pending);
    };
    r.onerror = event => {
      if (recognition.current !== r) return;
      if (event.error === 'no-speech') return;
      pending = '';
      holding.current = false; setListening(false); setInterim('');
      report(`Microphone: ${event.error}. Check microphone permission and browser support.`);
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      // Some engines end after stop() without promoting the last interim result.
      // Final results already delivered above have been removed from pending.
      if (pending.trim()) appendRef.current(pending);
      pending = '';
      setInterim('');
      // Some browsers end recognition after silence, even in continuous mode.
      if (holding.current) {
        delivered = 0;
        try { r.start(); return; }
        catch (e) { report((e as Error).message); }
      }
      holding.current = false; recognition.current = null; setListening(false);
    };
    try { r.start(); }
    catch (e) { holding.current = false; recognition.current = null; setListening(false); report((e as Error).message); }
  };
  return { mode, choose, enablePiper, speak, stop, stopListening, dictate, finishDictation, interim, status, busy, playing, listening, webSupported, dictationSupported };
}
