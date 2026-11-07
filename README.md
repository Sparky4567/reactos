# ReactOS Browser Clone

A browser desktop with switchable Ubuntu, Windows 11, ChromeOS, Google Fuchsia, Windows retro, Android, Matrix terminal, and Cyberpunk terminal appearances, built with React 19 and Bun. Ubuntu is the default.

It simulates a full OS-like experience: boot screen, lock screen, taskbar, start menu, desktop icons, draggable and resizable windows, notifications, widgets, action center, context menus, and a virtual file system with several built-in apps.

## Features

- Desktop with draggable icons and context menus (single-tap launch on touch/mobile)
- Ubuntu (default), Windows 11, ChromeOS, Google Fuchsia, Windows retro, Android, Matrix terminal, and Cyberpunk terminal desktop styles with SQLite-backed appearance preferences
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
- Selectable chatbot speech: local Piper with download consent, browser speech, or Off
- Browser voice dictation into editable chatbot prompts
- Toggleable continuous listening with a configurable wake word or phrase
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
  chat/             # Sessions, personas, memory, voice, SQLite storage and saving
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

Memories are also automatically saved as readable, versioned JSON in
`data/memories.json`. This file is **not ignored by Git**: after restarting the
server once, existing SQLite memories are exported. After that, creating,
editing, reviewing, or deleting memories automatically updates both SQLite and
the JSON file through the normal save cycle (roughly every 400 ms). **No Export
button or manual export is needed.** The `Saved to SQLite` status means the save
including the JSON memory copy has completed.

Saving locally does not commit or push to GitHub automatically. Wait for the
chatbot's saved status, then commit and push the JSON along with your project
updates:

```sh
git add data/memories.json
git commit -m "Update saved memories"
git push
```

After pulling on another machine, restart the server to load the JSON memories.
An existing JSON file takes precedence over SQLite memories on startup; chats,
personas, and settings stay in SQLite. An empty `memories` array clears memories.
Stop the server before editing or pulling this file to avoid local saves
replacing those edits. Invalid JSON stops startup instead of overwriting data.
The file contains `{ "version": 1, "memories": [...] }`, preserving memory IDs,
text, timestamps, activation, importance, and associations. It contains personal
memory content, so commit it only to a repository where you intend to share it.
Set `CHAT_MEMORIES_PATH` to change its location. JSON storage is server-side and
still requires the Bun server; it does not make the app work on GitHub Pages.

On the first chatbot load with an empty database, existing browser chat data and
settings are imported, with JSON memories taking precedence if present. Once
initialized, browsers load the shared server state: clearing browser storage or
using another browser loads the same saved chats. The legacy browser
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
to choose Ubuntu, Windows 11, ChromeOS, Google Fuchsia, Windows retro, Android, Matrix terminal, or Cyberpunk terminal. Switching applies immediately and keeps
open applications running. Ubuntu uses an Activities bar, a left application dock,
an application overview, orange accents, and aubergine backgrounds. On small screens
the dock moves to the bottom. ChromeOS uses a floating shelf, a rounded launcher,
cool surfaces, and soft backgrounds. Windows 11 retains the original centered taskbar
and Start menu.

Google Fuchsia uses magenta accents, layered cards, a floating dock, and a pink/purple
wallpaper. Windows retro brings a Windows 95-inspired teal desktop, navy title bars,
beveled controls, and a classic Start button. Android uses botanical Material-inspired
colors, rounded panels, circular icons, and pill controls.

Matrix terminal adds phosphor-green text, monospace typography, square window frames,
and a scanline grid wallpaper. Cyberpunk terminal combines neon cyan controls, magenta
highlights, glowing frames, and a circuit grid wallpaper. Both styles use the Linux-style
terminal prompt and provide coordinated light and dark palettes. Each style includes a
preview in Settings and supports light and dark modes.

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

Open **Terminal** from the dock, desktop, or application launcher. Ubuntu,
ChromeOS, Google Fuchsia, Android, Matrix terminal, and Cyberpunk terminal appearances use a `user@reactos:~$` prompt with Linux-style paths.
`/home/user` maps to the same virtual files shown in Files. Windows 11 and Windows retro use the
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


## Chat voice

