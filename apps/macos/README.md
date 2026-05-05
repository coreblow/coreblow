# CoreBlow macOS

Menu bar companion app for CoreBlow gateway. Provides:

- **Gateway Discovery** — Bonjour + Tailscale + wide-area DNS-SD
- **IPC** — Unix socket control channel
- **Canvas** — WKWebView-based UI panels
- **Voice Wake** — Speech recognition trigger system
- **Talk Mode** — Push-to-talk audio sessions
- **Node Mode** — Device capability exposure
- **Exec Approvals** — Command execution safety prompts
- **CLI** — `coreblow-mac` command-line tool

## Build

```bash
swift build
```

## Architecture

```
Sources/
├── CoreBlow/           # Main app (menu bar, settings, services)
├── CoreBlowIPC/        # IPC protocol types
├── CoreBlowDiscovery/  # Gateway discovery
├── CoreBlowMacCLI/     # CLI tool
└── CoreBlowProtocol/   # Gateway protocol models
```
