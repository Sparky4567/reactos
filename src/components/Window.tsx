import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOS } from "@/os/store";
import { APP_MAP } from "@/os/apps";

export function WindowChrome({ winId }: { winId: string }) {
  const { state, dispatch } = useOS();
  const win = state.windows.find((w) => w.id === winId)!;
  const app = APP_MAP[win.appId]!;
  const active = state.activeId === winId;

  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      dispatch({ type: "MOVE", id: winId, x: d.winX + (e.clientX - d.startX), y: d.winY + (e.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [winId, dispatch]);

  const startDrag = (e: React.MouseEvent) => {
    if (win.maximized) return;
    dispatch({ type: "FOCUS", id: winId });
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
    setDragging(true);
    e.preventDefault();
  };

  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number; x: number; y: number; dir: string } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      let newW = r.w;
      let newH = r.h;
      let newX = r.x;
      let newY = r.y;
      if (r.dir.includes("e")) newW = r.w + (e.clientX - r.startX);
      if (r.dir.includes("s")) newH = r.h + (e.clientY - r.startY);
      if (r.dir.includes("w")) {
        newW = r.w - (e.clientX - r.startX);
        newX = r.x + (e.clientX - r.startX);
      }
      if (r.dir.includes("n")) {
        newH = r.h - (e.clientY - r.startY);
        newY = r.y + (e.clientY - r.startY);
      }
      dispatch({ type: "RESIZE", id: winId, width: newW, height: newH, x: newX, y: newY });
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [winId, dispatch]);

  const startResize = (dir: string) => (e: React.MouseEvent) => {
    if (win.maximized) return;
    dispatch({ type: "FOCUS", id: winId });
    resizeRef.current = { startX: e.clientX, startY: e.clientY, w: win.width, h: win.height, x: win.x, y: win.y, dir };
    e.preventDefault();
    e.stopPropagation();
  };

  if (win.minimized) return null;

  const Comp = app.component;

  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: 0, width: "100%", height: "calc(100vh - 48px)", zIndex: win.z }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z };

  return (
    <div
      className={`os-window ${active ? "active" : ""} ${dragging ? "dragging" : ""}`}
      style={style}
      onMouseDown={() => dispatch({ type: "FOCUS", id: winId })}
    >
      <div className="os-window-titlebar" onMouseDown={startDrag} onDoubleClick={() => dispatch({ type: win.maximized ? "RESTORE" : "MAXIMIZE", id: winId })}>
        <div className="os-window-title">
          <i className={`fa ${app.icon}`} />
          <span>{win.title}</span>
        </div>
        <div className="os-window-controls">
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: "MINIMIZE", id: winId }); }} title="Minimize">
            <i className="fa fa-minus" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: win.maximized ? "RESTORE" : "MAXIMIZE", id: winId }); }} title="Maximize">
            <i className={`fa ${win.maximized ? "fa-clone" : "fa-square-o"}`} />
          </button>
          <button className="close" onClick={(e) => { e.stopPropagation(); dispatch({ type: "CLOSE_WINDOW", id: winId }); }} title="Close">
            <i className="fa fa-times" />
          </button>
        </div>
      </div>
      <div className="os-window-body">
        <Comp windowId={winId} />
      </div>
      {!win.maximized && (
        <>
          <div className="resize-handle n" onMouseDown={startResize("n")} />
          <div className="resize-handle s" onMouseDown={startResize("s")} />
          <div className="resize-handle e" onMouseDown={startResize("e")} />
          <div className="resize-handle w" onMouseDown={startResize("w")} />
          <div className="resize-handle ne" onMouseDown={startResize("ne")} />
          <div className="resize-handle nw" onMouseDown={startResize("nw")} />
          <div className="resize-handle se" onMouseDown={startResize("se")} />
          <div className="resize-handle sw" onMouseDown={startResize("sw")} />
        </>
      )}
    </div>
  );
}

export function WindowManager() {
  const { state } = useOS();
  const sorted = [...state.windows].sort((a, b) => a.z - b.z);
  return (
    <div className="os-windows-layer">
      {sorted.map((w) => (
        <WindowChrome key={w.id} winId={w.id} />
      ))}
    </div>
  );
}
// keep ReactNode import used
export type _RN = ReactNode;
