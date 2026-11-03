import type { DesktopStyle } from "@/appearance/preferences";
import { Gallery } from "@/components/apps/Gallery";
import type { ComponentType } from "react";
import { FileExplorer } from "@/components/apps/FileExplorer";
import { Notepad } from "@/components/apps/Notepad";
import { Calculator } from "@/components/apps/Calculator";
import { Browser } from "@/components/apps/Browser";
import { Settings } from "@/components/apps/Settings";
import { Terminal } from "@/components/apps/Terminal";
import { Notes } from "@/components/apps/Notes";
import { Chatbot } from "@/components/apps/Chatbot";

export interface AppDef {
  id: string;
  name: string;
  icon: string; // font-awesome class
  component: ComponentType<{ windowId: string }>;
}

export const APPS: AppDef[] = [
  { id: "gallery", name: "Gallery", icon: "fa-picture-o", component: Gallery },
  { id: "explorer", name: "File Explorer", icon: "fa-folder-open", component: FileExplorer },
  { id: "notepad", name: "Notepad", icon: "fa-file-text-o", component: Notepad },
  { id: "calculator", name: "Calculator", icon: "fa-calculator", component: Calculator },
  { id: "browser", name: "Microsoft Edge", icon: "fa-internet-explorer", component: Browser },
  { id: "settings", name: "Settings", icon: "fa-cog", component: Settings },
  { id: "terminal", name: "Terminal", icon: "fa-terminal", component: Terminal },
  { id: "notes", name: "OneNote", icon: "fa-book", component: Notes },
  { id: "chatbot", name: "Chatbot", icon: "fa-comments", component: Chatbot },
];

export const APP_MAP = Object.fromEntries(APPS.map((a) => [a.id, a]));

export function presentApp(app: AppDef, style: DesktopStyle): AppDef {
  if (style === "win11") return app;
  const names: Record<string, string> = { explorer: "Files", notepad: "Text Editor", browser: "Web Browser", notes: "Notes" };
  return { ...app, name: names[app.id] || app.name, icon: app.id === "browser" ? (style === "chromeos" ? "fa-chrome" : "fa-globe") : app.icon };
}
