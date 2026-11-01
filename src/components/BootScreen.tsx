import { useEffect } from "react";
import { useOS } from "@/os/store";

export function BootScreen() {
  const { state, dispatch } = useOS();
  useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(t);
        setTimeout(() => dispatch({ type: "BOOT_DONE" }), 400);
      }
      dispatch({ type: "SET_BOOT_PROGRESS", value: Math.min(100, p) });
    }, 120);
    return () => clearInterval(t);
  }, [dispatch]);

  return (
    <div className="boot-screen">
      <div className="boot-logo">
        <i className="fa fa-windows" />
      </div>
      <div className="boot-spinner">
        <div className="boot-dot" style={{ transform: `rotate(${state.bootProgress * 3.6}deg)` }} />
      </div>
    </div>
  );
}
