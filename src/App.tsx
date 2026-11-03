import { AppearanceProvider, useAppearance } from "@/appearance/context";
import { useEffect } from "react";
import { OSProvider, useOS } from "@/os/store";
import { BootScreen } from "./components/BootScreen";
import { LockScreen } from "./components/LockScreen";
import { Desktop } from "./components/Desktop";
import { Taskbar } from "./components/Taskbar";
import "bootstrap/dist/css/bootstrap.min.css";
import "font-awesome/css/font-awesome.min.css";
import "./index.css";
import "./os.css";
import "./appearance/styles.css";

function Shell() {
  const { state } = useOS();
  const appearance = useAppearance();
  useEffect(() => {
    const apply = (value: unknown) => {
      const scale = typeof value === "number" && Number.isFinite(value) ? Math.min(2, Math.max(0.8, value)) : 1;
      document.documentElement.style.fontSize = `${16 * scale}px`;
    };
    try { apply(JSON.parse(localStorage.getItem("reactos.ollama.settings") || "{}").fontScale); } catch { apply(1); }
    const change = (event: Event) => apply((event as CustomEvent<number>).detail);
    const storage = (event: StorageEvent) => { if (event.key === "reactos.ollama.settings") { try { apply(JSON.parse(event.newValue || "{}").fontScale); } catch { apply(1); } } };
    window.addEventListener("reactos-font-scale", change);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("reactos-font-scale", change); window.removeEventListener("storage", storage); };
  }, []);
  if (!appearance.ready) return <div className="appearance-loading"><div className="appearance-loading-mark" /><p>{appearance.error || "Loading your desktop…"}</p>{appearance.error && <button onClick={appearance.reload}>Retry</button>}</div>;
  if (!state.booted) return <BootScreen />;
  if (state.locked) return <LockScreen />;
  return (
    <>
      <Desktop />
      <Taskbar />
      {appearance.error && <div className="appearance-error" role="alert">{appearance.error} <button onClick={appearance.retry}>Retry save</button><button onClick={() => { if (confirm("Reload saved appearance and discard unsaved appearance changes?")) appearance.reload(); }}>Reload preferences</button></div>}
    </>
  );
}

export function App() {
  return (
    <AppearanceProvider>
      <OSProvider>
        <Shell />
      </OSProvider>
    </AppearanceProvider>
  );
}

export default App;
