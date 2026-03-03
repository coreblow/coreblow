/**
 * skills/loader.test.ts
 * Tests for parseFrontmatter and discoverSkills.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseFrontmatter, discoverSkills } from "./loader.js";

describe("parseFrontmatter", () => {
  it("parses simple key-value frontmatter", () => {
    const { metadata, body } = parseFrontmatter(`---
name: My Skill
description: Does things
---
# Body`);
    expect(metadata.name).toBe("My Skill");
    expect(metadata.description).toBe("Does things");
    expect(body).toBe("# Body");
  });

  it("parses boolean values", () => {
    const { metadata } = parseFrontmatter(`---
always: true
disabled: false
---`);
    expect(metadata.always).toBe(true);
    expect(metadata.disabled).toBe(false);
  });

  it("parses numeric values", () => {
    const { metadata } = parseFrontmatter(`---
priority: 42
---`);
    expect(metadata.priority).toBe(42);
  });

  it("parses inline lists", () => {
    const { metadata } = parseFrontmatter(`---
events: [message, reaction]
---`);
    expect(metadata.events).toEqual(["message", "reaction"]);
  });

  it("parses block lists", () => {
    const { metadata } = parseFrontmatter(`---
requires:
- node
- python
---`);
    expect(metadata.requires).toEqual(["node", "python"]);
  });

  it("returns empty metadata when no frontmatter", () => {
    const { metadata, body } = parseFrontmatter("# Just a heading");
    expect(metadata).toEqual({});
    expect(body).toBe("# Just a heading");
  });

  it("handles missing closing delimiter", () => {
    const { metadata } = parseFrontmatter("---\nname: broken");
    expect(metadata).toEqual({});
  });

  it("strips quotes from string values", () => {
    const { metadata } = parseFrontmatter(`---
name: 'quoted'
emoji: "🎯"
---`);
    expect(metadata.name).toBe("quoted");
    expect(metadata.emoji).toBe("🎯");
  });
});

describe("discoverSkills", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-skills-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers skills from directories with SKILL.md", () => {
    const skillDir = path.join(tmpDir, "my-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---
name: My Skill
description: Test skill
---
Do the thing.`);
    const skills = discoverSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("my-skill");
    expect(skills[0].metadata.name).toBe("My Skill");
    expect(skills[0].instructions).toBe("Do the thing.");
    expect(skills[0].source).toBe("workspace");
  });

  it("skips directories without SKILL.md", () => {
    fs.mkdirSync(path.join(tmpDir, "no-skill"));
    expect(discoverSkills(tmpDir)).toHaveLength(0);
  });

  it("skips hidden directories", () => {
    const hidden = path.join(tmpDir, ".hidden-skill");
    fs.mkdirSync(hidden);
    fs.writeFileSync(path.join(hidden, "SKILL.md"), "---\nname: Hidden\n---");
    expect(discoverSkills(tmpDir)).toHaveLength(0);
  });

  it("uses provided source tag", () => {
    const skillDir = path.join(tmpDir, "bundled-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: Bundled\n---");
    const skills = discoverSkills(tmpDir, "bundled");
    expect(skills[0].source).toBe("bundled");
  });

  it("returns empty for nonexistent directory", () => {
    expect(discoverSkills("/nonexistent/path")).toHaveLength(0);
  });
});
