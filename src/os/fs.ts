import type { FSNode } from "./types";

export const DEFAULT_FS: FSNode = {
  name: "This PC",
  type: "folder",
  children: [
    { name: "Desktop", type: "folder", children: [
      { name: "readme.txt", type: "file", content: "Welcome to ReactOS!\nThis is a simulated desktop environment.\n", size: 48, modified: Date.now() },
      { name: "screenshot.png", type: "file", content: "", size: 245 * 1024, modified: Date.now() },
    ]},
    { name: "Documents", type: "folder", children: [
      { name: "Resume.docx", type: "file", content: "", size: 42 * 1024, modified: Date.now() },
      { name: "Notes.txt", type: "file", content: "Meeting notes\n- item 1\n- item 2\n", size: 3 * 1024, modified: Date.now() },
    ]},
    { name: "Downloads", type: "folder", children: [
      { name: "installer.exe", type: "file", content: "", size: 12.4 * 1024 * 1024, modified: Date.now() },
    ]},
    { name: "Pictures", type: "folder", children: [
      { name: "vacation.jpg", type: "file", content: "", size: 1.2 * 1024 * 1024, modified: Date.now() },
    ]},
    { name: "Music", type: "folder", children: [] },
    { name: "Videos", type: "folder", children: [] },
    { name: "Projects", type: "folder", children: [
      { name: "hello.txt", type: "file", content: "Hello from Projects!\n", size: 20, modified: Date.now() },
    ]},
    { name: "Local Disk (C:)", type: "folder", children: [
      { name: "Windows", type: "folder", children: [] },
      { name: "Program Files", type: "folder", children: [] },
      { name: "Users", type: "folder", children: [
        { name: "user", type: "folder", children: [] },
      ]},
    ]},
  ],
};

export function cloneFS(node: FSNode): FSNode {
  return JSON.parse(JSON.stringify(node));
}

export function findNode(root: FSNode, path: string[]): FSNode | null {
  let cur: FSNode | undefined = root;
  if (path.length === 0) return root;
  for (const seg of path) {
    if (!cur || cur.type !== "folder") return null;
    cur = cur.children?.find((c) => c.name === seg);
  }
  return cur ?? null;
}

export function findParent(root: FSNode, path: string[]): { parent: FSNode; index: number } | null {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const parent = findNode(root, parentPath);
  if (!parent || parent.type !== "folder" || !parent.children) return null;
  const idx = parent.children.findIndex((c) => c.name === path[path.length - 1]);
  if (idx === -1) return null;
  return { parent, index: idx };
}

function now() { return Date.now(); }

export function createFolder(root: FSNode, path: string[], name: string): FSNode {
  const r = cloneFS(root);
  const parent = findNode(r, path);
  if (!parent || parent.type !== "folder") return r;
  parent.children = parent.children ?? [];
  if (parent.children.some((c) => c.name === name)) return r; // exists
  parent.children.push({ name, type: "folder", children: [], modified: now() });
  parent.modified = now();
  return r;
}

export function createFile(root: FSNode, path: string[], name: string, content: string = ""): FSNode {
  const r = cloneFS(root);
  const parent = findNode(r, path);
  if (!parent || parent.type !== "folder") return r;
  parent.children = parent.children ?? [];
  const existing = parent.children.find((c) => c.name === name);
  if (existing) {
    existing.content = content;
    existing.size = content.length;
    existing.modified = now();
  } else {
    parent.children.push({ name, type: "file", content, size: content.length, modified: now() });
  }
  parent.modified = now();
  return r;
}

export function deleteNode(root: FSNode, path: string[]): FSNode {
  const r = cloneFS(root);
  const info = findParent(r, path);
  if (!info) return r;
  info.parent.children!.splice(info.index, 1);
  info.parent.modified = now();
  return r;
}

export function renameNode(root: FSNode, path: string[], name: string): FSNode {
  const r = cloneFS(root);
  const info = findParent(r, path);
  if (!info) {
    // root rename not allowed
    return r;
  }
  const node = info.parent.children![info.index]!;
  node.name = name;
  node.modified = now();
  return r;
}

export function writeFile(root: FSNode, path: string[], content: string): FSNode {
  const r = cloneFS(root);
  const node = findNode(r, path);
  if (!node || node.type !== "file") return r;
  node.content = content;
  node.size = content.length;
  node.modified = now();
  return r;
}

export function moveNode(root: FSNode, from: string[], to: string[]): FSNode {
  const r = cloneFS(root);
  const fromInfo = findParent(r, from);
  if (!fromInfo) return r;
  const node = fromInfo.parent.children![fromInfo.index]!;
  // remove
  fromInfo.parent.children!.splice(fromInfo.index, 1);
  // destination parent
  const destParent = findNode(r, to);
  if (!destParent || destParent.type !== "folder") return r;
  destParent.children = destParent.children ?? [];
  destParent.children.push(node);
  return r;
}

export function formatSize(n?: number): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function pathStr(path: string[]): string {
  if (path.length === 0) return "C:\\";
  return "C:\\" + path.join("\\");
}

// Resolve a path string relative to cwd (array). Supports . .. and absolute-ish
export function resolvePath(cwd: string[], input: string): string[] {
  const parts = input.replace(/\\/g, "/").split("/").filter(Boolean);
  let cur = input.startsWith("/") || input.startsWith("C:") ? [] : [...cwd];
  // handle drive
  if (input.toLowerCase().startsWith("c:")) {
    // strip drive
    const rest = input.slice(2).replace(/^\\/, "").replace(/^\/+/, "");
    cur = [];
    for (const seg of rest.split(/[\\/]/).filter(Boolean)) {
      if (seg === ".") continue;
      if (seg === "..") { cur.pop(); continue; }
      cur.push(seg);
    }
    return cur;
  }
  for (const seg of parts) {
    if (seg === ".") continue;
    if (seg === "..") { cur.pop(); continue; }
    cur.push(seg);
  }
  return cur;
}

export function getNodeByPath(root: FSNode, path: string[]): FSNode | null {
  return findNode(root, path);
}