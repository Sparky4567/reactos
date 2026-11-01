import { useState } from "react";
import { useOS } from "@/os/store";
import { APPS } from "@/os/apps";

export function StartMenu() {
  const { state, dispatch } = useOS();
  const [pinned] = useState(APPS.map((a) => a.id));
  const [showAll, setShowAll] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const filtered = state.search
    ? APPS.filter((a) => a.name.toLowerCase().includes(state.search.toLowerCase()))
    : APPS;

  const user = "User";

  return (
    <div className="start-menu" onClick={(e) => e.stopPropagation()}>
      <div className="start-search">
        <i className="fa fa-search" />
        <input
          placeholder="Search for apps, settings, and documents"
          value={state.search}
          onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
          autoFocus
        />
      </div>
      <div className="start-body">
        {state.search ? (
          <div className="start-section">
            <div className="start-section-title">Best match</div>
            <div className="start-apps-grid">
              {filtered.map((a) => (
                <div key={a.id} className="start-app" onClick={() => dispatch({ type: "OPEN_APP", appId: a.id })}>
                  <div className="start-app-icon"><i className={`fa ${a.icon}`} /></div>
                  <div className="start-app-name">{a.name}</div>
                </div>
              ))}
              {filtered.length === 0 && <div className="start-empty">No results</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="start-section">
              <div className="start-section-header">
                <span>Pinned</span>
                <button onClick={() => setShowAll((v) => !v)}>{showAll ? "Pinned" : "All apps"} <i className={`fa ${showAll ? "fa-chevron-down" : "fa-chevron-right"}`} /></button>
              </div>
              <div className="start-pinned-grid">
                {pinned.map((id) => {
                  const a = APPS.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="start-tile" onClick={() => dispatch({ type: "OPEN_APP", appId: id })}>
                      <div className="start-tile-icon"><i className={`fa ${a.icon}`} /></div>
                      <div className="start-tile-name">{a.name}</div>
                    </div>
                  );
                })}
              </div>
              {showAll && (
                <div className="start-apps-grid" style={{ marginTop: 8 }}>
                  {APPS.map((a) => (
                    <div key={`all-${a.id}`} className="start-app" onClick={() => dispatch({ type: "OPEN_APP", appId: a.id })}>
                      <div className="start-app-icon"><i className={`fa ${a.icon}`} /></div>
                      <div className="start-app-name">{a.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="start-section">
              <div className="start-section-header">
                <span>Recommended</span>
                <button onClick={() => setShowMore((v) => !v)}>{showMore ? "Less" : "More"} <i className={`fa ${showMore ? "fa-chevron-down" : "fa-chevron-right"}`} /></button>
              </div>
              <div className="start-recommended">
                <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "notepad" })}><i className="fa fa-file-text-o" /> Recently opened - Notepad</div>
                <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "explorer" })}><i className="fa fa-folder" /> Quick access - Documents</div>
                <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "browser" })}><i className="fa fa-globe" /> Browsing history - Edge</div>
                {showMore && (
                  <>
                    <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "calculator" })}><i className="fa fa-calculator" /> Calculator</div>
                    <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "settings" })}><i className="fa fa-cog" /> Settings</div>
                    <div className="start-rec-item" onClick={() => dispatch({ type: "OPEN_APP", appId: "terminal" })}><i className="fa fa-terminal" /> Terminal</div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="start-footer">
        <div className="start-user">
          <div className="start-user-avatar"><i className="fa fa-user" /></div>
          <span>{user}</span>
        </div>
        <div className="start-power">
          <button title="Power" onClick={() => dispatch({ type: "LOCK" })}><i className="fa fa-power-off" /></button>
        </div>
      </div>
    </div>
  );
}
