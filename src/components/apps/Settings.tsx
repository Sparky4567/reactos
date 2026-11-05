import { AppearanceChooser } from "./AppearanceChooser";
import { WALLPAPERS } from "@/appearance/preferences";
import { useState } from "react";
import { useOS } from "@/os/store";

const WALLS = [
  { name: "Fuchsia", value: WALLPAPERS.fuchsia },
  { name: "Classic teal", value: WALLPAPERS.winretro },
  { name: "Botanical", value: WALLPAPERS.android },
  { name: "Aubergine", value: WALLPAPERS.ubuntu },
  { name: "Morning", value: WALLPAPERS.chromeos },
  { name: "Bloom", value: "linear-gradient(135deg, #2b5876 0%, #4e4376 50%, #1a1a2e 100%)" },
  { name: "Sunset", value: "linear-gradient(135deg, #ff512f 0%, #dd2476 100%)" },
  { name: "Ocean", value: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)" },
  { name: "Forest", value: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)" },
  { name: "Aurora", value: "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)" },
];

export function Settings() {
  const { state, dispatch } = useOS();
  const [section, setSection] = useState("system");
  const [query, setQuery] = useState("");
  const [wifiOn, setWifiOn] = useState(true);
  const [ethOn, setEthOn] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const sections = [
    { id: "system", label: "System", icon: "fa-desktop" },
    { id: "personalization", label: "Personalization", icon: "fa-paint-brush" },
    { id: "apps", label: "Apps", icon: "fa-th-large" },
    { id: "accounts", label: "Accounts", icon: "fa-user" },
    { id: "network", label: "Network", icon: "fa-wifi" },
    { id: "update", label: "Software Updates", icon: "fa-refresh" },
    { id: "about", label: "About", icon: "fa-info-circle" },
  ];

  return (
    <div className="app-settings">
      <aside className="settings-sidebar">
        <div className="settings-search"><i className="fa fa-search" /> <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a setting" style={{ border: "none", background: "transparent", outline: "none", flex: 1, color: "inherit", fontSize: "0.75rem" }} /></div>
        <div className="settings-nav-list">
          {sections.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())).map((s) => (
            <div
              key={s.id}
              className={`settings-nav-item ${section === s.id ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <i className={`fa ${s.icon}`} /> {s.label}
            </div>
          ))}
        </div>
      </aside>
      <main className="settings-main">
        {section === "system" && (
          <div>
            <h2>System</h2>
            <AppearanceChooser />
            <div className="settings-card">
              <h3>Display</h3>
              <label>Theme</label>
              <div className="seg">
                <button className={state.theme === "light" ? "active" : ""} onClick={() => dispatch({ type: "SET_THEME", theme: "light" })}>Light</button>
                <button className={state.theme === "dark" ? "active" : ""} onClick={() => dispatch({ type: "SET_THEME", theme: "dark" })}>Dark</button>
              </div>
            </div>
            <div className="settings-card">
              <h3>Notifications</h3>
              <p>Manage how and when you receive notifications.</p>
            </div>
          </div>
        )}
        {section === "personalization" && (
          <div>
            <h2>Personalization</h2>
            <AppearanceChooser />
            <div className="settings-card">
              <h3>Background</h3>
              <div className="wall-grid">
                {WALLS.map((w) => (
                  <div
                    key={w.name}
                    className={`wall-tile ${state.wallpaper === w.value ? "active" : ""}`}
                    style={{ background: w.value }}
                    onClick={() => dispatch({ type: "SET_WALLPAPER", wallpaper: w.value })}
                  >
                    <span>{w.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-card">
              <h3>Colors</h3>
              <p>Accent color: {state.desktopStyle === "fuchsia" ? "Fuchsia pink" : state.desktopStyle === "android" ? "Botanical green" : state.desktopStyle === "winretro" ? "Classic navy" : state.desktopStyle === "ubuntu" ? "Ubuntu orange" : state.desktopStyle === "chromeos" ? "Sky blue" : "Windows blue"}</p>
            </div>
          </div>
        )}
        {section === "accounts" && (
          <div>
            <h2>Accounts</h2>
            <div className="settings-card">
              <h3>Change password</h3>
              <label>Current password</label>
              <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 8, borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
              <label>New password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 8, borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
              <label>Confirm new password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={{ width: "100%", padding: 6, marginBottom: 8, borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
              <button
                style={{ padding: "6px 16px", background: "var(--accent, #0067c0)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                onClick={() => {
                  if (state.password && curPw !== state.password) { setPwMsg("Current password is incorrect"); return; }
                  if (newPw !== confirmPw) { setPwMsg("New passwords do not match"); return; }
                  dispatch({ type: "SET_PASSWORD", password: newPw });
                  setCurPw(""); setNewPw(""); setConfirmPw("");
                  setPwMsg(newPw ? "Password updated" : "Password removed");
                }}
              >Save</button>
              {pwMsg && <p style={{ marginTop: 8, color: pwMsg.includes("incorrect") || pwMsg.includes("match") ? "#d13438" : "#107c10" }}>{pwMsg}</p>}
              <p style={{ marginTop: 8, opacity: 0.7, fontSize: "0.75rem" }}>{state.password ? "A password is set." : "No password set (any password unlocks)."}</p>
            </div>
          </div>
        )}
        {section === "network" && (
          <div>
            <h2>Network & Internet</h2>
            <div className="settings-card">
              <div className="net-row" onClick={() => setWifiOn((v) => !v)} style={{ cursor: "pointer" }}><i className="fa fa-wifi" /> Wi-Fi <span className="net-status">{wifiOn ? "Connected" : "Disconnected"}</span></div>
              <div className="net-row" onClick={() => setEthOn((v) => !v)} style={{ cursor: "pointer" }}><i className="fa fa-globe" /> Ethernet <span className="net-status">{ethOn ? "Connected" : "Not connected"}</span></div>
            </div>
          </div>
        )}
        {section === "about" && (
          <div>
            <h2>About</h2>
            <div className="settings-card">
              <p><strong>Project</strong> ReactOS Browser Clone</p>
              <p><strong>Description</strong> A browser desktop with Ubuntu, Windows 11, and ChromeOS appearances.</p>
              <p><strong>Version</strong> 0.1.0</p>
              <p><strong>Stack</strong> React 19, TypeScript, Bun</p>
              <p><strong>Runtime</strong> Browser (WebAssembly-free, pure JS/TS)</p>
              <p><strong>Repository</strong> bun-react-template / reactos</p>
              <p><strong>License</strong> Private</p>
              <p style={{ marginTop: 8, opacity: 0.7, fontSize: "0.75rem" }}>This is a clone/demo project and is not affiliated with Microsoft or ReactOS.</p>
            </div>
          </div>
        )}
        {["apps", "update"].includes(section) && (
          <div>
            <h2>{sections.find((s) => s.id === section)?.label}</h2>
            <div className="settings-card"><p>Settings for this section are not configured in this demo.</p></div>
          </div>
        )}
      </main>
    </div>
  );
}

