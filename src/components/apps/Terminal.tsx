import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import { executeShell, freshSession, prompt, type ShellSession } from '@/terminal/shell';

export function Terminal() {
  const { state, dispatch } = useOS();
  const [lines, setLines] = useState([
    'ReactOS Terminal',
    '(c) ReactOS. All rights reserved.',
    '',
    "Type 'help' for available commands. Files are shared with the desktop.",
    '',
  ]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<ShellSession>(() => freshSession(state.desktopStyle));
  const [history, setHistory] = useState<string[]>([]);
  const historyPosition = useRef<number | null>(null);
  const draft = useRef('');
  const previousStyle = useRef(state.desktopStyle);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (previousStyle.current === state.desktopStyle) return;
    const wasWindows = previousStyle.current === 'win11';
    const isWindows = state.desktopStyle === 'win11';
    if (wasWindows !== isWindows) setSession(current => ({
      lastCode: current.lastCode,
      cwd: isWindows ? current.cwd.slice(0, 2).join('/') === 'home/user' ? current.cwd.slice(2) : [] : ['home', 'user', ...current.cwd],
    }));
    previousStyle.current = state.desktopStyle;
  }, [state.desktopStyle]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  const run = () => {
    const text = input;
    const nextHistory = text.trim() ? [...history, text].slice(-200) : history;
    const result = executeShell(text, state.fs, session, state.desktopStyle, nextHistory);
    if (result.fs !== state.fs) dispatch({ type: 'FS_REPLACE_ROOT', fs: result.fs });
    setSession({ cwd: result.cwd, previousCwd: result.previousCwd, lastCode: result.lastCode });
    setLines(current => [...(result.clear ? [] : [...current, `${prompt(session.cwd, state.desktopStyle)} ${text}`]), ...(result.output ? result.output.replace(/\n$/, '').split('\n') : [])].slice(-3000));
    setHistory(nextHistory); historyPosition.current = null; draft.current = ''; setInput('');
  };
  return <div className="app-terminal" onClick={e => { if (!(e.target as HTMLElement).closest('a, button') && !window.getSelection()?.toString()) inputRef.current?.focus(); }}>
    <div className="terminal-body" ref={scrollRef} role="log" aria-label="Terminal output" aria-live="polite" aria-relevant="additions">
      {lines.map((line, i) => <div key={i} className="terminal-line">{line || '\u00a0'}</div>)}
    </div>
    <form className="terminal-input-row" onSubmit={e => { e.preventDefault(); run(); }}>
      <label className="terminal-prompt" htmlFor="terminal-command">{prompt(session.cwd, state.desktopStyle)}</label>
      <input id="terminal-command" aria-label="Terminal command" ref={inputRef} value={input} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}
        onChange={e => { setInput(e.target.value); historyPosition.current = null; }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) { if (e.key === 'Enter') e.preventDefault(); return; }
          if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setLines([]); }
          if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); setLines(current => [...current, `${prompt(session.cwd, state.desktopStyle)} ${input}^C`]); setInput(''); historyPosition.current = null; }
          if (e.key === 'ArrowUp' && history.length) {
            e.preventDefault();
            if (historyPosition.current === null) draft.current = input;
            const index = Math.max(0, (historyPosition.current ?? history.length) - 1);
            historyPosition.current = index; setInput(history[index]!);
          }
          if (e.key === 'ArrowDown' && historyPosition.current !== null) {
            e.preventDefault(); const index = historyPosition.current + 1;
            historyPosition.current = index < history.length ? index : null;
            setInput(index < history.length ? history[index]! : draft.current);
          }
        }} />
      <button type="submit" className="terminal-run" aria-label="Run command" title="Run command"><i className="fa fa-level-down" aria-hidden="true" /></button>
    </form>
  </div>;
}
