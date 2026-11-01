import { useState } from "react";
import { useOS } from "@/os/store";

export function ActionCenter() {
  const { state, dispatch } = useOS();
  const [toggles, setToggles] = useState([
    { icon: "fa-wifi", label: "Wi-Fi", on: true },
    { icon: "fa-bluetooth-b", label: "Bluetooth", on: false },
    { icon: "fa-plane", label: "Airplane mode", on: false },
    { icon: "fa-battery-three-quarters", label: "Battery saver", on: false },
    { icon: "fa-sun-o", label: "Night light", on: false },
    { icon: "fa-volume-up", label: "Volume", on: true },
  ]);
  const [brightness, setBrightness] = useState(70);
  const [volume, setVolume] = useState(50);

  const toggle = (label: string) => {
    setToggles((ts) => ts.map((t) => t.label === label ? { ...t, on: !t.on } : t));
    if (label === "Night light") {
      // toggle a warm filter on desktop
      const root = document.querySelector(".os-desktop") as HTMLElement | null;
      if (root) root.style.filter = toggles.find((t) => t.label === "Night light")?.on ? "" : "sepia(0.25) saturate(1.2)";
    }
  };

  return (
    <div className="action-center" onClick={(e) => e.stopPropagation()}>
      <div className="ac-header">
        <span>Notifications</span>
        <button onClick={() => dispatch({ type: "SET_ACTION_CENTER", open: false })}><i className="fa fa-times" /></button>
      </div>
      <div className="ac-notifs">
        {state.notifications.length === 0 && <div className="ac-empty">No new notifications</div>}
        {state.notifications.map((n) => (
          <div key={n.id} className="ac-notif">
            <div className="ac-notif-icon"><i className={`fa ${n.icon ?? "fa-bell"}`} /></div>
            <div className="ac-notif-body">
              <div className="ac-notif-title">{n.title}</div>
              <div className="ac-notif-text">{n.body}</div>
            </div>
            <button className="ac-notif-close" onClick={() => dispatch({ type: "DISMISS_NOTIFICATION", id: n.id })}>
              <i className="fa fa-times" />
            </button>
          </div>
        ))}
      </div>
      <div className="ac-toggles">
        {toggles.map((t) => (
          <div key={t.label} className={`ac-toggle ${t.on ? "on" : ""}`} onClick={() => toggle(t.label)}>
            <i className={`fa ${t.icon}`} />
            <span>{t.label}</span>
          </div>
        ))}
      </div>
      <div className="ac-slider">
        <i className="fa fa-sun-o" />
        <input type="range" min={0} max={100} value={brightness} onChange={(e) => {
          setBrightness(Number(e.target.value));
          const root = document.querySelector(".os-desktop") as HTMLElement | null;
          if (root) root.style.filter = `brightness(${0.5 + Number(e.target.value) / 200})`;
        }} />
      </div>
      <div className="ac-slider">
        <i className="fa fa-volume-up" />
        <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
      </div>
    </div>
  );
}