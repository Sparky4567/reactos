import { useRef, useState } from "react";
import { useOS } from "@/os/store";

export function Notepad() {
  const { dispatch } = useOS();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("Untitled");
  const [wrap, setWrap] = useState(true);
  const [statusBar, setStatusBar] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const saveToOS = () => {
    const name = fileName.endsWith(".txt") ? fileName : `${fileName}.txt`;
    dispatch({ type: "FS_CREATE_FILE", path: ["Desktop"], name, content: text });
    // also try write if exists
    dispatch({ type: "FS_WRITE_FILE", path: ["Desktop", name], content: text });
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };



  return (
    <div className="app-notepad">
      <div className="notepad-menu">
        <button onClick={saveToOS}>File</button>
        <button onClick={() => { taRef.current?.select(); }}>Edit</button>
        <button onClick={() => setWrap((w) => !w)}>Format</button>
        <button onClick={() => setStatusBar((s) => !s)}>View</button>
        <button onClick={() => dispatch({ type: "PUSH_NOTIFICATION", n: { id: "n-" + Date.now(), title: "Notepad", body: "ReactOS Notepad clone", time: Date.now() } })}>Help</button>
        <div className="notepad-menu-spacer" />
        <button onClick={saveToOS} title="Save to OS"><i className="fa fa-floppy-o" /> Save</button>
        <button onClick={download} title="Download"><i className="fa fa-download" /> Download</button>
      </div>
      <div className="notepad-titlebar-mini">
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="notepad-filename" />
        <span className="notepad-ext">.txt</span>
      </div>
      <textarea
        ref={taRef}
        className="notepad-textarea"
        style={{ whiteSpace: wrap ? "pre-wrap" : "pre", overflowX: wrap ? "hidden" : "auto" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="Start typing..."
      />
      {statusBar && (
        <div className="notepad-status">
          <span>Ln {text.split("\n").length}, Col {text.length}</span>
          <span>UTF-8</span>
          <span>Windows (CRLF)</span>
        </div>
      )}
    </div>
  );
}
