import { IMAGE_EXT } from "@/gallery/images";
import { useState } from "react";
import { useOS } from "@/os/store";
import { findNode, formatSize } from "@/os/fs";

export function FileExplorer() {
  const { state, dispatch } = useOS();
  const [path, setPath] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState<string[][]>([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const navigate = (newPath: string[]) => {
    const newHist = history.slice(0, histIdx + 1);
    newHist.push(newPath);
    setHistory(newHist);
    setHistIdx(newHist.length - 1);
    setPath(newPath);
    setSelected(null);
  };

  const node = findNode(state.fs, path) ?? state.fs;
  const crumbs = ["This PC", ...path];

  const open = (n: { name: string; type: string }) => {
    if (n.type === "folder") navigate([...path, n.name]);
    else if (IMAGE_EXT.test(n.name)) dispatch({ type: "OPEN_APP", appId: "gallery", filePath: [...path, n.name] });
    else setSelected(n.name);
  };

  const up = () => { if (path.length > 0) navigate(path.slice(0, -1)); };
  const goBack = () => { if (histIdx > 0) { const i = histIdx - 1; setHistIdx(i); setPath(history[i]!); setSelected(null); } };
  const goForward = () => { if (histIdx < history.length - 1) { const i = histIdx + 1; setHistIdx(i); setPath(history[i]!); setSelected(null); } };

  const onItemContextMenu = (e: React.MouseEvent, name: string, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    const itemPath = [...path, name];
    dispatch({
      type: "SET_CONTEXT_MENU",
      menu: {
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: "Open", icon: type === "folder" ? "fa-folder-open" : "fa-file", action: () => open({ name, type }) },
          { divider: true, label: "" },
          { label: "Rename", icon: "fa-pencil", action: () => { setRenaming(name); setRenameValue(name); } },
          { label: "Delete", icon: "fa-trash", action: () => dispatch({ type: "FS_DELETE", path: itemPath }) },
          ...(type === "file" ? [
            { divider: true, label: "" },
            { label: "Edit with Notepad", icon: "fa-file-text-o", action: () => dispatch({ type: "OPEN_APP", appId: "notepad" }) },
          ] : []),
        ],
      },
    });
  };

  const onBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch({
      type: "SET_CONTEXT_MENU",
      menu: {
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: "New folder", icon: "fa-folder", action: () => {
            const name = window.prompt("Folder name", "New folder");
            if (name) dispatch({ type: "FS_CREATE_FOLDER", path, name });
          }},
          { label: "New text document", icon: "fa-file-text-o", action: () => {
            const name = window.prompt("File name", "New Text Document.txt");
            if (name) dispatch({ type: "FS_CREATE_FILE", path, name, content: "" });
          }},
          { divider: true, label: "" },
          { label: "Refresh", icon: "fa-refresh", action: () => {} },
        ],
      },
    });
  };

  const commitRename = (oldName: string) => {
    if (renameValue && renameValue !== oldName) {
      dispatch({ type: "FS_RENAME", path: [...path, oldName], name: renameValue });
    }
    setRenaming(null);
  };

  const allItems = node.children ?? [];
  const items = searchQuery
    ? allItems.filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allItems;

  return (
    <div className="app-explorer" onContextMenu={onBackgroundContextMenu}>
      <div className="explorer-toolbar">
        <button onClick={up} disabled={path.length === 0} title="Up"><i className="fa fa-arrow-up" /></button>
        <button title="Back" onClick={goBack} disabled={histIdx === 0}><i className="fa fa-arrow-left" /></button>
        <button title="Forward" onClick={goForward} disabled={histIdx >= history.length - 1}><i className="fa fa-arrow-right" /></button>
        <div className="explorer-address">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <i className="fa fa-chevron-right crumb-sep" />}
              <button className="crumb" onClick={() => { navigate(path.slice(0, i)); }}>{c}</button>
            </span>
          ))}
        </div>
        <input className="explorer-search" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <button title="New folder" onClick={() => {
          const name = window.prompt("Folder name", "New folder");
          if (name) dispatch({ type: "FS_CREATE_FOLDER", path, name });
        }}><i className="fa fa-folder" /></button>
        <button title="New file" onClick={() => {
          const name = window.prompt("File name", "New Text Document.txt");
          if (name) dispatch({ type: "FS_CREATE_FILE", path, name, content: "" });
        }}><i className="fa fa-file" /></button>
      </div>
      <div className="explorer-body">
        <aside className="explorer-sidebar">
          <div className="sidebar-item active"><i className="fa fa-desktop" /> Quick access</div>
          <div className="sidebar-item" onClick={() => navigate(["Desktop"])}><i className="fa fa-folder" /> Desktop</div>
          <div className="sidebar-item" onClick={() => navigate(["Documents"])}><i className="fa fa-file-text-o" /> Documents</div>
          <div className="sidebar-item" onClick={() => navigate(["Downloads"])}><i className="fa fa-download" /> Downloads</div>
          <div className="sidebar-item" onClick={() => navigate(["Pictures"])}><i className="fa fa-picture-o" /> Pictures</div>
          <div className="sidebar-item" onClick={() => navigate([])}><i className="fa fa-hdd-o" /> This PC</div>
        </aside>
        <main className="explorer-main">
          <div className="explorer-grid">
            {items.map((n) => (
              <div
                key={n.name}
                className={`explorer-item ${selected === n.name ? "selected" : ""}`}
                onDoubleClick={() => open(n)}
                onClick={() => setSelected(n.name)}
                onContextMenu={(e) => onItemContextMenu(e, n.name, n.type)}
              >
                <i className={`fa ${n.type === "folder" ? "fa-folder" : "fa-file-o"} explorer-icon`} />
                {renaming === n.name ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(n.name)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(n.name); if (e.key === "Escape") setRenaming(null); }}
                    style={{ width: "100%", fontSize: "0.75rem" }}
                  />
                ) : (
                  <span className="explorer-label">{n.name}</span>
                )}
                {n.type === "file" && <span className="explorer-label" style={{ fontSize: "0.625rem", opacity: 0.6 }}>{formatSize(n.size)}</span>}
              </div>
            ))}
            {items.length === 0 && <div className="explorer-empty">This folder is empty.</div>}
          </div>
        </main>
      </div>
      <div className="explorer-status">{items.length} items</div>
    </div>
  );
}