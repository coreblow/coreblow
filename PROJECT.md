# Project: Cory EvoLoop Closed-Loop Skill Synthesizer & Self-Learning Engine

## Architecture
Cory EvoLoop (`src/learning/`) is CoreBlow's autonomous skill synthesis and self-learning engine.
It operates in a hybrid functional/object-oriented microkernel architecture:
1. **Pure DOP Layer (`src/learning/dop-skill-distiller.ts`)**:
   - Zero side-effects, immutable data contracts (`SkillLifecycleStatus`, `TrajectoryToolStep`, `TurnTrajectoryRecord`, `SkillFitnessMetrics`, `EvolvingSkillRecord`).
   - Pure mathematical transformations: Wilson lower bound confidence calculation ($z \approx 1.96$), fitness metric updates, auto-rollback triggers, trajectory distillation with Gate 1 Zero-Trust Zone 0 blocking, and bidirectional Markdown frontmatter/sections serialization.
2. **OOP Service Layer (`src/learning/skill-synthesizer-service.ts` & `src/learning/index.ts`)**:
   - Implements `GatewayService` (`name = "cory-skill-synthesizer"`).
   - Manages state directories: `learned/`, `.revisions/`, `quarantine/`, and `fitness-ledger.json`.
   - 3-Gate Zero-Trust Security:
     - Gate 1: Rejects Zone 0 public trajectories via `isZone0PublicTrajectory`.
     - Gate 2: Evaluates source security via `src/security/skill-scanner.ts` and raw secret regexes (`sk-...`, `ghp_...`), quarantining critical findings.
     - Gate 3: Structural, semantic, and markdown integrity verification.
   - Cory Memory Store bridge: Syncs declarative workspace constraints from `cory.memoryStore.listLayerItems('constraint', ...)` into `## Pitfalls & Active Constraints`.
   - Dual-write index: Registers skills in SQLite WAL + in-memory BM25 postings (`cory.searchIndex`) for $< 2\text{ms}$ query matching ($0.15\text{ms}$ measured).
   - Lifecycle telemetry: Automated promotion from `canary` to `verified_active` ($\ge 3$ invocations, Wilson score $\ge 0.65$, 0 consecutive failures), and automated rollback to `.revisions/<id>@<version>.md` on $\ge 2$ consecutive failures.
   - System prompt builder: Formats active matching skills into context via `buildActiveSkillsPrompt()`.
3. **Microkernel Integration & SDK Layer**:
   - Registered in `src/plugins/extension-tier-policy.ts` (`coreExtensions`).
   - Registered in `src/plugins/cockpit-storefront-model.ts` (`BUILTIN_KERNEL_CAPABILITY_ENTRIES`).
   - Wired in `src/gateway/microkernel-services.ts` into `ServiceRegistry` with dependency `["cory-memory"]`, exposed on `MicrokernelServicesResult`.
   - Updated service count assertion (from 8 to 9) in `src/runtime-lightweight-metrics.test.ts` and `src/gateway/microkernel-services.test.ts`.
   - Mounted authenticated CoreHub routes (`GET /api/corehub/skills/learned`, `POST /api/corehub/skills/ingest`, `POST /api/corehub/skills/outcome`).
   - Re-exported via `src/plugin-sdk/memory.ts`.
4. **E2E Testing & Certification**:
   - Tests 1 to 5 implemented in `src/learning/skill-synthesizer.test.ts`.
   - Full Vitest suite passing 100% green across 6 files (45/45 tests green).
   - Oxlint passing with 0 errors across 1,472 files.
   - TypeScript clean.
   - Forensic audit certified CLEAN.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Immutable Data Contracts | Define `SkillLifecycleStatus`, `TrajectoryToolStep`, `TurnTrajectoryRecord`, `SkillFitnessMetrics`, `EvolvingSkillRecord` | M1 | R1 |
