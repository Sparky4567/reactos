import { useEffect, useState } from "react";
import { useOS } from "@/os/store";

export function LockScreen() {
  const { state, dispatch } = useOS();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const unlock = () => {
    if (state.password && password !== state.password) {
      setError("Incorrect password");
      return;
    }
    setError("");
    dispatch({ type: "UNLOCK" });
    // push a welcome notification
    dispatch({
      type: "PUSH_NOTIFICATION",
      n: { id: `n-${Date.now()}`, title: "Welcome", body: "Welcome to ReactOS Browser Clone.", icon: "fa-windows", time: Date.now() },
    });
  };

  return (
    <div className="lock-screen" onClick={() => setShow(true)}>
      <div className="lock-time">
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>
      <div className="lock-date">
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </div>
      {show && (
        <div className="lock-panel" onClick={(e) => e.stopPropagation()}>
          <div className="lock-avatar"><i className="fa fa-user" /></div>
          <div className="lock-username">User</div>
          <div className="lock-input-row">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              autoFocus
            />
            <button onClick={unlock}><i className="fa fa-arrow-right" /></button>
          </div>
          {error && <div className="lock-hint" style={{ color: "#ff6b6b" }}>{error}</div>}
          <div className="lock-hint">{state.password ? "Enter your password" : "Press Enter or click arrow (any password works)"}</div>
        </div>
      )}
      {!show && <div className="lock-hint-bottom">Click anywhere to unlock</div>}
    </div>
  );
}