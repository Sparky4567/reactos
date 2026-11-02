import { useState } from "react";
import { useOS } from "@/os/store";

export function WidgetsPanel() {
  const { dispatch } = useOS();
  const [todos, setTodos] = useState<{ id: number; text: string; done: boolean }[]>([
    { id: 1, text: "Finish Windows clone", done: false },
    { id: 2, text: "Add more apps", done: false },
    { id: 3, text: "Set up React", done: true },
  ]);
  const [todoInput, setTodoInput] = useState("");
  return (
    <div className="widgets-panel" onClick={(e) => e.stopPropagation()}>
      <div className="widgets-header">
        <h2>Widgets</h2>
        <button
          className="widgets-close-btn"
          onClick={() => dispatch({ type: "SET_WIDGETS", open: false })}
          title="Close"
        >
          <i className="fa fa-times" />
        </button>
      </div>
      <div className="widgets-grid">
        <div className="widget weather">
          <div className="widget-title">Weather</div>
          <div className="weather-main">
            <i className="fa fa-sun-o" />
            <div>
              <div className="weather-temp">72°F</div>
              <div className="weather-desc">Sunny · San Francisco</div>
            </div>
          </div>
          <div className="weather-forecast">
            <div><span>Mon</span><i className="fa fa-cloud" /><span>68°</span></div>
            <div><span>Tue</span><i className="fa fa-sun-o" /><span>74°</span></div>
            <div><span>Wed</span><i className="fa fa-umbrella" /><span>63°</span></div>
            <div><span>Thu</span><i className="fa fa-cloud" /><span>66°</span></div>
          </div>
        </div>
        <div className="widget news">
          <div className="widget-title">Top stories</div>
          <div className="news-item">
            <div className="news-thumb" />
            <div>
              <div className="news-headline">React 19 introduces new hooks</div>
              <div className="news-meta">Tech · 2h ago</div>
            </div>
          </div>
          <div className="news-item">
            <div className="news-thumb" />
            <div>
              <div className="news-headline">Bun 1.4 released with faster bundler</div>
              <div className="news-meta">Dev · 5h ago</div>
            </div>
          </div>
          <div className="news-item">
            <div className="news-thumb" />
            <div>
              <div className="news-headline">Windows 11 24H2 rollout continues</div>
              <div className="news-meta">OS · 1d ago</div>
            </div>
          </div>
        </div>
        <div className="widget todo">
          <div className="widget-title">To Do</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <input value={todoInput} onChange={(e) => setTodoInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && todoInput.trim()) { setTodos((t) => [...t, { id: Date.now(), text: todoInput.trim(), done: false }]); setTodoInput(""); } }} placeholder="Add task" style={{ flex: 1, fontSize: 12, padding: 4, borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)" }} />
          </div>
          {todos.map((t) => (
            <div key={t.id} className="todo-item">
              <input type="checkbox" checked={t.done} onChange={() => setTodos((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))} />
              <span style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1 }}>{t.text}</span>
              <button onClick={() => setTodos((ts) => ts.filter((x) => x.id !== t.id))} style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", fontSize: 10, opacity: 0.5 }}>×</button>
            </div>
          ))}
        </div>
        <div className="widget watchlist">
          <div className="widget-title">Watchlist</div>
          <div className="watch-row"><span>AAPL</span><span className="up">+1.2%</span></div>
          <div className="watch-row"><span>MSFT</span><span className="up">+0.8%</span></div>
          <div className="watch-row"><span>TSLA</span><span className="down">-0.4%</span></div>
        </div>
      </div>
    </div>
  );
}
