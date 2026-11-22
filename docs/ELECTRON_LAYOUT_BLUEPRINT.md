# Electron Desktop Shell & Layout Ergonomics Blueprint

This document defines the structural architecture, window geometry, and UI ergonomics for the **CoreBlow Studio Desktop** shell (`apps/desktop/`). It establishes a unified, high-performance desktop client adhering to our **Quiet Instrument** design system, wired to the CoreBlow Single-Brain Gateway daemon (`127.0.0.1:18789`).

---

## 1. Native Window Configuration (`BrowserWindow`)

### 1.1 Dimensions & Constraints
- **Default Window Size:** 1280px width × 820px height
- **Minimum Window Constraints:** 520px minWidth × 600px minHeight
- **Window Centering:** Positioned centrally on launch with state persistence across restarts.

### 1.2 Platform-Specific Window Shell (macOS)
- **Titlebar Style:** `titleBarStyle: 'hiddenInset'`
- **Traffic Light Controls:** Positioned at `{ x: 16, y: 16 }` for consistent native inset.
- **Window Vibrancy:** `vibrancy: 'sidebar'`, `visualEffectState: 'active'`
- **Canvas Fill:** Transparent root canvas (`#00000000`) allowing native macOS backdrop vibrancy, layered with Quiet Instrument opaque palette fills (`#08110F` base canvas, `#09130F` sidebar).
- **Window Dragging Regions:**
  - Standard draggable strip marked with `-webkit-app-region: drag` (`[data-window-drag]`).
  - Strict exclusions for interactive controls (`button`, `input`, `select`, `textarea`, `a`, and `[data-window-drag-exclude]`) marked with `-webkit-app-region: no-drag`.

### 1.3 Security & Sandbox Boundaries
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- Native link handling: External `http:` and `https:` URLs opened securely via `shell.openExternal(url)`.

---

## 2. 3-Pane Adaptive Layout Geometry

The desktop canvas utilizes an adaptive 3-pane layout designed for low cognitive load and clear tool observability.

```
+-----------------------------------------------------------------------------------------------------+
| Traffic Lights (16px) | Topbar: Active Project & Git Branch Pill (⌘O)                 | Inspector (⌘I)|
+-----------------------+---------------------------------------------------------------+-------------+
| Left Sidebar          | Center Canvas                                                 | Right       |
|                       |                                                               | Inspector   |
| • New Chat (⌘N)       | • Conversation Stream (SSE)                                   | Drawer      |
| • Search chats...     | • Tool Execution Step Cards                                   |             |
| • Thread History (×)  | • Markdown & Code Blocks with Syntax Highlighting & Copy      | • Git &     |
|                       |                                                               |   5-Gates   |
|                       |---------------------------------------------------------------| • War Room  |
|                       | Floating Composer (Card Max Width: 768px, Side Pad: 32px)     | • Memory    |
| • Settings (⌘,)       | [ + Attach | Project Pill | Permission: Guarded ▾ ] [Tier ▾ | ■] |   Wiki      |
+-----------------------------------------------------------------------------------------------------+
```

### 2.1 Left Sidebar (Navigation & Sessions)
- **Width Bounds:**
  - Default expanded width: **280px**
  - Resizable range: **264px** min to **420px** max
  - Collapsed icon rail: **56px** fixed width
- **Responsive Breakpoints:**
  - Viewports below **1024px**: Auto-collapses to 56px rail.
  - Viewports below **768px**: Transforms to an overlay drawer over the center canvas.
- **Top Clearance:**
  - Height: **48px** top clearance matching native macOS traffic light controls.
- **Controls & Elements:**
  - New Session button (`⌘N`), quick session search input filter, categorized thread history list with hover deletion (`×`), and bottom profile / settings trigger row (`⌘,`).

### 2.2 Center Canvas (Conversation & Execution Engine)
- **Protected Minimum Width:** **400px**
- **Unified Header / Topbar:**
  - Height: **48px**
  - Left inset: Accommodates traffic lights and sidebar toggle (160px clearance when sidebar is collapsed).
  - Center/Leading: Active Project directory pill and Git branch indicator (`⌘O`).
  - Right: Quick action buttons and Right Inspector toggle (`⌘I`).
- **Conversation Stream:**
  - Virtualized scroll container with turn spacers.
  - User prompt bubbles and Assistant turns with real-time SSE streaming.
  - Markdown typography rendering with GFM tables, alerts, and inline code formatting.
  - Syntactically highlighted code blocks with header language tag, line numbers, and single-click **Copy** feedback.
  - Durable **Execution Step Cards** displaying active tools, inputs, duration, status indicators (idle, active, done, warning, error), and expandable raw outputs.

