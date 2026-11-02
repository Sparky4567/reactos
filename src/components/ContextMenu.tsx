import { useOS } from "@/os/store";

export function ContextMenu({ menu }: { menu: { x: number; y: number; items: any[] } }) {
  const { dispatch } = useOS();
  const maxW = typeof window !== "undefined" ? window.innerWidth : 400;
  const maxH = typeof window !== "undefined" ? window.innerHeight - 48 : 600;
  const posX = Math.max(8, Math.min(menu.x, maxW - 220));
  const posY = Math.max(8, Math.min(menu.y, maxH - 220));
  return (
    <div
      className="context-menu"
      style={{ left: posX, top: posY }}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.items.map((it, i) => {
        if (it.divider) return <div key={i} className="context-divider" />;
        return (
          <div
            key={i}
            className={`context-item ${it.disabled ? "disabled" : ""}`}
            onClick={() => {
              it.action?.();
              dispatch({ type: "SET_CONTEXT_MENU", menu: null });
            }}
          >
            {it.icon && <i className={`fa ${it.icon}`} />}
            <span>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}