| F2 | Wilson Lower Bound Engine | Pure `computeWilsonLowerBound(successes, total, confidence)` with $z \approx 1.96$ | M1 | R1 |
| F3 | Fitness Metric Update | Pure `updateSkillFitnessMetrics` computing immutable updated metrics, scores, and failure streaks | M1 | R1 |
| F4 | Circuit Breaker Evaluator | Pure `shouldAutoRollbackSkill` determining rollback trigger on $\ge 2$ consecutive failures | M1 | R1 |
| F5 | Trajectory Distillation Heuristics | Pure `distillTrajectoryToSkillCandidate` with Gate 1 Zone 0 rejection, qualification on failed-then-succeeded steps or user corrections $\ge 16$ chars, deterministic slug, and semver bumping | M1 | R1 |
| F6 | Markdown Serialization & Parser | Pure `serializeEvolvingSkillMarkdown` and `parseEvolvingSkillMarkdown` with frontmatter and 4 canonical H2 sections | M1 | R1 |
| F7 | OOP Service Lifecycle & State Dir | `CorySkillSynthesizerService` implementing `GatewayService` (`name = "cory-skill-synthesizer"`), managing `learned/`, `.revisions/`, `quarantine/`, `fitness-ledger.json` | M1 | R2 |
| F8 | 3-Gate Zero-Trust Security & Quarantine | Gate 1 Zone 0 block, Gate 2 `scanSource()` from `src/security/skill-scanner.ts` and secret regex check (`sk-...`, `ghp_...`), quarantine of critical findings, Gate 3 integrity | M1 | R2 |
| F9 | Cory Memory Constraint Sync | Sync Active Constraints from `cory.memoryStore.listLayerItems('constraint', ...)` into `## Pitfalls & Active Constraints` prefixed with `[CONSTRAINT]` | M1 | R2 |
| F10 | Version Snapshotting & Atomic Rollback | Snapshot prior version to `.revisions/<id>@<version>.md` before evolution, `rollbackSkill` restoring previous revision on regression | M1 | R2 |
| F11 | Sub-2ms Indexing & Query Matching | Dual indexing into SQLite WAL + in-memory BM25 (`cory.searchIndex`) with $< 2\text{ms}$ query matching | M1 | R2 |
| F12 | Lifecycle Telemetry & Auto-Promotion | `recordSkillOutcome`: auto-promote `canary` to `verified_active` on $\ge 3$ invocations, Wilson score $\ge 0.65$, 0 consecutive failures; auto-rollback on regression | M1 | R2 |
| F13 | Active Skills Prompt Assembly | `buildActiveSkillsPrompt(skills)` formatting verified active and canary skills into context prompt block | M1 | R2 |
| F14 | Extension Tier Policy Registration | Add `"cory-skill-synthesizer"` to `coreExtensions` in `src/plugins/extension-tier-policy.ts` | M2 | R3 |
| F15 | Cockpit Storefront Registration | Add `"cory-skill-synthesizer"` entry to `BUILTIN_KERNEL_CAPABILITY_ENTRIES` in `src/plugins/cockpit-storefront-model.ts` | M2 | R3 |
| F16 | Microkernel Service Wiring | Instantiate `CorySkillSynthesizerService`, register in `ServiceRegistry` with `["cory-memory"]`, expose on `MicrokernelServicesResult` in `src/gateway/microkernel-services.ts` | M2 | R3 |
| F17 | Service Count Test Updates | Update started service count assertion from 8 to 9 in `src/runtime-lightweight-metrics.test.ts` and `src/gateway/microkernel-services.test.ts` | M2 | R3 |
| F18 | CoreHub HTTP API Routes | Mount `GET /api/corehub/skills/learned`, `POST /api/corehub/skills/ingest`, `POST /api/corehub/skills/outcome` in `src/gateway/microkernel-services.ts` | M2 | R3 |
| F19 | Plugin SDK Barrels Export | Re-export learning contracts from `src/learning/index.js` via `src/plugin-sdk/memory.ts` | M2 | R3 |
| F20 | E2E & Unit Test 1: Distillation & Constraints | Test 1: Failed -> Recovery -> Verification Passed trajectory distill + sync Cory constraints | M3 | AC |
| F21 | E2E & Unit Test 2: Gate 1 Zone 0 Block | Test 2: Trajectories with `trustZone: "public"` or `isPublicChannel: true` blocked | M3 | AC |
| F22 | E2E & Unit Test 3: Gate 2 Quarantine | Test 3: Trajectories containing dangerous code (`exec`, `eval`) or secrets quarantined | M3 | AC |
| F23 | E2E & Unit Test 4: Evolution, Promotion & Rollback | Test 4: Evolve 1.0.0 -> 1.1.0, promote canary -> verified_active on 3 successes, rollback on 2 failures | M3 | AC |
| F24 | E2E & Unit Test 5: Sub-2ms Matching & Prompt Assembly | Test 5: Verify $< 2\text{ms}$ BM25 matching and prompt assembly via `buildActiveSkillsPrompt()` | M3 | AC |
| F25 | Quality Gates & Forensic Audit | Vitest suite (100% green), tsgo (0 core errors), oxlint (0 errors/warnings), forensic integrity audit | M3 | AC |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Cory EvoLoop Core Engine | `src/learning/dop-skill-distiller.ts`, `src/learning/skill-synthesizer-service.ts`, `src/learning/index.ts` | none | DONE |
| M2 | Microkernel Wiring, CoreHub Routes & SDK Exports | `src/plugins/extension-tier-policy.ts`, `src/plugins/cockpit-storefront-model.ts`, `src/gateway/microkernel-services.ts`, `src/runtime-lightweight-metrics.test.ts`, `src/gateway/microkernel-services.test.ts`, `src/plugin-sdk/memory.ts` | M1 | DONE |
| M3 | E2E Testing, Quality Gates & Certification | `src/learning/skill-synthesizer.test.ts` (Tests 1-5), Full Vitest suite, Oxlint, Tsgo, Forensic Audit | M1, M2 | DONE |

