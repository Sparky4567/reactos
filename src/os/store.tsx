import { useAppearance } from "@/appearance/context";
import { DEFAULT_APPEARANCE, workspace } from "@/appearance/preferences";
import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { OSState, OSAction, WindowState, DesktopIcon } from "./types";
import { DEFAULT_FS, cloneFS, createFolder, createFile, deleteNode, renameNode, writeFile, moveNode } from "./fs";

const initialIcons: DesktopIcon[] = [
  { id: "di-explorer", appId: "explorer", label: "File Explorer", x: 24, y: 24 },
  { id: "di-notepad", appId: "notepad", label: "Notepad", x: 24, y: 120 },
  { id: "di-calc", appId: "calculator", label: "Calculator", x: 24, y: 216 },
  { id: "di-browser", appId: "browser", label: "Edge", x: 24, y: 312 },
  { id: "di-settings", appId: "settings", label: "Settings", x: 24, y: 408 },
  { id: "di-terminal", appId: "terminal", label: "Terminal", x: 120, y: 24 },
  { id: "di-notes", appId: "notes", label: "OneNote", x: 24, y: 600 },
  { id: "di-gallery", appId: "gallery", label: "Gallery", x: 120, y: 216 },
  { id: "di-chatbot", appId: "chatbot", label: "Chatbot", x: 120, y: 120 },
];

function loadFS() {
  try {
    const raw = localStorage.getItem("reactos.fs");
    if (raw) return JSON.parse(raw);
  } catch {}
  return cloneFS(DEFAULT_FS);
}

function loadPassword() {
  try {
    const stored = localStorage.getItem("reactos.password");
    // Default password for a fresh install is "admin"
    return stored === null ? "admin" : stored;
  } catch {}
  return "admin";
}

