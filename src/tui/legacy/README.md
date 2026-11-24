# Legacy Terminal UI Engine (pre-Ink)

> **Status: Deprecated / Quarantined**

## Overview
This directory houses the legacy terminal UI engine built on `@mariozechner/pi-tui`.
The active, default CoreBlow Terminal UI is powered by React + Ink located under `src/tui/ink/`.

## Invocation Boundary
This legacy implementation is **reachable exclusively** when the operator passes the explicit legacy flag:
```bash
coreblow tui --legacy-tui
```

In default operation, `src/tui/tui.ts` routes directly to `runInkTui` and dynamically lazy-loads this legacy module only if explicitly requested, ensuring zero `@mariozechner/pi-tui` overhead in default sessions.

## Retirement Plan
- **CoreBlow v2.x:** Quarantined under `src/tui/legacy/`, dynamic import isolation.
- **CoreBlow v3.0:** Scheduled for complete removal alongside uninstallation of `@mariozechner/pi-tui: 0.70.2` dependency.
