# Plugin Lab

Compatibility testbed for CoreBlow community plugins and plugin seams.

Plugin Lab is the CoreBlow counterpart to OpenClaw's plugin compatibility fixture. It exists outside the core runtime so community-facing plugin checks can evolve without turning `coreblow/coreblow` into a plugin source aggregator.

## Scope

- Validate plugin manifests.
- Host credential-free fixture plugins.
- Exercise public plugin SDK assumptions.
- Document compatibility expectations for community plugins.

## Development

```sh
npm test
```
