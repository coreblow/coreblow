# Contributing to CoreBlow

Welcome! 🚀

## Quick Links

- **GitHub:** https://github.com/coreblow/coreblow
- **Vision:** [`VISION.md`](VISION.md)
- **Docs:** https://docs.coreblow.com

## Maintainers

- **Febrinanda** - Lead Developer
  - GitHub: [@febrinanda](https://github.com/febrinanda)

## How to Contribute

1. **Bugs & small fixes** → Open a PR!
2. **New features / architecture** → Start a [GitHub Discussion](https://github.com/coreblow/coreblow/discussions) or ask first
3. **Refactor-only PRs** → Don't open a PR. We are not accepting refactor-only changes unless a maintainer explicitly asks for them as part of a concrete fix.
4. **Test/CI-only PRs for known `main` failures** → Don't open a PR. The Maintainer team is already tracking those failures.
5. **Questions** → Open a GitHub Discussion

## Before You PR

- Test locally with your CoreBlow instance
- Run tests: `pnpm build && pnpm check && pnpm test`
- For extension/plugin changes, run the fast local lane first:
  - `pnpm test:extension <extension-name>`
  - `pnpm test:extension --list` to see valid extension ids
  - If you changed shared plugin or channel surfaces, run `pnpm test:contracts`
  - If you changed broader runtime behavior, still run the relevant wider lanes before asking for review
- Do not submit refactor-only PRs unless a maintainer explicitly requested that refactor for an active fix or deliverable.
- Do not submit test or CI-config fixes for failures already red on `main` CI. If a failure is already visible in the [main branch CI runs](https://github.com/coreblow/coreblow/actions), it's a known issue the Maintainer team is tracking.
- Ensure CI checks pass
- Keep PRs focused (one thing per PR; do not mix unrelated concerns)
- Describe what & why
- Reply to or resolve bot review conversations you addressed before asking for review again
- **Include screenshots** — one showing the problem/before, one showing the fix/after (for UI or visual changes)
- Use American English spelling and grammar in code, comments, docs, and UI strings
- Do not edit files covered by `CODEOWNERS` security ownership unless a listed owner explicitly asked for the change.

## Review Conversations Are Author-Owned

If a review bot leaves review conversations on your PR, you are expected to handle the follow-through:

- Resolve the conversation yourself once the code or explanation fully addresses the bot's concern
- Reply and leave it open only when you need maintainer or reviewer judgment
- Do not leave "fixed" bot review conversations for maintainers to clean up for you

This applies to both human-authored and AI-assisted PRs.

## Control UI Decorators

The Control UI uses Lit with **legacy** decorators (current Rollup parsing does not support
`accessor` fields required for standard decorators). When adding reactive fields, keep the
legacy style:

```ts
@state() foo = "bar";
@property({ type: Number }) count = 0;
```

The root `tsconfig.json` is configured for legacy decorators (`experimentalDecorators: true`)
with `useDefineForClassFields: false`. Avoid flipping these unless you are also updating the UI
build tooling to support standard decorators.

## AI/Vibe-Coded PRs Welcome! 🤖

Built with AI tools? **Awesome - just mark it!**

Please include in your PR:

- [ ] Mark as AI-assisted in the PR title or description
- [ ] Note the degree of testing (untested / lightly tested / fully tested)
- [ ] Include prompts or session logs if possible (super helpful!)
- [ ] Confirm you understand what the code does
- [ ] Resolve or reply to bot review conversations after you address them

AI PRs are first-class citizens here. We just want transparency so reviewers know what to look for.

## Current Focus & Roadmap 🗺

We are currently prioritizing:

- **Stability**: Fixing edge cases in channel connections.
- **UX**: Improving the onboarding wizard and error messages.
- **Skills**: For skill contributions, head to the CoreBlow Hub.
- **Performance**: Optimizing token usage and compaction logic.

Check the [GitHub Issues](https://github.com/coreblow/coreblow/issues) for "good first issue" labels!

## Becoming a Maintainer

We're selectively expanding the maintainer team.
If you're an experienced contributor who wants to help shape CoreBlow's direction — whether through code, docs, or community — we'd like to hear from you.

Being a maintainer is a responsibility, not an honorary title. We expect active, consistent involvement — triaging issues, reviewing PRs, and helping move the project forward.

Still interested? Email contributing@coreblow.com with:

- Links to your PRs on CoreBlow (if you don't have any, start there first)
- Links to open source projects you maintain or actively contribute to
- Your GitHub handles
- A brief intro: background, experience, and areas of interest
- Languages you speak and where you're based
- How much time you can realistically commit

We welcome people across all skill sets — engineering, documentation, community management, and more.
We review every application carefully and add maintainers slowly and deliberately.
Please allow a few weeks for a response.

## Report a Vulnerability

We take security reports seriously. Report vulnerabilities directly to the repository where the issue lives:

- **Core CLI and gateway** — [coreblow/coreblow](https://github.com/coreblow/coreblow)
- **macOS desktop app** — [coreblow/coreblow](https://github.com/coreblow/coreblow) (apps/macos)
- **iOS app** — [coreblow/coreblow](https://github.com/coreblow/coreblow) (apps/ios)
- **Android app** — [coreblow/coreblow](https://github.com/coreblow/coreblow) (apps/android)

For issues that don't fit a specific repo, or if you're unsure, email **security@coreblow.com** and we'll route it.

### Required in Reports

1. **Title**
2. **Severity Assessment**
3. **Impact**
4. **Affected Component**
5. **Technical Reproduction**
6. **Demonstrated Impact**
7. **Environment**
8. **Remediation Advice**

Reports without reproduction steps, demonstrated impact, and remediation advice will be deprioritized.
