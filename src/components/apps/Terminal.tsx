import { useState, useRef } from "react";
import { useOS } from "@/os/store";
import { findNode, resolvePath, pathStr } from "@/os/fs";

type RunResult = { out: string; code: number; clear?: boolean };

export function Terminal() {
  const { state, dispatch } = useOS();
  const [lines, setLines] = useState<string[]>([
    "ReactOS Terminal [Version 11.0.22631]",
    "(c) Microsoft Corporation. All rights reserved.",
    "",
    "Type 'help' for available commands.",
    "",
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string[]>([]);
  const cwdRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 0);

  const runAtomic = (raw: string): RunResult => {
    let cmd = raw.trim();
    if (cmd === "") return { out: "", code: 0 };

    // redirection
    let redirect: { mode: "w" | "a"; file: string } | null = null;
    const rm = cmd.match(/^(.*?)(>>|>)\s*(.+)$/);
    if (rm) {
      cmd = rm[1]!.trim();
      redirect = { mode: rm[2] === ">>" ? "a" : "w", file: rm[3]!.trim() };
    }

    const parts = cmd.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    const args = parts.slice(1);

    const fail = (msg: string): RunResult => ({ out: msg, code: 1 });

    // batch file execution
    const tryRunFile = (): RunResult | null => {
      const resolved = resolvePath(cwdRef.current, parts[0] ?? "");
      const node = findNode(state.fs, resolved);
      if (node && node.type === "file") {
        const content = node.content ?? "";
        const out = runBatch(content, false);
        return { out, code: 0 };
      }
      return null;
    };

    const runBatch = (text: string, printPrompts: boolean) => {
      const outLines: string[] = [];
      const inputLines = text.split(/\r?\n/);
      for (const line of inputLines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("::") || trimmed.startsWith("rem ")) continue;
        if (trimmed.includes("&&")) {
          let code = 0;
          for (const seg of trimmed.split("&&")) {
            if (code !== 0) break;
            const r = runAtomic(seg.trim());
            code = r.code;
            if (r.clear) { setLines([]); }
            else if (r.out) outLines.push(r.out);
          }
        } else if (trimmed.includes(";")) {
          for (const seg of trimmed.split(";")) {
            const r = runAtomic(seg.trim());
            if (r.clear) { setLines([]); }
            else if (r.out) outLines.push(r.out);
          }
        } else {
          const r = runAtomic(trimmed);
          if (r.clear) { setLines([]); }
          else if (r.out) outLines.push(r.out);
        }
      }
      return outLines.join("\n");
    };

    // We need runBatch hoisted; redefine below via function declaration? Use const arrow above? It references runAtomic (defined). Fine, but runBatch defined inside runAtomic? We'll move runBatch outside? Keep simple: handle file by recursively calling a top-level batch runner.
    // Actually runBatch defined inside runAtomic is okay but recursion calls runAtomic. Fine.

    let result: RunResult;

    switch (name) {
      case "help":
        result = { out: "Available commands: help, clear, cls, echo, date, whoami, pwd, ls, cd, cat, mkdir, touch, rm, cp, mv, calc, neofetch, run <file>", code: 0 };
        break;
      case "clear":
      case "cls":
        result = { out: "__CLEAR__", code: 0, clear: true };
        break;
      case "echo":
        result = { out: args.join(" "), code: 0 };
        break;
      case "date":
        result = { out: new Date().toString(), code: 0 };
        break;
      case "whoami":
        result = { out: "user@reactos", code: 0 };
        break;
      case "pwd":
        result = { out: pathStr(cwdRef.current), code: 0 };
        break;
      case "ls":
      case "dir": {
        const target = args.length ? resolvePath(cwdRef.current, args.join(" ")) : cwdRef.current;
        const n = findNode(state.fs, target);
        if (!n || n.type !== "folder") { result = fail(`ls: cannot access '${args.join(" ") || "."}': No such directory`); break; }
        const list = (n.children ?? []).map((c) => (c.type === "folder" ? c.name + "/" : c.name)).join("  ");
        result = { out: list || "(empty)", code: 0 };
        break;
      }
      case "cd": {
        if (args.length === 0) { cwdRef.current = []; setCwd([]); result = { out: "", code: 0 }; break; }
        const target = resolvePath(cwdRef.current, args.join(" "));
        const n = findNode(state.fs, target);
        if (!n || n.type !== "folder") { result = fail(`cd: no such directory: ${args.join(" ")}`); break; }
        cwdRef.current = target; setCwd(target);
        result = { out: "", code: 0 };
        break;
      }
      case "cat":
      case "type": {
        if (!args.length) { result = fail("cat: missing file"); break; }
        const target = resolvePath(cwdRef.current, args.join(" "));
        const n = findNode(state.fs, target);
        if (!n || n.type !== "file") { result = fail(`cat: ${args.join(" ")}: No such file`); break; }
        result = { out: n.content ?? "", code: 0 };
        break;
      }
      case "mkdir": {
        if (!args.length) { result = fail("mkdir: missing operand"); break; }
        const resolved = resolvePath(cwdRef.current, args[0]!);
        const name = resolved[resolved.length - 1]!;
        const parent = resolved.slice(0, -1);
        dispatch({ type: "FS_CREATE_FOLDER", path: parent, name });
        result = { out: "", code: 0 };
        break;
      }
      case "touch": {
        if (!args.length) { result = fail("touch: missing file"); break; }
        const resolved = resolvePath(cwdRef.current, args[0]!);
        const name = resolved[resolved.length - 1]!;
        const parent = resolved.slice(0, -1);
        dispatch({ type: "FS_CREATE_FILE", path: parent, name, content: "" });
        result = { out: "", code: 0 };
        break;
      }
      case "rm":
      case "del": {
        if (!args.length) { result = fail("rm: missing operand"); break; }
        const resolved = resolvePath(cwdRef.current, args.join(" "));
        dispatch({ type: "FS_DELETE", path: resolved });
        result = { out: "", code: 0 };
        break;
      }
      case "cp":
      case "copy": {
        if (args.length < 2) { result = fail("cp: missing operand"); break; }
        const src = resolvePath(cwdRef.current, args[0]!);
        const srcNode = findNode(state.fs, src);
        if (!srcNode || srcNode.type !== "file") { result = fail(`cp: cannot stat '${args[0]}'`); break; }
        let dest = resolvePath(cwdRef.current, args[1]!);
        const destNode = findNode(state.fs, dest);
        if (destNode && destNode.type === "folder") {
          const base = src[src.length - 1]!;
          dest = [...dest, base];
        }
        const parent = dest.slice(0, -1);
        const name = dest[dest.length - 1]!;
        dispatch({ type: "FS_CREATE_FILE", path: parent, name, content: srcNode.content ?? "" });
        result = { out: "", code: 0 };
        break;
      }
      case "mv":
      case "move": {
        if (args.length < 2) { result = fail("mv: missing operand"); break; }
        const src = resolvePath(cwdRef.current, args[0]!);
        let dest = resolvePath(cwdRef.current, args[1]!);
        const destNode = findNode(state.fs, dest);
        if (destNode && destNode.type === "folder") {
          dest = [...dest, src[src.length - 1]!];
        }
        dispatch({ type: "FS_MOVE_NODE", from: src, to: dest.slice(0, -1) });
        // rename if name changed
        const finalNode = findNode(state.fs, dest);
        if (finalNode && dest[dest.length - 1] !== src[src.length - 1]) {
          dispatch({ type: "FS_RENAME", path: dest, name: dest[dest.length - 1]! });
        }
        result = { out: "", code: 0 };
        break;
      }
      case "calc": {
        try {
          // eslint-disable-next-line no-eval
          result = { out: String(eval(args.join(" "))), code: 0 };
        } catch {
          result = fail("Error");
        }
        break;
      }
      case "neofetch":
        result = { out: "OS: ReactOS Browser Clone\nKernel: WebKernel 1.0\nUptime: " + Math.floor(performance.now() / 1000) + "s\nShell: pwsh 7.4\nCPU: Virtual x64\nMemory: 8GB", code: 0 };
        break;
      case "run": {
        if (!args.length) { result = fail("run: missing file"); break; }
        const f = tryRunFile();
        if (f) { result = f; break; }
        result = fail(`run: ${args[0]}: not found`);
        break;
      }
      default: {
        // try run as file
        const f = tryRunFile();
        if (f) { result = f; break; }
        result = fail(`'${name}' is not recognized as a command.`);
      }
    }

    // handle redirection
    if (redirect && result.out !== "__CLEAR__") {
      const target = resolvePath(cwdRef.current, redirect.file);
      const parent = target.slice(0, -1);
      const fileName = target[target.length - 1]!;
      let content = result.out;
      if (redirect.mode === "a") {
        const existing = findNode(state.fs, target);
        content = (existing?.content ?? "") + (existing?.content ? "\n" : "") + result.out;
      }
      dispatch({ type: "FS_CREATE_FILE", path: parent, name: fileName, content });
      result = { out: "", code: result.code };
    }

    return result;
  };

  const run = (cmdInput: string) => {
    const newLines = [...lines];
    const inputLines = cmdInput.split(/\r?\n/);
    for (const rawLine of inputLines) {
      const line = rawLine;
      if (line.trim() === "") {
        newLines.push(`PS ${pathStr(cwdRef.current)}> ${line}`);
        newLines.push("");
        continue;
      }
      // batch handling per line
      if (line.includes("&&")) {
        newLines.push(`PS ${pathStr(cwdRef.current)}> ${line}`);
        let code = 0;
        for (const seg of line.split("&&")) {
          if (code !== 0) break;
          const segTrim = seg.trim();
          if (segTrim === "") continue;
          const r = runAtomic(segTrim);
          code = r.code;
          if (r.clear) {
            newLines.length = 0;
          } else if (r.out === "__CLEAR__") {
            newLines.length = 0;
          } else if (r.out) {
            newLines.push(r.out);
          }
        }
        newLines.push("");
      } else if (line.includes(";")) {
        newLines.push(`PS ${pathStr(cwdRef.current)}> ${line}`);
        for (const seg of line.split(";")) {
          const segTrim = seg.trim();
          if (segTrim === "") continue;
          const r = runAtomic(segTrim);
          if (r.clear || r.out === "__CLEAR__") {
            newLines.length = 0;
          } else if (r.out) {
            newLines.push(r.out);
          }
        }
        newLines.push("");
      } else {
        newLines.push(`PS ${pathStr(cwdRef.current)}> ${line.trim()}`);
        const r = runAtomic(line.trim());
        if (r.clear || r.out === "__CLEAR__") {
          newLines.length = 0;
        } else {
          if (r.out) newLines.push(r.out);
          newLines.push("");
        }
      }
    }
    setLines(newLines);
    scrollToBottom();
  };

  return (
    <div className="app-terminal">
      <div className="terminal-body" ref={scrollRef}>
        {lines.map((l, i) => (
          <div key={i} className="terminal-line">{l}</div>
        ))}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">PS {pathStr(cwdRef.current)}&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              run(input);
              setInput("");
            }
          }}
          autoFocus
        />
      </div>
    </div>
  );
}