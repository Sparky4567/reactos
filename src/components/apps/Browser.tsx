import { useState, useEffect } from "react";

interface Tab { id: number; title: string; }

function proxyUrl(target: string): string {
  return `/api/proxy?url=${encodeURIComponent(target)}`;
}

async function fetchText(target: string): Promise<string> {
  const res = await fetch(proxyUrl(target));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function resolveUrl(raw: string, base: string): string {
  try {
    return new URL(raw, base).href;
  } catch {
    return raw;
  }
}

function isBingUrl(target: string): boolean {
  return /bing\.com/i.test(target);
}

export function Browser({ windowId }: { windowId?: string }) {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, title: "New Tab" }]);
  const [activeTab, setActiveTab] = useState(1);
  const [history, setHistory] = useState<string[]>(["https://www.bing.com"]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("https://www.bing.com");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const url = history[idx] ?? "https://www.bing.com";

  const go = (target?: string) => {
    let t = (target ?? input).trim();
    if (!/^https?:\/\//i.test(t)) {
      if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(t) || /^localhost(:\d+)?(\/.*)?$/i.test(t)) {
        t = "https://" + t;
      } else {
        t = "https://www.bing.com/search?q=" + encodeURIComponent(t);
      }
    }
    if (!isBingUrl(t)) {
      window.open(t, "_blank");
      setInput(t);
      return;
    }
    const next = history.slice(0, idx + 1);
    next.push(t);
    setHistory(next);
    setIdx(next.length - 1);
    setInput(t);
    setLoading(true);
  };

  const back = () => { if (idx > 0) { setIdx(idx - 1); setInput(history[idx - 1]!); setLoading(true); } };
  const forward = () => { if (idx < history.length - 1) { setIdx(idx + 1); setInput(history[idx + 1]!); setLoading(true); } };
  const reload = () => { setReloadKey((k) => k + 1); setLoading(true); };

  const newTab = () => {
    const id = Date.now();
    setTabs((t) => [...t, { id, title: "New Tab" }]);
    setActiveTab(id);
    const h = ["https://www.bing.com"];
    setHistory(h);
    setIdx(0);
    setInput("https://www.bing.com");
    setHtml("");
    setError(null);
    setLoading(true);
  };

  const closeTab = (id: number) => {
    setTabs((t) => {
      const filtered = t.filter((x) => x.id !== id);
      if (filtered.length === 0) {
        const nt = { id: Date.now(), title: "New Tab" };
        setActiveTab(nt.id);
        return [nt];
      }
      if (activeTab === id) setActiveTab(filtered[filtered.length - 1]!.id);
      return filtered;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (!isBingUrl(url)) {
          window.open(url, "_blank");
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        const pageUrl = url;
        const htmlText = await fetchText(pageUrl);
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(htmlText, "text/html");

        const cssLinks = Array.from(doc.querySelectorAll('link[rel~="stylesheet"]'));
        await Promise.all(cssLinks.map(async (link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const abs = resolveUrl(href, pageUrl);
          try {
            const css = await fetchText(abs);
            if (cancelled) return;
            const style = doc.createElement("style");
            style.textContent = css;
            const media = link.getAttribute("media");
            if (media) style.setAttribute("media", media);
            link.replaceWith(style);
          } catch {
            // Leave original link in place if fetch fails.
          }
        }));

        if (cancelled) return;

        const scriptTags = Array.from(doc.querySelectorAll("script[src]"));
        await Promise.all(scriptTags.map(async (script) => {
          const src = script.getAttribute("src");
          if (!src) return;
          const abs = resolveUrl(src, pageUrl);
          try {
            const js = await fetchText(abs);
            if (cancelled) return;
            script.removeAttribute("src");
            script.textContent = js;
          } catch {
            // Leave original src in place if fetch fails.
          }
        }));

        if (cancelled) return;

        try {
          const title = doc.title?.trim().slice(0, 40);
          if (title) {
            setTabs((prev) => prev.map((t) => (t.id === activeTab ? { ...t, title } : t)));
          }
        } catch {
          // ignore
        }

        const serialized = "<!DOCTYPE html>\n" + (doc.documentElement?.outerHTML ?? htmlText);
        setHtml(serialized);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setHtml("");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, reloadKey]);

  return (
    <div className="app-browser">
      <div className="browser-tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`browser-tab ${t.id === activeTab ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
            <i className="fa fa-globe" /> {t.title}
            {tabs.length > 1 && <i className="fa fa-times" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }} />}
          </div>
        ))}
        <div className="browser-tab-add" onClick={newTab} title="New tab"><i className="fa fa-plus" /></div>
      </div>
      <div className="browser-toolbar">
        <button title="Back" onClick={back} disabled={idx === 0}><i className="fa fa-arrow-left" /></button>
        <button title="Forward" onClick={forward} disabled={idx >= history.length - 1}><i className="fa fa-arrow-right" /></button>
        <button title="Reload" onClick={reload}><i className="fa fa-refresh" /></button>
        <button title="Home" onClick={() => go("https://www.bing.com")}><i className="fa fa-home" /></button>
        <div className="browser-address">
          <i className="fa fa-lock" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Search or enter URL"
          />
        </div>
        <div style={{ position: "relative" }}>
          <button title="More" onClick={() => setMenuOpen((v) => !v)}><i className="fa fa-ellipsis-h" /></button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: 32, background: "rgba(40,40,40,0.95)", borderRadius: 6, padding: 4, minWidth: 140, zIndex: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "0.75rem" }} onClick={() => { newTab(); setMenuOpen(false); }}>New tab</div>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "0.75rem" }} onClick={() => { go("https://www.bing.com"); setMenuOpen(false); }}>Home</div>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "0.75rem" }} onClick={() => { window.open(url, "_blank"); setMenuOpen(false); }}>Open in new window</div>
            </div>
          )}
        </div>
      </div>
      <div className="browser-body">
        {loading && <div className="browser-loading" />}
        {error && <div style={{ padding: 16, color: "#c00" }}>Failed to load page: {error}</div>}
        {!error && (
          <iframe
            srcDoc={html}
            title="browser"
            onLoad={() => setLoading(false)}
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
