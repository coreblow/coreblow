---
name: corehub
description: Use the CoreHub CLI to search, install, update, and publish agent skills from corehub.com. Use when you need to fetch new skills on the fly, sync installed skills to latest or a specific version, or publish new/updated skill folders with the npm-installed corehub CLI.
metadata:
  {
    "coreblow":
      {
        "requires": { "bins": ["corehub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "corehub",
              "bins": ["corehub"],
              "label": "Install CoreHub CLI (npm)",
            },
          ],
      },
  }
---

# CoreHub CLI

Install

```bash
npm i -g corehub
```

Auth (publish)

```bash
corehub login
corehub whoami
```

Search

```bash
corehub search "postgres backups"
```

Install

```bash
corehub install my-skill
corehub install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)

```bash
corehub update my-skill
corehub update my-skill --version 1.2.3
corehub update --all
corehub update my-skill --force
corehub update --all --no-input --force
```

List

```bash
corehub list
```

Publish

```bash
corehub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes

- Default registry: https://corehub.com (override with COREHUB_REGISTRY or --registry)
- Default workdir: cwd (falls back to CoreBlow workspace); install dir: ./skills (override with --workdir / --dir / COREHUB_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
