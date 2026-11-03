import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_APPEARANCE, isAppearance, WALLPAPERS, type AppearancePreferences, type DesktopStyle } from './preferences';
interface AppearanceContext {
  preferences: AppearancePreferences; ready: boolean; error: string; saving: boolean;
  update: (patch: Partial<AppearancePreferences>) => void; reload: () => void; retry: () => void;
}
const Context = createContext<AppearanceContext | null>(null);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = useRef(DEFAULT_APPEARANCE);
  const saved = useRef(JSON.stringify(DEFAULT_APPEARANCE));
  const revision = useRef(0);
  const pending = useRef(false);
  const blocked = useRef(false);
  const lastSent = useRef('');
  const update = useCallback((patch: Partial<AppearancePreferences>) => {
    const next = { ...current.current, ...patch };
    if (patch.desktopStyle && current.current.wallpaper === WALLPAPERS[current.current.desktopStyle]) next.wallpaper = WALLPAPERS[patch.desktopStyle];
    if (!isAppearance(next)) return;
    current.current = next; setPreferences(next); setSaving(JSON.stringify(next) !== saved.current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/appearance', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !isAppearance(data.preferences) || !Number.isSafeInteger(data.revision)) throw new Error(data.error || 'Could not load desktop preferences.');
        if (cancelled) return;
        revision.current = data.revision; current.current = data.preferences; saved.current = JSON.stringify(data.preferences);
        blocked.current = false; setPreferences(data.preferences); setSaving(false); setError(''); setReady(true);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const flush = async (keepalive = false) => {
      const snapshot = JSON.stringify(current.current);
      if (pending.current || blocked.current || snapshot === saved.current) return;
      pending.current = true; lastSent.current = snapshot;
      try {
        const res = await fetch('/api/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: revision.current, preferences: JSON.parse(snapshot) }), keepalive });
        const data = await res.json();
        if (!res.ok || !Number.isSafeInteger(data.revision)) throw new Error(data.error || 'Could not save desktop preferences.');
        saved.current = snapshot; revision.current = data.revision;
        if (!disposed) { setError(''); setSaving(JSON.stringify(current.current) !== snapshot); }
      } catch (e) { blocked.current = true; if (!disposed) { setError((e as Error).message); setSaving(false); } }
      finally { pending.current = false; }
    };
    const timer = setInterval(() => { void flush(); }, 250);
    const hide = () => { void flush(true); };
    const unload = (e: BeforeUnloadEvent) => { if (JSON.stringify(current.current) !== saved.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('pagehide', hide); window.addEventListener('beforeunload', unload);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('pagehide', hide); window.removeEventListener('beforeunload', unload); void flush(true); };
  }, [ready]);
  useEffect(() => {
    document.documentElement.dataset.style = preferences.desktopStyle;
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
  }, [preferences]);
  const retry = async () => {
    try {
      const res = await fetch('/api/appearance', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !isAppearance(data.preferences) || !Number.isSafeInteger(data.revision)) throw new Error('Could not reconnect to desktop preferences.');
      const remote = JSON.stringify(data.preferences);
      if (remote !== saved.current && remote !== lastSent.current) throw new Error('Appearance changed in another window. Reload the saved preferences to continue.');
      saved.current = remote; revision.current = data.revision; blocked.current = false;
      setError(''); setSaving(JSON.stringify(current.current) !== remote);
    } catch (e) { setError((e as Error).message); }
  };
  return <Context.Provider value={{ preferences, ready, error, saving, update, reload: () => setAttempt(n => n + 1), retry: () => { void retry(); } }}>{children}</Context.Provider>;
}
export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('Missing AppearanceProvider');
  return context;
}
export type { DesktopStyle };