const initialState: OSState = {
  windows: [],
  nextZ: 10,
  activeId: null,
  startOpen: false,
  search: "",
  widgetsOpen: false,
  actionCenterOpen: false,
  contextMenu: null,
  notifications: [],
  ...DEFAULT_APPEARANCE,
  locked: true,
  booted: false,
  bootProgress: 0,
  desktopIcons: initialIcons,
  fs: loadFS(),
  password: loadPassword(),
};

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${++idCounter}-${Date.now()}`;

const defaultSize: Record<string, { w: number; h: number }> = {
  explorer: { w: 900, h: 600 },
  notepad: { w: 640, h: 480 },
  calculator: { w: 320, h: 520 },
  browser: { w: 1000, h: 680 },
  settings: { w: 820, h: 620 },
  terminal: { w: 760, h: 480 },
  notes: { w: 900, h: 620 },
  gallery: { w: 1000, h: 680 },
  chatbot: { w: 920, h: 640 },
};

function cascadeOffset(windows: WindowState[]) {
  const n = windows.length;
  return { x: 80 + (n % 8) * 30, y: 60 + (n % 8) * 30 };
}

export function reducer(state: OSState, action: OSAction): OSState {
  switch (action.type) {
    case "BOOT_DONE":
      return { ...state, booted: true, bootProgress: 100 };
    case "SET_BOOT_PROGRESS":
      return { ...state, bootProgress: action.value };
    case "UNLOCK":
      return { ...state, locked: false };
    case "LOCK":
      return { ...state, locked: true, startOpen: false, widgetsOpen: false, actionCenterOpen: false, contextMenu: null };
    case "OPEN_APP": {
      const existing = state.windows.find((w) => w.appId === action.appId && !w.minimized);
      // focus existing if present
      const anyExisting = state.windows.find((w) => w.appId === action.appId);
      if (anyExisting) {
        const z = state.nextZ + 1;
        return {
          ...state,
          nextZ: z,
          activeId: anyExisting.id,
          windows: state.windows.map((w) =>
            w.id === anyExisting.id ? { ...w, minimized: false, z, ...(action.filePath ? { filePath: action.filePath } : {}) } : w
          ),
          startOpen: false,
          search: "",
        };
      }
      const isMobile =
        typeof window !== "undefined" &&
        (window.innerWidth <= 768 || window.innerHeight <= 540);
      const size = defaultSize[action.appId] ?? { w: 700, h: 500 };
      const off = cascadeOffset(state.windows);
      const z = state.nextZ + 1;
      const area = workspace(state.desktopStyle, typeof window !== "undefined" ? window.innerWidth : 1200, typeof window !== "undefined" ? window.innerHeight : 748);
      const availW = area.width;
      const availH = area.height;
      const width = isMobile ? availW : Math.min(size.w, Math.max(280, availW - 20));
      const height = isMobile ? availH : Math.min(size.h, Math.max(200, availH - 20));
      const x = isMobile ? 0 : Math.max(0, Math.min(off.x, availW - width));
      const y = isMobile ? 0 : Math.max(0, Math.min(off.y, availH - height));
      const win: WindowState = {
        id: newId("win"),
        appId: action.appId,
        filePath: action.filePath,
        title: action.title ?? action.appId,
        x,
        y,
        width,
        height,
        minimized: false,
        maximized: isMobile,
        z,
      };
      return {
        ...state,
        windows: [...state.windows, win],
        nextZ: z,
        activeId: win.id,
        startOpen: false,
        search: "",
      };
      // keep existing var unused quiet
      void existing;
    }
    case "CLOSE_WINDOW":
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
      };
    case "MINIMIZE":
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, minimized: true } : w)),
        activeId: state.activeId === action.id ? null : state.activeId,
      };
    case "MAXIMIZE":
      return {
        ...state,
        windows: state.windows.map((w) => {
          if (w.id !== action.id) return w;
          if (w.maximized) {
            const r = w.restore ?? { x: w.x, y: w.y, width: w.width, height: w.height };
            return { ...w, maximized: false, ...r, restore: undefined };
          }
          const area = workspace(state.desktopStyle, typeof window !== "undefined" ? window.innerWidth : 1200, typeof window !== "undefined" ? window.innerHeight : 748);
          const screenW = area.width;
          const screenH = area.height;
          return {
            ...w,
            maximized: true,
            restore: { x: w.x, y: w.y, width: w.width, height: w.height },
            x: 0,
            y: 0,
            width: screenW,
            height: screenH,
          };
        }),
      };
    case "RESTORE":
      return {
        ...state,
        windows: state.windows.map((w) => {
          if (w.id !== action.id) return w;
          const r = w.restore;
          return r ? { ...w, maximized: false, minimized: false, ...r, restore: undefined } : { ...w, minimized: false };
        }),
        activeId: action.id,
      };
    case "FOCUS": {
      const z = state.nextZ + 1;
      return {
        ...state,
        nextZ: z,
        activeId: action.id,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, z, minimized: false } : w)),
      };
    }
    case "MOVE": {
      const area = workspace(state.desktopStyle, typeof window !== "undefined" ? window.innerWidth : 1200, typeof window !== "undefined" ? window.innerHeight : 748);
      const availW = area.width;
      const availH = area.height;
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                x: Math.max(0, Math.min(action.x, availW - 60)),
                y: Math.max(0, Math.min(action.y, availH - 40)),
              }
            : w
        ),
      };
    }
    case "RESIZE": {
      const area = workspace(state.desktopStyle, typeof window !== "undefined" ? window.innerWidth : 1200, typeof window !== "undefined" ? window.innerHeight : 748);
      const availW = area.width;
      const availH = area.height;
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                width: Math.min(availW, Math.max(260, action.width)),
                height: Math.min(availH, Math.max(180, action.height)),
                x: action.x !== undefined ? Math.max(0, action.x) : w.x,
                y: action.y !== undefined ? Math.max(0, action.y) : w.y,
              }
            : w
        ),
      };
    }
    case "SET_START":
      return { ...state, startOpen: action.open, widgetsOpen: action.open ? false : state.widgetsOpen, actionCenterOpen: action.open ? false : state.actionCenterOpen };
    case "SET_SEARCH":
      return { ...state, search: action.value, startOpen: true };
    case "SET_WIDGETS":
      return { ...state, widgetsOpen: action.open, startOpen: action.open ? false : state.startOpen };
    case "SET_ACTION_CENTER":
      return { ...state, actionCenterOpen: action.open, startOpen: action.open ? false : state.startOpen };
    case "SET_CONTEXT_MENU":
      return { ...state, contextMenu: action.menu };
    case "PUSH_NOTIFICATION":
      return { ...state, notifications: [action.n, ...state.notifications].slice(0, 8) };
    case "DISMISS_NOTIFICATION":
      return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) };
    case "APPLY_APPEARANCE": {
      const area = workspace(action.preferences.desktopStyle, typeof window !== "undefined" ? window.innerWidth : 1200, typeof window !== "undefined" ? window.innerHeight : 748);
      return { ...state, ...action.preferences, windows: state.windows.map(w => ({ ...w,
        width: Math.min(w.width, area.width), height: Math.min(w.height, area.height),
        x: Math.max(0, Math.min(w.x, area.width - Math.min(w.width, area.width))),
        y: Math.max(0, Math.min(w.y, area.height - Math.min(w.height, area.height))),
        restore: w.restore ? { width: Math.min(w.restore.width, area.width), height: Math.min(w.restore.height, area.height), x: Math.max(0, Math.min(w.restore.x, area.width - Math.min(w.restore.width, area.width))), y: Math.max(0, Math.min(w.restore.y, area.height - Math.min(w.restore.height, area.height))) } : undefined,
      })) };
    }
    case "SET_DESKTOP_STYLE":
      return { ...state, desktopStyle: action.desktopStyle };
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_WALLPAPER":
      return { ...state, wallpaper: action.wallpaper };
    case "MOVE_DESKTOP_ICON":
      return {
        ...state,
        desktopIcons: state.desktopIcons.map((d) => (d.id === action.id ? { ...d, x: action.x, y: action.y } : d)),
      };
    case "REMOVE_DESKTOP_ICON":
      return { ...state, desktopIcons: state.desktopIcons.filter((d) => d.id !== action.id) };
    case "FS_REPLACE_ROOT":
      return { ...state, fs: action.fs };
    case "FS_CREATE_FOLDER":
      return { ...state, fs: createFolder(state.fs, action.path, action.name) };
    case "FS_CREATE_FILE":
      return { ...state, fs: createFile(state.fs, action.path, action.name, action.content) };
    case "FS_DELETE":
      return { ...state, fs: deleteNode(state.fs, action.path) };
    case "FS_RENAME":
      return { ...state, fs: renameNode(state.fs, action.path, action.name) };
    case "FS_WRITE_FILE":
      return { ...state, fs: writeFile(state.fs, action.path, action.content) };
    case "FS_MOVE_NODE":
      return { ...state, fs: moveNode(state.fs, action.from, action.to) };
    case "SET_PASSWORD":
      return { ...state, password: action.password };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: OSState; dispatch: React.Dispatch<OSAction> } | null>(null);

export function OSProvider({ children }: { children: ReactNode }) {
  const { preferences, update } = useAppearance();
  const [state, baseDispatch] = useReducer(reducer, initialState);
  const dispatch = useCallback((action: OSAction) => {
    if (action.type === "SET_DESKTOP_STYLE") update({ desktopStyle: action.desktopStyle });
    if (action.type === "SET_THEME") update({ theme: action.theme });
    if (action.type === "SET_WALLPAPER") update({ wallpaper: action.wallpaper });
    baseDispatch(action);
  }, [update]);
  useEffect(() => { baseDispatch({ type: "APPLY_APPEARANCE", preferences }); }, [preferences]);
  useEffect(() => {
    try { localStorage.setItem("reactos.fs", JSON.stringify(state.fs)); } catch {}
  }, [state.fs]);
  useEffect(() => {
    try { localStorage.setItem("reactos.password", state.password); } catch {}
  }, [state.password]);
  return <Ctx.Provider value={{ state: { ...state, ...preferences }, dispatch }}>{children}</Ctx.Provider>;
}

export function useOS() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOS outside provider");
  return v;
}
export const newNotifId = () => newId("notif");
export const newWinId = () => newId("win");