Use the **Speech** list in the chat toolbar:

- **Off** (default): silent replies.
- **On [Piper Small]** or **On [Piper Medium]**: confirm the download to enable local speech with
  [`@mintplex-labs/piper-tts-web`](https://www.npmjs.com/package/@mintplex-labs/piper-tts-web).
  Small uses English `en_US-lessac-low`; Medium uses `en_US-amy-medium`.
  Both downloads are about 63 MB, plus runtime files; Small selects the low
  quality tier rather than a smaller download. Models are cached in the browser's origin private
  filesystem. Enabling permits downloads again if that cache is cleared.
  Both choices support the phonemizer's extended symbol IDs; Amy low's smaller
  symbol table can cause ONNX `Gather` out-of-bounds errors during speech.
  The selected voice is remembered between visits. Switch between Small and
  Medium in the Speech list; **Load / retry Piper voice** loads the selected model.
- **On [Web]**: browser speech synthesis, with no Piper model download.
  This is also the fallback to select if Piper fails.

Completed replies are spoken automatically. **Read aloud** replays a reply and
can retry playback blocked by browser autoplay rules. A toast during speech
preparation and playback offers **Stop speech**, which stops
playback and discards pending speech; already running model loading/inference
may finish in the background. Switching sessions, sending another prompt, or
closing the chat also stops playback.

The microphone button uses browser `SpeechRecognition` / `webkitSpeechRecognition`
and requests microphone permission when activated. Hold the microphone button to
speak, then release to finish. With the button focused, hold Space or Enter.
You can also hold Space elsewhere in the active chat window without focusing the
microphone. This shortcut is disabled in the prompt box, other editable fields,
and interactive controls, so typing spaces never starts recognition. Switching
focus or releasing Space finishes shortcut dictation; switching away from the
browser or hiding the tab also stops recording.

A recording indicator and live transcript appear while listening. Recognized
text is appended to the editable prompt without sending it. Pending words are
preserved if the browser ends recognition without a final result, and finalized
segments are inserted only once. Review and edit the transcript before sending.
Recognition uses the browser language. Unsupported browsers disable the button;
HTTPS or localhost is required. Browser dictation and browser voices may use
online services; Piper speech inference runs locally. Piper's default runtime
files are loaded from CDNs, so a cached model alone does not guarantee offline
startup. ONNX Runtime is pinned to match Piper's default WASM version.

### Continuous listening and wake words

In **Chatbot Settings**, set **Wake word or phrase** (default: **ReactOS**) and
turn on **Continuous listening**. Start an utterance with the wake word, for
example, “ReactOS, explain this project.” Matching ignores case, accepts a phrase,
and requires whole words at the start; mid-sentence mentions do not activate it.
The wake word is removed and the message is appended to the editable prompt for
review. It is never sent automatically.

You can also say just the wake word, pause, then speak your message within eight
seconds. After the message or timeout, recognition waits for the wake word again.
Continuous listening restarts after normal recognition endings and pauses during
response generation or speech playback, while the chatbot is inactive or the
desktop is locked, and while the browser tab is hidden. Microphone errors stop
listening and display a message; toggle it off and on to retry. Hold-to-speak and
its keyboard shortcut are disabled while continuous mode is enabled.

The wake phrase is saved with chatbot settings in SQLite. Continuous listening
starts off and must be enabled again when reopening the chatbot. It requires a
selected model, microphone permission, HTTPS or localhost, and a browser supporting
speech recognition. This uses the existing browser recognition engine for both
wake detection and dictation; audio may be sent to an online service even while
waiting for the wake word.

Voice mode and download consent stay in browser localStorage, independently of
server chat settings. Clearing browser storage resets the mode to Off and removes
cached models.

## Storage overview

| Data | Storage | Survives clearing browser storage? |
| --- | --- | --- |
| Chat sessions, messages, persona templates, memories and review metadata | Server SQLite | Yes, after a successful save |
| Ollama settings, wake phrase and interface font scale | Server SQLite, with a local browser copy | Yes; restored when Chatbot loads |
| Chat voice mode and Piper download consent | Browser localStorage | No |
| Downloaded Piper voice model | Browser origin private filesystem | No |
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
