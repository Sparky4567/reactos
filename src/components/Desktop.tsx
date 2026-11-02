import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useOS } from "@/os/store";
import { APP_MAP } from "@/os/apps";
import { WindowManager } from "./Window";

export function Desktop() {
  const { state, dispatch } = useOS();
  const [dragIcon, setDragIcon] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [iconSize, setIconSize] = useState<"normal" | "large">("normal");
  const [sortBy, setSortBy] = useState<"none" | "name">("none");
  const dragRef = useRef<{ id: string; startX: number; startY: number; iconX: number; iconY: number } | null>(null);

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".os-window, .taskbar, .start-menu, .widgets-panel, .action-center, .context-menu")) return;
      // desktop icon right click handled separately
      if (target.closest(".desktop-icon")) return;
      e.preventDefault();
      dispatch({
        type: "SET_CONTEXT_MENU",
        menu: {
          x: e.clientX,
          y: e.clientY,
          items: [
            { label: "View", icon: "fa-eye", action: () => setIconSize((s) => s === "normal" ? "large" : "normal") },
            { label: "Sort by", icon: "fa-sort", action: () => setSortBy((s) => s === "none" ? "name" : "none") },
            { label: "Refresh", icon: "fa-refresh", action: () => dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Desktop", body: "Refreshed", time: Date.now() } }) },
            { divider: true, label: "" },
            { label: "New folder", icon: "fa-folder", action: () => {
              const name = window.prompt("Folder name", "New folder");
              if (name) dispatch({ type: "FS_CREATE_FOLDER", path: ["Desktop"], name });
            }},
            { label: "New text document", icon: "fa-file-text-o", action: () => {
              const name = window.prompt("File name", "New Text Document.txt");
              if (name) dispatch({ type: "FS_CREATE_FILE", path: ["Desktop"], name, content: "" });
            }},
            { divider: true, label: "" },
            { label: "Display settings", icon: "fa-desktop", action: () => dispatch({ type: "OPEN_APP", appId: "settings" }) },
            { label: "Personalize", icon: "fa-paint-brush", action: () => dispatch({ type: "OPEN_APP", appId: "settings" }) },
          ],
        },
      });
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".start-menu, .widgets-panel, .action-center, .context-menu")) return;
      dispatch({ type: "SET_CONTEXT_MENU", menu: null });
      dispatch({ type: "SET_START", open: false });
      dispatch({ type: "SET_WIDGETS", open: false });
      dispatch({ type: "SET_ACTION_CENTER", open: false });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "OS") {
        dispatch({ type: "SET_START", open: !state.startOpen });
      }
      if (e.key === "Escape") {
        dispatch({ type: "SET_START", open: false });
        dispatch({ type: "SET_WIDGETS", open: false });
        dispatch({ type: "SET_ACTION_CENTER", open: false });
        dispatch({ type: "SET_CONTEXT_MENU", menu: null });
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      dispatch({ type: "MOVE_DESKTOP_ICON", id: d.id, x: d.iconX + (e.clientX - d.startX), y: d.iconY + (e.clientY - d.startY) });
    };
    const onUp = () => { dragRef.current = null; setDragIcon(null); };
    window.addEventListener("contextmenu", onCtx);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dispatch, state.startOpen]);

  const wallpaperStyle: CSSProperties = {
    background: state.wallpaper,
  };

  const startDragIcon = (e: React.MouseEvent, icon: { id: string; x: number; y: number }) => {
    if (e.button !== 0) return;
    dragRef.current = { id: icon.id, startX: e.clientX, startY: e.clientY, iconX: icon.x, iconY: icon.y };
    setDragIcon({ id: icon.id, offsetX: 0, offsetY: 0 });
    e.preventDefault();
    e.stopPropagation();
  };

  const onIconContextMenu = (e: React.MouseEvent, icon: { id: string; appId: string; label: string }) => {
    e.preventDefault();
    e.stopPropagation();
    const app = APP_MAP[icon.appId];
    dispatch({
      type: "SET_CONTEXT_MENU",
      menu: {
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: "Open", icon: app?.icon ?? "fa-folder", action: () => dispatch({ type: "OPEN_APP", appId: icon.appId }) },
          { divider: true, label: "" },
          { label: "Remove from desktop", icon: "fa-trash", action: () => dispatch({ type: "REMOVE_DESKTOP_ICON", id: icon.id }) },
        ],
      },
    });
  };

  return (
    <div className="os-desktop" style={wallpaperStyle} data-theme={state.theme}>
      <div className="desktop-icons">
        {(sortBy === "name" ? [...state.desktopIcons].sort((a, b) => a.label.localeCompare(b.label)) : state.desktopIcons).map((d) => {
          const app = APP_MAP[d.appId]!;
          if (d.x < 0) return null;
          return (
            <div
              key={d.id}
              className="desktop-icon"
              style={{ left: d.x, top: d.y }}
              onMouseDown={(e) => startDragIcon(e, d)}
              onClick={() => {
                if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768) {
                  dispatch({ type: "OPEN_APP", appId: d.appId });
                }
              }}
              onDoubleClick={() => dispatch({ type: "OPEN_APP", appId: d.appId })}
              onContextMenu={(e) => onIconContextMenu(e, d)}
            >
              <div className="desktop-icon-img" style={{ fontSize: iconSize === "large" ? 56 : 40 }}><i className={`fa ${app.icon}`} /></div>
              <div className="desktop-icon-label" style={{ fontSize: iconSize === "large" ? 14 : 12 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <WindowManager />
      {state.startOpen && <StartMenu />}
      {state.widgetsOpen && <WidgetsPanel />}
      {state.actionCenterOpen && <ActionCenter />}
      {state.contextMenu && <ContextMenu menu={state.contextMenu} />}
      <Notifications />
    </div>
  );
}

// placeholders imported below
import { StartMenu } from "./StartMenu";
import { WidgetsPanel } from "./WidgetsPanel";
import { ActionCenter } from "./ActionCenter";
import { ContextMenu } from "./ContextMenu";
import { Notifications } from "./Notifications";