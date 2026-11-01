export type Theme = "light" | "dark";

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
  restore?: { x: number; y: number; width: number; height: number };
}

export interface MenuItem {
  label: string;
  icon?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  icon?: string;
  time: number;
}

export interface FSNode {
  name: string;
  type: "folder" | "file";
  children?: FSNode[];
  content?: string;
  size?: number;
  modified?: number;
}

export interface DesktopIcon {
  id: string;
  appId: string;
  label: string;
  x: number;
  y: number;
}

export interface OSState {
  windows: WindowState[];
  nextZ: number;
  activeId: string | null;
  startOpen: boolean;
  search: string;
  widgetsOpen: boolean;
  actionCenterOpen: boolean;
  contextMenu: { x: number; y: number; items: MenuItem[] } | null;
  notifications: NotificationItem[];
  theme: Theme;
  wallpaper: string;
  locked: boolean;
  booted: boolean;
  bootProgress: number;
  desktopIcons: DesktopIcon[];
  fs: FSNode;
  password: string;
}

export type OSAction =
  | { type: "BOOT_DONE" }
  | { type: "SET_BOOT_PROGRESS"; value: number }
  | { type: "UNLOCK" }
  | { type: "LOCK" }
  | { type: "OPEN_APP"; appId: string; title?: string }
  | { type: "CLOSE_WINDOW"; id: string }
  | { type: "MINIMIZE"; id: string }
  | { type: "MAXIMIZE"; id: string }
  | { type: "RESTORE"; id: string }
  | { type: "FOCUS"; id: string }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "RESIZE"; id: string; width: number; height: number; x?: number; y?: number }
  | { type: "SET_START"; open: boolean }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_WIDGETS"; open: boolean }
  | { type: "SET_ACTION_CENTER"; open: boolean }
  | { type: "SET_CONTEXT_MENU"; menu: OSState["contextMenu"] }
  | { type: "PUSH_NOTIFICATION"; n: NotificationItem }
  | { type: "DISMISS_NOTIFICATION"; id: string }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_WALLPAPER"; wallpaper: string }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "MOVE_DESKTOP_ICON"; id: string; x: number; y: number }
  | { type: "REMOVE_DESKTOP_ICON"; id: string }
  | { type: "FS_CREATE_FOLDER"; path: string[]; name: string }
  | { type: "FS_CREATE_FILE"; path: string[]; name: string; content?: string }
  | { type: "FS_DELETE"; path: string[] }
  | { type: "FS_RENAME"; path: string[]; name: string }
  | { type: "FS_WRITE_FILE"; path: string[]; content: string }
  | { type: "FS_MOVE_NODE"; from: string[]; to: string[] };
