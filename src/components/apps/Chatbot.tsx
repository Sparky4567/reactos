import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";

const SETTINGS_KEY = "reactos.ollama.settings";

interface Settings {
  host: string;
  model: string;
  fontScale: number;
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { host: parsed.host || "127.0.0.1", model: parsed.model || "", fontScale: typeof parsed.fontScale === "number" ? parsed.fontScale : 1 };
    }
  } catch {}
  return { host: "127.0.0.1", model: "", fontScale: 1 };
}

export function Chatbot({ windowId }: { windowId?: string }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [hostDraft, setHostDraft] = useState(settings.host);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    setHostDraft(settings.host);
  }, [settings.host]);

  const fetchModels = async (host: string) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch(`/api/ollama/models?host=${encodeURIComponent(host)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const list: string[] = Array.isArray(data.models) ? data.models : [];
      setModels(list);
      setSettings((s) => {
        if (s.model && list.includes(s.model)) return s;
        return { ...s, model: list[0] ?? s.model };
      });
    } catch (e) {
      setModelsError((e as Error).message);
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    fetchModels(settings.host);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.host]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const saveHost = () => {
    const host = hostDraft.trim() || "127.0.0.1";
    setSettings((s) => ({ ...s, host }));
    setSettingsOpen(false);
  };

  const newChat = () => {
    setMessages([]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !settings.model) return;

    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const assistantMsg: Msg = { id: uid(), role: "assistant", content: "" };
    const apiMessages = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }];
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    let acc = "";
    try {
      const res = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: settings.host,
          model: settings.model,
          messages: apiMessages,
        }),
      });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j.error) errMsg = j.error;
        } catch {}
        throw new Error(errMsg);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace(/^data:\s*/, "");
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.type === "token") {
              acc += evt.text ?? "";
              setMessages((m) =>
                m.map((msg) => (msg.id === assistantMsg.id ? { ...msg, content: acc } : msg))
              );
            } else if (evt.type === "done") {
              // no-op
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Generation failed");
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }
      if (!acc) acc = "(empty response)";
      setMessages((m) => m.map((msg) => (msg.id === assistantMsg.id ? { ...msg, content: acc } : msg)));
    } catch (e) {
      const msg = `**Error:** ${(e as Error).message}`;
      acc = acc ? acc + "\n\n" + msg : msg;
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantMsg.id ? { ...msg, content: acc } : msg))
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="app-chatbot" style={{ fontSize: `${13 * (settings.fontScale || 1)}px` }}>
      <div className="chatbot-toolbar">
        <div className="chatbot-title">
          <i className="fa fa-comments" /> Ollama Chat
        </div>
        <div className="chatbot-controls">
          <select
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            disabled={modelsLoading || models.length === 0}
            title="Choose model"
          >
            {models.length === 0 && <option value="">{modelsLoading ? "Loading…" : "No models"}</option>}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button onClick={() => fetchModels(settings.host)} title="Refresh model list" disabled={modelsLoading}>
            <i className={`fa fa-refresh ${modelsLoading ? "fa-spin" : ""}`} />
          </button>
          <button onClick={() => setSettingsOpen((v) => !v)} title="Settings">
            <i className="fa fa-cog" />
          </button>
          <button onClick={newChat} title="New chat">
            <i className="fa fa-plus" />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="chatbot-settings">
          <label>Ollama host</label>
          <div className="chatbot-settings-row">
            <input
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              placeholder="127.0.0.1"
            />
            <button onClick={saveHost}>Save</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Font size</label>
            <input
              type="range"
              min="0.8"
              max="2"
              step="0.1"
              value={settings.fontScale || 1}
              onChange={(e) => setSettings((s) => ({ ...s, fontScale: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
            <span className="chatbot-hint" style={{ display: "block", marginTop: 2 }}>
              {Math.round((settings.fontScale || 1) * 100)}%
            </span>
          </div>
          <p className="chatbot-hint">
            Ollama must be running and reachable on port 11434. Host is used server-side.
          </p>
          {modelsError && <p className="chatbot-error">{modelsError}</p>}
        </div>
      )}

      {modelsError && !settingsOpen && (
        <div className="chatbot-banner chatbot-error">
          {modelsError} — open settings to check host.
        </div>
      )}

      <div className="chatbot-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chatbot-empty">
            <i className="fa fa-comments-o" />
            <p>Select a model and start chatting.</p>
            <p className="chatbot-hint">Responses support Markdown.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chatbot-msg chatbot-msg-${msg.role}`}>
            <div className="chatbot-avatar">
              <i className={`fa ${msg.role === "user" ? "fa-user" : "fa-android"}`} />
            </div>
            <div className="chatbot-bubble">
              {msg.role === "assistant" ? (
                msg.content ? (
                  <Markdown>{msg.content}</Markdown>
                ) : (
                  <span className="chatbot-typing">Thinking…</span>
                )
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="chatbot-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={settings.model ? "Type a message… (Enter to send, Shift+Enter for newline)" : "Select a model first"}
          disabled={sending || !settings.model}
          rows={2}
        />
        <button onClick={send} disabled={sending || !input.trim() || !settings.model} title="Send">
          <i className={`fa ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`} />
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
