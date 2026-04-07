---
name: skill-creator
description: "Create new Ultra Skills from natural language — generates SKILL.md, validates format, registers with skill loader. SUPERIOR: auto-generates when/not-to-use sections, validates YAML, tests skill loading."
author: CoreBlow
category: development
user-invocable: true
---

# Ultra Skill Creator

Create new skills from natural language descriptions.

## When to Use

 "Create a skill for...", "Make a new Ultra Skill that...", "I need a skill to..."

## Workflow

1. User describes what the skill should do
2. Generate a `SKILL.md` with proper frontmatter
3. Create directory: `ultra-skills/{skill-name}/SKILL.md`
4. Validate YAML frontmatter parses correctly
5. Verify skill loads via SkillsManager

## Template

```markdown
---
name: {skill-name}
description: "{one-line description}"
author: CoreBlow
category: {development|productivity|media|utility|iot}
user-invocable: true
---

# Ultra {Skill Title}

{Description of what this skill does}

## When to Use

 **USE when:** {list of trigger phrases}

 **DON'T use when:** {list of exclusions}

## Commands

{bash commands or tool instructions}

## Guidelines

{best practices}
```

## Validation Checklist

- [ ] `name` is lowercase with hyphens
- [ ] `description` is a single line
- [ ] At least one "When to Use" example
- [ ] At least one command or instruction
- [ ] YAML frontmatter parses without errors