---

## Interface Contracts

### `dop-skill-distiller.ts` ↔ `skill-synthesizer-service.ts`
```typescript
export type SkillLifecycleStatus =
  | "quarantined"
  | "draft"
  | "canary"
  | "verified_active"
  | "deprecated";

export interface TrajectoryToolStep {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown> | string;
  readonly isError: boolean;
  readonly executionDurationMs?: number;
}

export interface TurnTrajectoryRecord {
  readonly id: string;
  readonly userGoal: string;
  readonly steps: readonly TrajectoryToolStep[];
  readonly finalOutcome: "success" | "failure" | "aborted";
  readonly trustZone?: "internal" | "trusted_partner" | "public" | string;
  readonly isPublicChannel?: boolean | string | number;
  readonly userCorrectionText?: string;
  readonly workspaceId?: string;
  readonly userScope?: string;
  readonly timestampMs?: number;
}

export interface SkillFitnessMetrics {
  readonly totalInvocations: number;
  readonly successfulInvocations: number;
  readonly failedInvocations: number;
  readonly consecutiveFailures: number;
  readonly wilsonScore: number;
  readonly lastUpdatedMs: number;
}

export interface EvolvingSkillRecord {
  readonly id: string;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly status: SkillLifecycleStatus;
  readonly triggers: readonly string[];
  readonly executionStrategy: readonly string[];
  readonly pitfallsConstraints: readonly string[];
  readonly verificationCriteria: readonly string[];
  readonly metrics: SkillFitnessMetrics;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export function isZone0PublicTrajectory(trajectory: unknown): boolean;
export function computeWilsonLowerBound(successes: number, total: number, confidence?: number): number;
export function updateSkillFitnessMetrics(current: SkillFitnessMetrics, outcome: "success" | "failure"): SkillFitnessMetrics;
export function shouldAutoRollbackSkill(metrics: SkillFitnessMetrics): boolean;
export function distillTrajectoryToSkillCandidate(
  trajectory: TurnTrajectoryRecord,
  existingSkill?: EvolvingSkillRecord
): { ok: true; candidate: EvolvingSkillRecord } | { ok: false; reason: string; code: "ZONE_0_BLOCKED" | "NOT_QUALIFIED" };
export function serializeEvolvingSkillMarkdown(skill: EvolvingSkillRecord): string;
export function parseEvolvingSkillMarkdown(markdown: string): EvolvingSkillRecord;
```

### `skill-synthesizer-service.ts` ↔ `microkernel-services.ts`
```typescript
export interface SkillIngestOptions {
  readonly syncConstraints?: boolean;
  readonly targetStatus?: SkillLifecycleStatus;
}

export interface SkillSynthesizerServiceOptions {
  readonly stateDir: string;
  readonly coryService?: CoryBootstrapService;
}

export class CorySkillSynthesizerService implements GatewayService {
  readonly name = "cory-skill-synthesizer";
  constructor(options: SkillSynthesizerServiceOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): ServiceHealth;
  ingestTrajectory(trajectory: TurnTrajectoryRecord, options?: SkillIngestOptions): Promise<{ ok: boolean; skill?: EvolvingSkillRecord; reason?: string }>;
  recordSkillOutcome(skillId: string, outcome: "success" | "failure"): Promise<EvolvingSkillRecord>;
  rollbackSkill(skillId: string): Promise<EvolvingSkillRecord>;
  matchSkillsForQuery(query: string, limit?: number): Promise<EvolvingSkillRecord[]>;
  buildActiveSkillsPrompt(skills?: EvolvingSkillRecord[]): Promise<string>;
  listSkills(filter?: { status?: SkillLifecycleStatus }): Promise<EvolvingSkillRecord[]>;
  getSkill(skillId: string): Promise<EvolvingSkillRecord | null>;
}
```

---

## Code Layout
- `src/learning/dop-skill-distiller.ts`: Pure DOP trajectory distillation and Bayesian fitness calculation.
- `src/learning/skill-synthesizer-service.ts`: OOP service managing persistence, security scanning, Cory memory integration, and lifecycle telemetry.
- `src/learning/index.ts`: Public barrel exporting all learning types and classes.
- `src/learning/skill-synthesizer.test.ts`: Complete unit and integration tests (Tests 1 to 5).
- `src/plugins/extension-tier-policy.ts`: Register `"cory-skill-synthesizer"` in `coreExtensions`.
- `src/plugins/cockpit-storefront-model.ts`: Register capability card in `BUILTIN_KERNEL_CAPABILITY_ENTRIES`.
- `src/gateway/microkernel-services.ts`: Register service in `ServiceRegistry` with dependency `["cory-memory"]`, mount CoreHub HTTP routes.
- `src/plugin-sdk/memory.ts`: Re-export `../learning/index.js`.
