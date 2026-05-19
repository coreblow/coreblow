# CoreHub

Skill and plugin directory for CoreBlow.

CoreHub is the public catalog surface for CoreBlow ecosystem entries. It is intentionally separate from `coreblow/coreblow`: the core repository owns bundled plugin source, while CoreHub owns discovery metadata, review state, and publishing checks.

## Scope

- Curated CoreBlow skills.
- Public plugin listings.
- Compatibility metadata for CoreBlow releases.
- Directory validation tooling.

CoreHub is not a plugin source aggregator. Bundled plugin source remains in `coreblow/coreblow` under `extensions/*`.

## Development

```sh
npm test
```

The initial seed keeps the directory format small and auditable. Add new fields through `src/catalog.mjs` validators first, then update entries.
