import { useEffect, useRef, useState } from "react";
import { useOS } from "@/os/store";
import { findNode, resolvePath } from "@/os/fs";

export function Notepad({ windowId }: { windowId?: string }) {
  const { state, dispatch } = useOS();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("Untitled");
  const [wrap, setWrap] = useState(true);
  const [statusBar, setStatusBar] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const saveToOS = (nameOverride?: string) => {
    const base = (nameOverride ?? fileName).trim() || "Untitled";
    const name = base.endsWith(".txt") ? base : `${base}.txt`;
    if (nameOverride) setFileName(base.endsWith(".txt") ? base.replace(/\.txt$/, "") : base);
    dispatch({ type: "FS_CREATE_FILE", path: ["Desktop"], name, content: text });
    dispatch({ type: "FS_WRITE_FILE", path: ["Desktop", name], content: text });
    dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Notepad", body: `Saved ${name} to Desktop`, time: Date.now() } });
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "Untitled"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const newFile = () => {
    if (text && !window.confirm("Discard current changes?")) return;
    setText("");
    setFileName("Untitled");
    setOpenMenu(null);
  };

  const openFile = () => {
    const p = window.prompt("Open file path (e.g. Desktop/readme.txt)", "Desktop/readme.txt");
    if (!p) return;
    const parts = p.split("/").filter(Boolean);
    const node = findNode(state.fs, parts.length ? parts : ["Desktop"]);
    if (!node || node.type !== "file") {
      dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Notepad", body: "File not found", time: Date.now() } });
      return;
    }
    setText(node.content ?? "");
    const nm = parts[parts.length - 1] ?? "Untitled";
    setFileName(nm.replace(/\.txt$/, ""));
    setOpenMenu(null);
  };

  const saveAs = () => {
    const name = window.prompt("Save as", fileName || "Untitled");
    if (!name) return;
    saveToOS(name);
    setOpenMenu(null);
  };

  const exec = (cmd: string) => {
    taRef.current?.focus();
    try { document.execCommand(cmd); } catch {}
    setOpenMenu(null);
  };

  const insertTimeDate = () => {
    const ta = taRef.current;
    if (!ta) return;
    const stamp = new Date().toLocaleString();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setText(text.slice(0, start) + stamp + text.slice(end));
    setOpenMenu(null);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + stamp.length;
    }, 0);
  };

  const findText = () => {
    const q = window.prompt("Find", "");
    if (!q) return;
    const found = (window as any).find ? (window as any).find(q, false, false) : false;
    if (!found) {
      dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Notepad", body: `"${q}" not found`, time: Date.now() } });
    }
    setOpenMenu(null);
  };

  const menu = (name: string, items: { label: string; action: () => void; divider?: boolean; disabled?: boolean }[]) => (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpenMenu(openMenu === name ? null : name)}>{name}</button>
      {openMenu === name && (
        <div className="notepad-dropdown">
          {items.map((it, idx) =>
            it.divider ? (
              <div key={idx} className="notepad-divider" />
            ) : (
              <div
                key={idx}
                className={`notepad-item ${it.disabled ? "disabled" : ""}`}
                onClick={() => { if (!it.disabled) it.action(); }}
              >
                {it.label}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-notepad" ref={menuRef}>
      <div className="notepad-menu">
        {menu("File", [
          { label: "New", action: newFile },
          { label: "Open...", action: openFile },
          { label: "Save", action: () => { saveToOS(); setOpenMenu(null); } },
          { label: "Save As...", action: saveAs },
          { label: "Download", action: () => { download(); setOpenMenu(null); } },
          { divider: true, label: "", action: () => {} },
          { label: "Exit", action: () => { if (windowId) dispatch({ type: "CLOSE_WINDOW", id: windowId }); setOpenMenu(null); } },
        ])}
        {menu("Edit", [
          { label: "Undo", action: () => exec("undo") },
          { label: "Redo", action: () => exec("redo") },
          { divider: true, label: "", action: () => {} },
          { label: "Cut", action: () => exec("cut") },
          { label: "Copy", action: () => exec("copy") },
          { label: "Paste", action: () => exec("paste") },
          { label: "Delete", action: () => exec("delete") },
          { divider: true, label: "", action: () => {} },
          { label: "Select All", action: () => exec("selectAll") },
          { label: "Time/Date", action: insertTimeDate },
          { label: "Find...", action: findText },
        ])}
        {menu("Format", [
          { label: `${wrap ? "✓ " : ""}Word Wrap`, action: () => { setWrap((w) => !w); setOpenMenu(null); } },
          { divider: true, label: "", action: () => {} },
          { label: "Zoom In", action: () => { setZoom((z) => Math.min(500, z + 10)); setOpenMenu(null); } },
          { label: "Zoom Out", action: () => { setZoom((z) => Math.max(10, z - 10)); setOpenMenu(null); } },
          { label: "Restore Default Zoom", action: () => { setZoom(100); setOpenMenu(null); } },
        ])}
        {menu("View", [
          { label: `${statusBar ? "✓ " : ""}Status Bar`, action: () => { setStatusBar((s) => !s); setOpenMenu(null); } },
        ])}
        {menu("Help", [
          { label: "View Help", action: () => { dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Notepad", body: "Help is not available in this demo.", time: Date.now() } }); setOpenMenu(null); } },
          { label: "About Notepad", action: () => { dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "About Notepad", body: "ReactOS Notepad clone", time: Date.now() } }); setOpenMenu(null); } },
        ])}
        <div className="notepad-menu-spacer" />
        <button onClick={() => { saveToOS(); }} title="Save to OS"><i className="fa fa-floppy-o" /> Save</button>
        <button onClick={download} title="Download"><i className="fa fa-download" /> Download</button>
      </div>
      <div className="notepad-titlebar-mini">
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="notepad-filename" />
        <span className="notepad-ext">.txt</span>
      </div>
      <textarea
        ref={taRef}
        className="notepad-textarea"
        style={{ whiteSpace: wrap ? "pre-wrap" : "pre", overflowX: wrap ? "hidden" : "auto", fontSize: `${0.875 * (zoom / 100)}rem` }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="Start typing..."
      />
      {statusBar && (
        <div className="notepad-status">
          <span>Ln {text.split("\n").length}, Col {text.length}</span>
          <span>Zoom: {zoom}%</span>
          <span>UTF-8</span>
          <span>Windows (CRLF)</span>
        </div>
      )}
    </div>
  );
}
