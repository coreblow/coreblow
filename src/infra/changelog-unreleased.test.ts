import { describe, expect, it } from "vitest";
import { appendUnreleasedChangelogEntry } from "./changelog-unreleased.js";

const baseChangelog = `# Changelog

## Unreleased

### Breaking

- Existing breaking entry.

### Changes

- Existing change.

### Fixes

- Existing fix.

## 2026.4.5
`;

describe("appendUnreleasedChangelogEntry", () => {
  it("appends to the end of the requested unreleased section", () => {
    const next = appendUnreleasedChangelogEntry(baseChangelog, {
      section: "Fixes",
      entry: "New fix entry.",
    });

    expect(next).toContain(`### Fixes

- Existing fix.
- New fix entry.`);
  });

  it("avoids duplicating an existing entry", () => {
    expect(
      appendUnreleasedChangelogEntry(baseChangelog, {
        section: "Changes",
        entry: "- Existing change.",
      }),
    ).toBe(baseChangelog);
  });
});
