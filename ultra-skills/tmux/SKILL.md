---
name: tmux
description: "Terminal multiplexer control — create, split, resize, navigate panes/windows. SUPERIOR: preset layouts, session save/restore, auto-naming."
author: CoreBlow
category: development
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Tmux

Terminal multiplexer management.

## When to Use

 "Split my terminal", "Create a new tmux session", "Show all sessions", "Run this in background"

## Commands

### Sessions
```bash
# New named session
tmux new-session -d -s dev

# List sessions
tmux list-sessions

# Attach to session
tmux attach -t dev

# Kill session
tmux kill-session -t dev
```

### Windows & Panes
```bash
# New window
tmux new-window -t dev -n "server"

# Split horizontally
tmux split-window -h

# Split vertically
tmux split-window -v

# Navigate panes
tmux select-pane -L # left
tmux select-pane -R # right
```

### Preset Layouts (SUPERIOR)
```bash
# Dev layout: editor + terminal + logs
tmux new-session -d -s dev \; split-window -h -p 40 \; split-window -v -p 50

# Monitoring layout: 4 quadrants
tmux new-session -d -s monitor \; split-window -h \; split-window -v \; select-pane -L \; split-window -v

# Send command to specific pane
tmux send-keys -t dev:0.1 "npm run dev" Enter
```

### Session Save/Restore (SUPERIOR)
```bash
# Capture pane contents
tmux capture-pane -p -t dev:0.0

# List all windows and panes
tmux list-windows -a -F "#{session_name}:#{window_index} #{window_name}"
```
