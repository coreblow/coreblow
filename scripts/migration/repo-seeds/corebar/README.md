# CoreBar

Menu bar control plane for local-first CoreBlow apps.

CoreBar is the desktop control surface for CoreBlow operators. It stays outside the core runtime so native menu bar behavior, local process status, and operator commands can evolve without adding desktop-specific coupling to `coreblow/coreblow`.

## Scope

- Model local CoreBlow service status.
- Define safe operator actions for desktop launchers.
- Keep menu bar state small, typed, and testable.
- Integrate with CoreBlow as a client of the gateway and CLI surfaces.

## Development

```sh
swift test
```
