# ReactOS Browser Clone

A browser desktop with switchable Ubuntu, Windows 11, and ChromeOS appearances, built with React 19 and Bun. Ubuntu is the default.

It simulates a full OS-like experience: boot screen, lock screen, taskbar, start menu, desktop icons, draggable and resizable windows, notifications, widgets, action center, context menus, and a virtual file system with several built-in apps.

## Features

- Desktop with draggable icons and context menus (single-tap launch on touch/mobile)
- Ubuntu (default), Windows 11, and ChromeOS desktop styles with SQLite-backed appearance preferences
- Window manager (drag, resize, minimize, maximize, and viewport bounds clamping)
- Mobile-responsive layout (auto-maximized windows on mobile, dynamic viewport height, safe-area inset support)
- Responsive dock, shelf, or taskbar with touch-scrollable applications
- Responsive Widgets panel and Action center with safe-area spacing
- Lock screen with password protection
- Boot screen with progress animation
- File Explorer (virtual file system with responsive toolbar)
- Notepad and Notes (touch-friendly menus and sidebars)
- Calculator (responsive touch keypad)
- Browser (renders Bing pages in-app via /api/proxy; other URLs open in a new tab)
- Ubuntu-style terminal with common commands, quoted paths, pipes, scripts, redirection, and history
- Image Gallery with uploads, thumbnail browsing, zoom, rotation, download, and SQLite persistence
- Ollama Chat with streamed Markdown responses, persistent sessions, saved persona templates, and automatic neuromorphic memory
- Memory review, search, editing, importance controls, and individual or bulk deletion
- Interface-wide font scaling, including application controls and Markdown
- Settings for desktop style, light/dark mode, wallpaper, password, and mobile-friendly navigation
- Notifications, widgets panel, action center

## Getting started

### Prerequisites

- Bun (tested with version 1.4.4)
- An Ollama server reachable from the Bun server on port 11434, for chat generation. Other apps and memory management work without Ollama.

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

### Run tests

```bash
bun test
```

## Git helper scripts

The repository includes Bash and Windows scripts adapted from Qualia. Run them
from your system terminal; they operate on this project directory.

| Action | Linux/macOS or Git Bash | Windows Command Prompt |
| --- | --- | --- |
| Fetch and pull `origin/main` with rebase | `./update.sh` | `update.bat` |
| Stage all changes, commit, pull with rebase, and push | `./git.sh` | `git.bat` |

Git and access to the `origin` remote are required. The sync scripts create a
timestamped `reactos update - YYYY-MM-DD HH:MM:SS` commit. Review `git diff` and
`git status` before running them: they stage all changes, including untracked
files that are not ignored. If nothing is staged, they exit without pulling or
pushing; use `git push` directly to publish existing commits.

Both helpers stop on detached HEAD or an unfinished rebase, merge, or cherry-pick.
The sync helpers also reject staged conflict markers and whitespace errors, and
validate changed JSON files using Python 3 on Bash (skipped if unavailable) or
PowerShell on Windows. A failed pull stops the script before pushing and prints
recovery steps. Resolve conflicts and run `git rebase --continue`, or cancel with
`git rebase --abort`, before retrying. After continuing a rebase, use `git push`
if all changes are already committed.

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
  appearance/       # Desktop styles, preferences API, SQLite storage
  chat/             # Sessions, personas, memory engine, SQLite storage and saving
  gallery/          # Image upload/view API and SQLite storage
  terminal/         # Virtual shell and command tests
  components/       # Desktop, Taskbar, StartMenu, Window, apps, ...
  components/apps/  # Built-in applications
