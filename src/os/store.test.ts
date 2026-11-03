import { describe, it, expect, beforeEach } from "bun:test";
import { reducer } from "./store";
import type { OSState } from "./types";
import { DEFAULT_FS, cloneFS } from "./fs";

const makeInitialState = (): OSState => ({
  windows: [],
  nextZ: 10,
  activeId: null,
  startOpen: false,
  search: "",
  widgetsOpen: false,
  actionCenterOpen: false,
  contextMenu: null,
  notifications: [],
  desktopStyle: "win11",
  theme: "dark",
  wallpaper: "default",
  locked: false,
  booted: true,
  bootProgress: 100,
  desktopIcons: [],
  fs: cloneFS(DEFAULT_FS),
  password: "admin",
});

describe("OS Reducer - Window Sizing & Positioning", () => {
  beforeEach(() => {
    // Reset global window object dimensions if needed
    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
    };
  });

  it("opens an app on desktop clamped within viewport bounds", () => {
    (globalThis as any).window.innerWidth = 800;
    (globalThis as any).window.innerHeight = 600;

    const state = makeInitialState();
    // explorer default size is 900x600, larger than 800x600 viewport
    const nextState = reducer(state, { type: "OPEN_APP", appId: "explorer" });

    expect(nextState.windows.length).toBe(1);
    const win = nextState.windows[0]!;
    expect(win.width).toBeLessThanOrEqual(800);
    expect(win.height).toBeLessThanOrEqual(600 - 48);
    expect(win.x + win.width).toBeLessThanOrEqual(800);
    expect(win.y + win.height).toBeLessThanOrEqual(600 - 48);
  });

  it("opens an app maximized on mobile devices (<=768px width)", () => {
    (globalThis as any).window.innerWidth = 390;
    (globalThis as any).window.innerHeight = 844;

    const state = makeInitialState();
    const nextState = reducer(state, { type: "OPEN_APP", appId: "chatbot" });

    expect(nextState.windows.length).toBe(1);
    const win = nextState.windows[0]!;
    expect(win.maximized).toBe(true);
    expect(win.x).toBe(0);
    expect(win.y).toBe(0);
    expect(win.width).toBe(390);
    expect(win.height).toBe(844 - 48);
  });

  it("opens an app maximized on mobile landscape devices (<=540px height)", () => {
    (globalThis as any).window.innerWidth = 844;
    (globalThis as any).window.innerHeight = 390;

    const state = makeInitialState();
    const nextState = reducer(state, { type: "OPEN_APP", appId: "calculator" });

    expect(nextState.windows.length).toBe(1);
    const win = nextState.windows[0]!;
    expect(win.maximized).toBe(true);
    expect(win.x).toBe(0);
    expect(win.y).toBe(0);
  });

  it("clamps window coordinates during MOVE so window is not lost off-screen", () => {
    (globalThis as any).window.innerWidth = 1000;
    (globalThis as any).window.innerHeight = 700;

    let state = makeInitialState();
    state = reducer(state, { type: "OPEN_APP", appId: "notepad" });
    const winId = state.windows[0]!.id;

    // Try moving window far off-screen to the right and bottom
    const movedState = reducer(state, { type: "MOVE", id: winId, x: 5000, y: 5000 });
    const movedWin = movedState.windows[0]!;

    expect(movedWin.x).toBeLessThanOrEqual(1000 - 60);
    expect(movedWin.y).toBeLessThanOrEqual(700 - 48 - 40);
  });

  it("clamps window dimensions during RESIZE within viewport bounds", () => {
    (globalThis as any).window.innerWidth = 900;
    (globalThis as any).window.innerHeight = 650;

    let state = makeInitialState();
    state = reducer(state, { type: "OPEN_APP", appId: "notepad" });
    const winId = state.windows[0]!.id;

    // Try resizing to 3000 x 3000
    const resizedState = reducer(state, { type: "RESIZE", id: winId, width: 3000, height: 3000 });
    const resizedWin = resizedState.windows[0]!;

    expect(resizedWin.width).toBeLessThanOrEqual(900);
    expect(resizedWin.height).toBeLessThanOrEqual(650 - 48);
  });

  it("maximizes and restores a window properly", () => {
    (globalThis as any).window.innerWidth = 1200;
    (globalThis as any).window.innerHeight = 800;

    let state = makeInitialState();
    state = reducer(state, { type: "OPEN_APP", appId: "notepad" });
    const winId = state.windows[0]!.id;

    // Maximize
    const maxState = reducer(state, { type: "MAXIMIZE", id: winId });
    const maxWin = maxState.windows[0]!;
    expect(maxWin.maximized).toBe(true);
    expect(maxWin.width).toBe(1200);
    expect(maxWin.height).toBe(800 - 48);

    // Restore
    const restoredState = reducer(maxState, { type: "MAXIMIZE", id: winId });
    const restoredWin = restoredState.windows[0]!;
    expect(restoredWin.maximized).toBe(false);
  });
});

describe('Gallery file opening', () => {
  it('passes the selected image path into a new or existing gallery window', () => {
    const first = reducer(makeInitialState(), { type: 'OPEN_APP', appId: 'gallery', filePath: ['Pictures', 'first.png'] });
    expect(first.windows[0]!.filePath).toEqual(['Pictures', 'first.png']);
    const second = reducer(first, { type: 'OPEN_APP', appId: 'gallery', filePath: ['Desktop', 'second.jpg'] });
    expect(second.windows).toHaveLength(1);
    expect(second.windows[0]!.filePath).toEqual(['Desktop', 'second.jpg']);
  });
});

describe('Desktop appearance window bounds', () => {
  it('reflows open windows and restore bounds when changing desktop styles', () => {
    (globalThis as any).window = { innerWidth: 1024, innerHeight: 768 };
    let state = reducer(makeInitialState(), { type: 'OPEN_APP', appId: 'gallery' });
    state = reducer(state, { type: 'MAXIMIZE', id: state.windows[0]!.id });
    state = reducer(state, { type: 'APPLY_APPEARANCE', preferences: { desktopStyle: 'ubuntu', theme: 'light', wallpaper: 'linear-gradient(red, blue)' } });
    expect(state.desktopStyle).toBe('ubuntu');
    expect(state.windows[0]!.width).toBeLessThanOrEqual(948);
    expect(state.windows[0]!.restore!.x + state.windows[0]!.restore!.width).toBeLessThanOrEqual(948);
    const next = reducer(state, { type: 'OPEN_APP', appId: 'settings' });
    expect(next.windows[1]!.x + next.windows[1]!.width).toBeLessThanOrEqual(948);
    expect(next.windows[1]!.y + next.windows[1]!.height).toBeLessThanOrEqual(732);
  });
});
