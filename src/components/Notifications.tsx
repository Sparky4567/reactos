import { useOS } from "@/os/store";

export function Notifications() {
  const { state, dispatch } = useOS();
  const recent = state.notifications.slice(0, 3);
  return (
    <div className="toast-container">
      {recent.map((n) => (
        <div key={n.id} className="toast">
          <div className="toast-icon"><i className={`fa ${n.icon ?? "fa-bell"}`} /></div>
          <div className="toast-body">
            <div className="toast-title">{n.title}</div>
            <div className="toast-text">{n.body}</div>
          </div>
          <button onClick={() => dispatch({ type: "DISMISS_NOTIFICATION", id: n.id })}>
            <i className="fa fa-times" />
          </button>
        </div>
      ))}
    </div>
  );
}
