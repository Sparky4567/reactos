# ReactOS Browser Clone

A Windows 11 style desktop environment that runs entirely in your browser, built with React 19 and Bun.

It simulates a full OS-like experience: boot screen, lock screen, taskbar, start menu, desktop icons, draggable and resizable windows, notifications, widgets, action center, context menus, and a virtual file system with several built-in apps.

## Features

- Desktop with draggable icons and context menus
- Window manager (drag, resize, minimize, maximize, snap)
- Lock screen with password protection
- Boot screen with progress animation
- File Explorer (virtual file system)
- Notepad and Notes
- Calculator
- Browser (renders Bing pages in-app via /api/proxy; other URLs open in a new tab)
- Terminal
- Settings (theme, wallpaper, password)
- Notifications, widgets panel, action center

## Getting started

### Prerequisites

- Bun v1.0 or newer

### Install dependencies

```bash
bun install
```

### Run in development

```bash
bun dev
```

This starts the dev server with hot module reloading. Open the URL printed in the terminal (usually http://localhost:3000).

### Run in production

```bash
bun start
```

### Build

```bash
bun run build
```

Output goes to dist/.

### Type check

```bash
bun run typecheck
```

## Configuration

The dev/production server listens on port 3000 by default. Override it with a
command-line flag or an environment variable:

```bash
bun dev -- --port 4000
PORT=4000 bun start
```

## Default credentials

- Default password: admin

The lock screen accepts this password on a fresh install (no password set in localStorage). You can change or remove it from Settings, Change password.

## Project structure

```
src/
  index.ts          # Bun server (routes + proxy)
  frontend.tsx      # React entry point
  App.tsx           # Root component
  os/               # OS state, reducer, virtual file system, app registry
  components/       # Desktop, Taskbar, StartMenu, Window, apps, ...
  components/apps/  # Built-in applications
```

## License

This project is released under the MIT License. See LICENSE.
