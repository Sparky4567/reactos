import { useEffect, useRef, useState } from 'react';
import type { ChatState } from './state';
import { isChatDocument, type ChatDocument, type ChatSettings } from './document';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
export function useChatPersistence(chat: ChatState, settings: ChatSettings, setChat: Setter<ChatState>, setSettings: Setter<ChatSettings>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Loading saved chats…');
  const [attempt, setAttempt] = useState(0);
  const initial = useRef<ChatDocument>({ chat, settings });
  const latest = useRef('');
  const saved = useRef('');
  const revision = useRef(0);
  const blocked = useRef(false);
  const inFlight = useRef(false);
  const lastSent = useRef('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/chat/state', { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load saved chats. Your existing data has not been overwritten.');
        let data = await res.json();
        if (!data) {
          const imported = await fetch('/api/chat/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(initial.current) });
          if (!imported.ok) throw new Error('Could not migrate browser chats to SQLite. Your browser copy is still available.');
          data = await imported.json();
        }
        if (!isChatDocument(data?.document) || !Number.isSafeInteger(data.revision)) throw new Error('The server returned invalid saved data.');
        if (cancelled) return;
        revision.current = data.revision;
        saved.current = latest.current = JSON.stringify(data.document);
        setChat(data.document.chat);
        setSettings(data.document.settings);
        window.dispatchEvent(new CustomEvent('reactos-font-scale', { detail: data.document.settings.fontScale }));
        setError(''); setStatus('Saved to SQLite'); setReady(true);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    };
    void load();
    return () => { cancelled = true; };
  }, [attempt, setChat, setSettings]);

  useEffect(() => {
    if (!ready) return;
    latest.current = JSON.stringify({ chat, settings });
    if (latest.current !== saved.current) setStatus('Saving…');
  }, [chat, settings, ready]);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const flush = async (keepalive = false) => {
      if (blocked.current || inFlight.current || latest.current === saved.current) return;
      const snapshot = latest.current;
      lastSent.current = snapshot;
      inFlight.current = true;
      try {
        const res = await fetch('/api/chat/state', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: revision.current, document: JSON.parse(snapshot) }), keepalive,
        });
        const data = await res.json();
        if (!res.ok) {
          // An unknown outcome also requires a reload: never blindly overwrite a newer revision.
          blocked.current = true;
          throw new Error(data.error || 'Could not save chats. Reload to reconnect to the database.');
        }
        if (!Number.isSafeInteger(data.revision)) throw new Error('Invalid save response. Reload to check saved data.');
        revision.current = data.revision;
        saved.current = snapshot;
        if (!disposed) { setError(''); setStatus(latest.current === saved.current ? 'Saved to SQLite' : 'Saving…'); }
      } catch (e) {
        blocked.current = true;
        if (!disposed) { setError((e as Error).message); setStatus('Changes not saved'); }
      } finally { inFlight.current = false; }
    };
    const timer = window.setInterval(() => { void flush(); }, 400);
    const hide = () => { void flush(true); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      disposed = true; clearInterval(timer);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('beforeunload', beforeUnload);
      void flush(true);
    };
  }, [ready]);
  const retrySave = async () => {
    try {
      const res = await fetch('/api/chat/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('The database is still unavailable. Your unsaved changes remain in this window.');
      const data = await res.json();
      if (!isChatDocument(data?.document) || !Number.isSafeInteger(data.revision)) throw new Error('Invalid saved data.');
      const remote = JSON.stringify(data.document);
      if (remote !== saved.current && remote !== lastSent.current) throw new Error('Another window saved changes. Reload to load the latest saved data.');
      // A lost HTTP response may hide a successful commit. Reconcile before retrying.
      revision.current = data.revision;
      saved.current = remote;
      blocked.current = false;
      setError(''); setStatus(latest.current === remote ? 'Saved to SQLite' : 'Saving…');
    } catch (e) { setError((e as Error).message); }
  };
  return { ready, error, status, retrySave, retryLoad: () => { setError(''); setAttempt(n => n + 1); } };
}
