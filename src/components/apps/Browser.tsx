import { useState } from "react";

interface Tab { id: number; title: string; }

export function Browser() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, title: "New Tab" }]);
  const [activeTab, setActiveTab] = useState(1);
  const [history, setHistory] = useState<string[]>(["https://www.bing.com"]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("https://www.bing.com");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const url = history[idx] ?? "https://www.bing.com";

  const go = (target?: string) => {
    let t = (target ?? input).trim();
    if (!/^https?:\/\//i.test(t)) {
      // If it looks like a domain/host, treat it as a URL instead of a search query.
      if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(t) || /^localhost(:\d+)?(\/.*)?$/i.test(t)) {
        t = "https://" + t;
      } else {
        t = "https://www.bing.com/search?q=" + encodeURIComponent(t);
      }
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
  const reload = () => { setLoading(true); };

  const newTab = () => {
    const id = Date.now();
    setTabs((t) => [...t, { id, title: "New Tab" }]);
    setActiveTab(id);
    const h = ["https://www.bing.com"];
    setHistory(h);
    setIdx(0);
    setInput("https://www.bing.com");
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
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: 12 }} onClick={() => { newTab(); setMenuOpen(false); }}>New tab</div>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: 12 }} onClick={() => { go("https://www.bing.com"); setMenuOpen(false); }}>Home</div>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: 12 }} onClick={() => { window.open(url, "_blank"); setMenuOpen(false); }}>Open in new window</div>
            </div>
          )}
        </div>
      </div>
      <div className="browser-body">
        {loading && <div className="browser-loading" />}
        <iframe
          src={`/api/proxy?url=${encodeURIComponent(url)}`}
          title="browser"
          onLoad={() => setLoading(false)}
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        />
      </div>
    </div>
  );
}