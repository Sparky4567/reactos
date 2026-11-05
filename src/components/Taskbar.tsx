import { useEffect, useState } from "react";
import { useOS } from "@/os/store";
import { DesktopMark } from "./DesktopMark";
import { APPS, presentApp } from "@/os/apps";

export function Taskbar() {
  const { state, dispatch } = useOS();
  const [time, setTime] = useState(new Date());
  const [trayOpen, setTrayOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const apps = APPS.map(app => presentApp(app, state.desktopStyle));
  const ubuntu = state.desktopStyle === "ubuntu";
  const activeApp = apps.find(app => state.windows.some(w => w.id === state.activeId && w.appId === app.id));
  const runningApps = Array.from(new Set(state.windows.map((w) => w.appId)));
  const pinned = ["explorer", "browser", "terminal", "gallery", "chatbot", "settings"];

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });

  return (
    <>
    {ubuntu && <header className="ubuntu-panel" onClick={e => e.stopPropagation()}>
      <div className="ubuntu-panel-left"><button className={state.startOpen ? "active" : ""} aria-expanded={state.startOpen} onClick={() => dispatch({ type: "SET_START", open: !state.startOpen })}>Activities <span className="workspace-dots">••</span></button><span className="ubuntu-active-app">{activeApp?.name || "Desktop"}</span></div>
      <button className="ubuntu-panel-clock" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: !state.actionCenterOpen })}><span className="ubuntu-panel-date">{time.toLocaleDateString([], { month: "short", day: "numeric" })}</span> <span>{formatTime(time)}</span></button>
      <div className="ubuntu-panel-status"><button aria-label="Open widgets" title="Widgets" onClick={() => dispatch({ type: "SET_WIDGETS", open: !state.widgetsOpen })}><i className="fa fa-th-large" /></button><button aria-label="System menu and notifications" aria-expanded={state.actionCenterOpen} onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: !state.actionCenterOpen })}><i className="fa fa-wifi" /><i className="fa fa-volume-up" /><i className="fa fa-battery-three-quarters" /><i className="fa fa-angle-down" />{state.notifications.length > 0 && <span className="ubuntu-notification-dot" />}</button></div>
    </header>}
    <nav className="taskbar" aria-label={ubuntu ? "Application dock" : state.desktopStyle === "chromeos" ? "Application shelf" : "Taskbar"} onClick={(e) => e.stopPropagation()}>
      <div className="taskbar-left">
        <button
          className={`taskbar-btn start-btn ${state.startOpen ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_START", open: !state.startOpen })}
          title={ubuntu ? "Show applications" : ["chromeos", "android", "fuchsia"].includes(state.desktopStyle) ? "Launcher" : "Start"}
          aria-label={ubuntu ? "Show applications" : ["chromeos", "android", "fuchsia"].includes(state.desktopStyle) ? "Launcher" : "Start"}
          aria-expanded={state.startOpen}
        >
          <DesktopMark style={state.desktopStyle} />
          {state.desktopStyle === "winretro" && <span>Start</span>}
        </button>
        <div className="taskbar-search" onClick={() => dispatch({ type: "SET_START", open: true })}>
          <i className="fa fa-search" />
          <span>Search</span>
        </div>
        <button
          className={`taskbar-btn ${state.widgetsOpen ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_WIDGETS", open: !state.widgetsOpen })}
          title="Widgets"
        >
          <i className="fa fa-th-large" />
        </button>
      </div>

      <div className="taskbar-center">
        {pinned.map((id) => {
          const app = apps.find((a) => a.id === id)!;
          const running = runningApps.includes(id);
          const active = state.windows.some((w) => w.appId === id && state.activeId === w.id);
          return (
            <button
              key={id}
              className={`taskbar-app ${running ? "running" : ""} ${active ? "active" : ""}`}
              onClick={() => dispatch({ type: "OPEN_APP", appId: id })}
              onContextMenu={(e) => {
                e.preventDefault();
                dispatch({
                  type: "SET_CONTEXT_MENU",
                  menu: {
                    x: e.clientX,
                    y: e.clientY,
                    items: [
                      { label: `Open ${app.name}`, icon: app.icon, action: () => dispatch({ type: "OPEN_APP", appId: id }) },
                      ...(running ? [{ label: "Close window", icon: "fa-times", action: () => {
                        const w = state.windows.find((x) => x.appId === id);
                        if (w) dispatch({ type: "CLOSE_WINDOW", id: w.id });
                      } }] : []),
                    ],
                  },
                });
              }}
              title={app.name}
            >
              <i className={`fa ${app.icon}`} />
              {running && <span className="running-dot" />}
            </button>
          );
        })}
        {runningApps
          .filter((id) => !pinned.includes(id))
          .map((id) => {
            const app = apps.find((a) => a.id === id)!;
            return (
              <button
                key={`run-${id}`}
                className={`taskbar-app running ${state.windows.some(w => w.appId === id && w.id === state.activeId) ? "active" : ""}`}
                onClick={() => dispatch({ type: "OPEN_APP", appId: id })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  dispatch({
                    type: "SET_CONTEXT_MENU",
                    menu: {
                      x: e.clientX,
                      y: e.clientY,
                      items: [
                        { label: `Open ${app.name}`, icon: app.icon, action: () => dispatch({ type: "OPEN_APP", appId: id }) },
                        { label: "Close window", icon: "fa-times", action: () => {
                          const w = state.windows.find((x) => x.appId === id);
                          if (w) dispatch({ type: "CLOSE_WINDOW", id: w.id });
                        } },
                      ],
                    },
                  });
                }}
                title={app.name}
              >
                <i className={`fa ${app.icon}`} />
                <span className="running-dot" />
              </button>
            );
          })}
      </div>

      <div className="taskbar-right">
        <div className="taskbar-tray" style={{ position: "relative" }}>
          <button title="Show hidden icons" onClick={() => setTrayOpen((v) => !v)}><i className="fa fa-chevron-up" /></button>
          {trayOpen && (
            <div style={{ position: "absolute", bottom: 44, right: 0, background: "rgba(40,40,40,0.95)", borderRadius: 8, padding: 8, display: "flex", gap: 4, border: "1px solid rgba(255,255,255,0.1)" }}>
              <button title="Bluetooth" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}><i className="fa fa-bluetooth" /></button>
              <button title="USB" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}><i className="fa fa-usb" /></button>
              <button title="More" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}><i className="fa fa-ellipsis-h" /></button>
            </div>
          )}
          <button title="Network" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })}><i className="fa fa-wifi" /></button>
          <button title="Volume" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })}><i className="fa fa-volume-up" /></button>
          <button title="Battery" onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: true })}><i className="fa fa-battery-three-quarters" /></button>
        </div>
        <button
          className={`taskbar-notif-btn ${state.actionCenterOpen ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: !state.actionCenterOpen })}
          title="Notifications"
        >
          <i className="fa fa-comment-o" />
          {state.notifications.length > 0 && <span className="notif-badge" />}
        </button>
        <button
          className="taskbar-clock"
          onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: !state.actionCenterOpen })}
        >
          <div>{formatTime(time)}</div>
          <div>{formatDate(time)}</div>
        </button>
        <button className="taskbar-showdesktop" title="Show desktop" onClick={() => state.windows.forEach((w) => dispatch({ type: "MINIMIZE", id: w.id }))} />
      </div>
    </nav>
    </>
  );
}