```

## Chatbot sessions and personas

Open **Chatbot**, configure the Ollama host in its settings, and select an available
model. The **New chat** button creates a session. Use the session selector to switch
conversations, the name field to rename one, and **Delete session** to remove its
history. Each session keeps its own messages, system prompt, and memory toggle.

In chatbot settings, edit **Persona for this session** to change the system prompt.
Enter a template name and choose **Save template** to reuse it in other sessions;
**Load a saved template** applies it to the current session. Saving an existing name
replaces that template. Persona changes apply to the next response.

## Automatic chatbot memory

**Neuromorphic memory** is enabled by default for new sessions. It automatically
remembers user messages and retrieves relevant memories for later responses,
including across sessions. There is no separate manual learning step. In settings,
turn the toggle off for a session to stop both automatic learning and recall;
existing shared memories remain available for review and deletion.

The current implementation is intended for casual use: it saves message text
directly, rather than using a second model call to extract facts or summaries. Exact
text duplicates reinforce the existing memory. Relevant recall uses word overlap,
activation decay, importance, and learned associations between memories recalled
together. Frequently activated memories can gain importance through consolidation.
The collection is limited to 500 memories, each up to 2,000 characters.

Automatic fact extraction, conversation summaries, and contradiction resolution
are not implemented. Use **Memories** to correct outdated information. Recalled
memory text supplements the active session's conversation history; deleting a
memory does not remove that text from older chat messages.

The memory engine adapts mechanisms from Qualia. Its MIT attribution is retained
in [src/chat/QUALIA-LICENSE](src/chat/QUALIA-LICENSE).

## Chatbot persistence

Chatbot sessions and their messages, saved persona templates, neuromorphic memory
(including activation traces and associations), and Ollama/font settings are saved
on the Bun server using `bun:sqlite`. The default file is `data/chatbot.sqlite`,
relative to the project directory. Set `CHAT_DB_PATH` to use a different location:

```sh
CHAT_DB_PATH=/persistent/reactos/chatbot.sqlite bun start
```

The parent directory is created automatically. Keep this directory on a persistent
volume when running in a container. Database files and SQLite sidecars in `data/`
are excluded from Git. To back up the database by copying its file, stop the server
first; copying only the main file while it is running can omit changes in the WAL.

On the first chatbot load with an empty database, existing browser chat data and
settings are imported. Once initialized, SQLite is authoritative: clearing browser
storage or using another browser loads the same saved chats. The legacy browser
copy is retained, but it does not overwrite an existing database. This desktop uses
one shared server workspace, rather than separate accounts per browser.

The chatbot displays `Saving…` or `Saved to SQLite`. Changes are saved automatically
roughly every 400 ms, including partial streamed responses. Wait for the saved
status before clearing browser data or closing the page. Pending saves trigger a
browser exit warning. Errors stay visible, and Retry save reconnects without
silently overwriting changes from another window. Conflicting windows must reload
the saved state; reloading discards that window's unsaved edits only after confirmation.

SQLite uses WAL, full synchronous commits, atomic state updates, and revision checks
so stale windows cannot overwrite newer saves. A server restart or clearing browser
storage does not remove committed data. Keep the database file to retain it across
server reinstalls or deployments.

## Image Gallery

Open **Gallery** from its desktop icon or the Start menu. Use **Add images** to
select multiple files, or drag files onto the Gallery window. PNG, JPEG, GIF,
WebP, AVIF, and BMP files up to 20 MB each are supported; display support also
depends on your browser. Uploaded originals and their metadata are stored in the
same SQLite database as the chatbot, so clearing browser storage does not remove
the collection. The upload confirmation appears only after the server saves it.

Click a thumbnail to review it. The viewer supports previous/next navigation,
fit-to-window, actual size, zoom, rotation, original download, and deletion with
confirmation. Rotation changes the preview only. Focus the image preview to use
Left/Right to browse, +/− to zoom, and 0 or Escape to fit. Search filters images by
name; Refresh reloads uploads made in another browser. The layout adapts to small
screens, and text follows the shared interface font scale.

Opening an image in File Explorer opens it in Gallery. Simulated filesystem files
with base64 image content can be displayed directly. The default sample files
(such as vacation.jpg) contain no image bytes; the viewer explains this instead
of displaying a broken image. Add the original through Gallery to save a viewable
copy. Simulated files remain managed in File Explorer; Gallery's Delete button
applies to server uploads.

## Desktop appearance

Open **Settings → System → Desktop style** (also available under Personalization)
to choose Ubuntu, Windows 11, or ChromeOS. Switching applies immediately and keeps
open applications running. Ubuntu uses an Activities bar, a left application dock,
an application overview, orange accents, and aubergine backgrounds. On small screens
the dock moves to the bottom. ChromeOS uses a floating shelf, a rounded launcher,
cool surfaces, and soft backgrounds. Windows 11 retains the original centered taskbar
and Start menu.

Light/dark mode and background can be changed independently. Switching styles
replaces the background only if it is that style's default; custom backgrounds are
preserved. Open windows are adjusted to fit the new workspace. The dock and shelf
include quick access to Gallery and Chatbot.

Desktop style, light/dark mode, and wallpaper are saved in the
`appearance_preferences` table in the same SQLite database as the chatbot and Gallery
(`data/chatbot.sqlite`, or `CHAT_DB_PATH`). Preferences load before the boot screen,
including when browser storage has been cleared. Appearance settings are shared by
browsers connected to this server. Wait for **Saved to SQLite** before closing the
page. Save errors expose retry/reload controls; revision checks prevent older windows
from silently overwriting newer preferences. Changes to this table do not rewrite
chat histories or image uploads.

## Ubuntu-style terminal

Open **Terminal** from the dock, desktop, or application launcher. Ubuntu and
ChromeOS appearances use a `user@reactos:~$` prompt with Linux-style paths.
`/home/user` maps to the same virtual files shown in Files. Windows 11 retains the
PowerShell-style prompt and Windows path display, plus aliases such as `dir`,
`type`, `copy`, `move`, `del`, and `cls`.

Type `help` for supported commands. The shell includes navigation and file
operations (`pwd`, `ls -la`, `cd`, `mkdir -p`, `touch`, `cat`, `cp -r`, `mv`, `rm -r`,
`rmdir`), text tools (`grep`, `head`, `tail`, `wc`, `sort`, `uniq`), `find`, `tree`,
`whoami`, `hostname`, `uname`, `date`, `uptime`, `neofetch`, and arithmetic via `calc`.
Use quotes for filenames containing spaces, pipes to filter output, `>`/`>>` to
write files, `&&` to continue on success, and semicolons to sequence commands:

```sh
mkdir -p Projects/demo && cd Projects/demo
echo "Hello from ReactOS" > "hello world.txt"
cat "hello world.txt" | grep -i reactos
cp "hello world.txt" backup.txt
ls -la
```

Use Up/Down to recall command history, Ctrl+L to clear output, and Ctrl+C to cancel
input. `sh file.sh`, `bash file.sh`, and `run file.sh` execute scripts using the
supported commands. This is the built-in ReactOS virtual shell, rather than a
connection to the server's operating system; host commands such as `sudo` and
`apt` are unavailable. Terminal file changes use the desktop's existing virtual
filesystem storage, independent of the SQLite-backed chatbot, Gallery, and
appearance preferences. The terminal copyright banner identifies ReactOS.

## Reviewing chatbot memories

Use **Memories** in the chatbot toolbar (or **Review and edit memories** in its
settings) to open the memory review panel. It works without an Ollama connection.
Search memory text, filter by review status, or sort by recent changes, importance,
or activation. Each memory shows its text, review status, activation, importance,
timestamps, and learned associations under **Memory details**. Older memories may
show **Not recorded** for timestamps that were not tracked previously.

Use **Mark reviewed** to record a review without reinforcing recall strength.
**Edit** lets you correct the text and adjust importance; **Save changes** also
marks the memory reviewed. Blank text and duplicate memory text are rejected.
Changing text resets that memory's activation and learned associations, allowing
future recall to learn connections to the corrected fact. Importance-only edits
retain existing associations. **Cancel** discards the draft.

**Delete** removes an individual memory and its incoming associations; **Delete
all memories** clears the shared memory collection. Both require confirmation.
Review marks, edits, and deletions persist through the existing SQLite save flow.
Wait for **Saved to SQLite** before closing. Changes affect memories shared across
all sessions; existing chat messages remain and can still provide conversation
context. Editing is paused during response generation or a storage error; browsing
and search remain available. **Back to chat** returns to the conversation.


## Storage overview

| Data | Storage | Survives clearing browser storage? |
| --- | --- | --- |
| Chat sessions, messages, persona templates, memories and review metadata | Server SQLite | Yes, after a successful save |
| Ollama settings and interface font scale | Server SQLite, with a local browser copy | Yes; restored when Chatbot loads |
| Gallery uploads and metadata | Server SQLite | Yes |
| Desktop style, light/dark mode, wallpaper | Server SQLite | Yes; restored before boot |
| Virtual filesystem, terminal-created files, Notes, lock-screen password | Browser localStorage | No |
| Open windows and terminal history | In-memory UI state | No |

The default SQLite file is `data/chatbot.sqlite`; `CHAT_DB_PATH` changes the location
for all server-persisted features. Keep that file and its directory when deploying
or upgrading the server.

## License

This project is released under the MIT License. See [LICENSE](LICENSE). The
Qualia-derived memory implementation also retains its [upstream MIT notice](src/chat/QUALIA-LICENSE).
