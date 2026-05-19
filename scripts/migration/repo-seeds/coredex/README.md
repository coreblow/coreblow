# CoreDex

CoreBlow contacts and identity surface.

CoreDex is the contacts and identity companion for CoreBlow. It is split from the main runtime so identity indexing and contact lookup can evolve as an app surface without becoming gateway code.

## Scope

- Normalize contact records.
- Provide contact lookup primitives for CoreBlow apps.
- Keep identity data handling auditable and explicit.

## Development

```sh
go test ./...
```
