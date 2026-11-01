import { useOS } from "@/os/store";

export function ContextMenu({ menu }: { menu: { x: number; y: number; items: any[] } }) {
  const { dispatch } = useOS();
  return (
    <div
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
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
