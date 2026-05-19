# CoreChat

CoreBlow chat application.

CoreChat is the app-focused chat surface for CoreBlow. It follows the OpenClaw split where the chat app can carry UI, transport, and persistence choices without expanding the core runtime.

## Scope

- Model chat threads and messages.
- Keep app state separate from gateway internals.
- Provide a small base for future desktop, web, or local-first chat work.

## Development

```sh
go test ./...
```