### 2.3 Floating Composer (2-Tier Input Card)
- **Positioning:** Fixed dock floating above the bottom edge with 32px side clearance and 8px-12px bottom clearance.
- **Max Width:** **768px** (centered within the center canvas).
- **Structure:**
  - **Upper Input Tier:** Auto-growing textarea/contenteditable with smooth height expansion (min-height: 36px, max-height: 240px with inner scroll). Font size 14px, line-height 24px, clean placeholder.
  - **Lower Toolbar Tier:** Height 36px, horizontal flex row:
    - *Left Controls:* Circular `+` attachment button (28px circle), workspace/branch indicator chip, 4-mode permission preset dropdown (`Full access`, `Workspace`, `Guarded`, `Read-only`).
    - *Right Controls:* Model tier selector (`Fast`, `Balanced`, `High Reasoning`), and primary Send/Stop button (34px circular button with smooth transition between send arrow and stop square).

### 2.4 Right Inspector Drawer (`⌘I`)
- **Width Bounds:**
  - Default width ratio: **45%** of frame width (minimum **300px**, maximum **70%**).
- **Slide Animation:** Smooth CSS transform transition sliding off the right edge when collapsed.
- **Tabs & Capabilities:**
  1. **Git & 5-Gates:** Working tree status, staged/unstaged file changes, branch selector, and live 5-Gate verification checks (check, test, build, format, types).
  2. **War Room:** Active subagents, multi-agent coordination feeds, and gateway node mesh status.
  3. **Memory Wiki:** Real-time semantic memory layer lookup (`GET /api/cory/layers`) and vector search queries (`GET /api/cory/search`).
  4. **Integrated Terminal & Diff:** Live process execution logs and unified diff comparison drawer.

---

## 3. Quiet Instrument Settings Modal (`⌘,`)

### 3.1 Dimensions & Modal Overlay
- **Dimensions:** 800px width × min(800px, calc(100vh - 48px)) height.
- **Border Radius:** 16px (`var(--radius-panel)`).
- **Backdrop:** Full-viewport frosted overlay with `backdrop-filter: blur(12px)` and subtle dark wash (`rgba(0, 0, 0, 0.45)`).

### 3.2 2-Column Architecture
- **Left Navigation Rail (188px fixed):**
  - Header: Settings title (54px row height).
  - Navigation Item List: 36px row height with icons and active highlight state.
  - Sections:
    1. **General:** Theme, typography, telemetry, notifications.
    2. **API Keys & Models (`⌘K`):** Model provider configuration, API credentials, default routing.
    3. **Channels:** Telegram, Discord, Slack, WhatsApp, Signal, iMessage integration.
    4. **Remote Nodes:** Multi-node orchestration, SSH pairing, gateway discovery.
    5. **Automations & Cron:** Scheduled background jobs, event hooks.
    6. **Permissions:** Default execution boundary presets (Full, Workspace, Guarded, Read-only).
    7. **Skills:** CoreHub skill registry, learned capabilities, tool extensions.
    8. **About:** Version `v2.1.1`, release notes, license, documentation links.
- **Right Content Panel (1fr scrollable):**
  - Section header matching the 54px top row.
  - Interactive configuration cards with immediate persistence to Gateway state.

---

## 4. Single-Brain Gateway Communication Pipeline

The desktop shell maintains a 100% Single-Brain thin client architecture with zero local duplicate state machines:

| Action / Capability | Endpoint | Protocol | Payload / Notes |
|---|---|---|---|
| **Chat Execution (ReAct)** | `POST /api/corehub/chat/react` | SSE (`text/event-stream`) | Real-time token streaming, tool call deltas, step cards |
| **Gateway Health** | `GET /health` | HTTP JSON | Auto-detection and auto-start daemon management |
| **Memory Wiki Layers** | `GET /api/cory/layers` | HTTP JSON | Cognitive memory inspection |
| **Memory Search** | `GET /api/cory/search?q={query}` | HTTP JSON | Vector / keyword memory recall |
| **CoreHub Storefront** | `GET /api/corehub/storefront` | HTTP JSON | Browse and install agent skills |
| **Learned Skills** | `GET /api/corehub/skills/learned` | HTTP JSON | Dynamic skills acquired during runtime |
| **Native FS & Dialogs** | Electron IPC | `contextBridge` | Folder picker (`dialog.showOpenDialog`), file read, clipboard |
