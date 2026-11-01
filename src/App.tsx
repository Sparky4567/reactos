import { OSProvider, useOS } from "@/os/store";
import { BootScreen } from "./components/BootScreen";
import { LockScreen } from "./components/LockScreen";
import { Desktop } from "./components/Desktop";
import { Taskbar } from "./components/Taskbar";
import "bootstrap/dist/css/bootstrap.min.css";
import "font-awesome/css/font-awesome.min.css";
import "./index.css";
import "./os.css";

function Shell() {
  const { state } = useOS();
  if (!state.booted) return <BootScreen />;
  if (state.locked) return <LockScreen />;
  return (
    <>
      <Desktop />
      <Taskbar />
    </>
  );
}

export function App() {
  return (
    <OSProvider>
      <Shell />
    </OSProvider>
  );
}

export default App;
