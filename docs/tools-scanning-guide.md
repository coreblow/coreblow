# CoreBlow Tools & Scanning — Usage Guide

> Complete guide for using CoreBlow's tool infrastructure and scanning systems.

---

## Table of Contents

1. [Tool Registry & Executor](#1-tool-registry--executor)
2. [Builtin Tools](#2-builtin-tools)
3. [Workflow Engine](#3-workflow-engine)
4. [Security Scanning](#4-security-scanning)
   - [Skill Scanner](#41-skill-scanner)
   - [PII Scanner](#42-pii-scanner)
   - [Toxicity Detector](#43-toxicity-detector)
   - [Bias Detector](#44-bias-detector)
   - [Content Filter](#45-content-filter)
5. [Guardrails Engine](#5-guardrails-engine-unified-pipeline)
6. [Model Scanning](#6-model-scanning)
7. [Status Scanning](#7-status-scanning)

---

## 1. Tool Registry & Executor

The `ToolRegistry` manages agent tools, and `ToolExecutor` handles execution with timeout, retry, and concurrency.

### Register a Custom Tool

```typescript
import { ToolRegistry, type ToolDefinition } from './tools/tool-registry.js';
import { ToolExecutor } from './tools/tool-executor.js';

// Create registry
const registry = new ToolRegistry();

// Define a custom tool
const weatherTool: ToolDefinition = {
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
        type: 'object',
        properties: {
            city: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        },
        required: ['city'],
    },
    handler: async (args) => {
        const city = args.city as string;
        // Your logic here
        return JSON.stringify({ city, temp: 22, unit: 'celsius' });
    },
    permission: 'public',
    category: 'utilities',
    enabled: true,
};

// Register
registry.register(weatherTool);

// Register multiple at once
registry.registerMany([weatherTool, anotherTool]);
```

### Execute Tools

```typescript
// Create executor with options
const executor = new ToolExecutor(registry, {
    timeoutMs: 10_000,     // 10 second timeout per tool
    maxRetries: 2,         // retry up to 2 times on failure
    maxConcurrent: 5,      // max 5 concurrent tool calls
});

// Execute a single tool
const result = await executor.execute('get_weather', { city: 'Jakarta' }, 'call-001');
console.log(result);
// {
//     toolName: 'get_weather',
//     callId: 'call-001',
//     success: true,
//     output: '{"city":"Jakarta","temp":22,"unit":"celsius"}',
//     durationMs: 45,
//     timestamp: 1714034000000
// }

// Execute multiple tools in parallel
const results = await executor.executeMany([
    { toolName: 'get_weather', args: { city: 'Jakarta' }, callId: 'call-001' },
    { toolName: 'get_weather', args: { city: 'Tokyo' }, callId: 'call-002' },
]);
```

### Export to OpenAI Format

```typescript
// Get tools as OpenAI-compatible function definitions
const openaiTools = registry.toOpenAI();
// [{ type: 'function', function: { name: 'get_weather', description: '...', parameters: {...} } }]

// Filter by permission
const publicTools = registry.toOpenAI('public');
const adminTools = registry.toOpenAI('admin');

// List by category
const categories = registry.listByCategory();
// { utilities: ['get_weather'], general: ['other_tool'] }
```

### Monitor Execution Stats

```typescript
const stats = executor.getStats();
// { totalCalls: 42, successRate: 0.95, avgDurationMs: 120, activeCalls: 2 }

const history = executor.getHistory(10); // last 10 executions
```

---

## 2. Builtin Tools

CoreBlow ships with 4 builtin agent tools in `src/tools/builtin/`:

| Tool | File | Purpose |
|------|------|---------|
| **Apply Patch** | `builtin/apply-patch.ts` | Apply code diffs/patches to files |
| **Browser** | `builtin/browser.ts` | Web browsing capability for agents |
| **Calculator** | `builtin/calculator.ts` | Mathematical expression evaluation |
| **Message** | `builtin/message.ts` | Message formatting and templating |

These are registered automatically when the agent system initializes.

---

## 3. Workflow Engine

Multi-step workflow orchestration with sequential, parallel, and conditional execution.

```typescript
import { WorkflowEngine, type WorkflowDefinition } from './tools/workflow-engine.js';

const engine = new WorkflowEngine();

// Define a workflow
const analyzeWorkflow: WorkflowDefinition = {
    id: 'code-review',
    name: 'Code Review Pipeline',
    steps: [
        {
            id: 'lint',
            name: 'Run Linter',
            handler: async (ctx) => {
                // Run linting
                return { errors: 0, warnings: 2 };
            },
            onError: 'skip',    // continue if linting fails
            timeoutMs: 30_000,
        },
        {
            id: 'test',
            name: 'Run Tests',
            handler: async (ctx) => {
                const lintResult = ctx.results['lint']; // access previous step result
                return { passed: 42, failed: 0 };
            },
            onError: 'fail',    // stop workflow on failure
            timeoutMs: 60_000,
        },
        {
            id: 'security-scan',
            name: 'Security Scan',
            handler: async (ctx) => {
                return { vulnerabilities: 0 };
            },
            condition: (ctx) => {
                // Only run if tests passed
                const testResult = ctx.results['test'] as any;
                return testResult?.failed === 0;
            },
        },
        {
            id: 'notify',
            name: 'Send Notification',
            handler: async (ctx) => {
                return { sent: true };
            },
            onError: 'retry',   // retry on failure
            retries: 3,
        },
    ],
    // Run lint and test in parallel
    parallelSteps: [['lint', 'test']],
};

// Register and execute
engine.register(analyzeWorkflow);
const result = await engine.execute('code-review', { repo: 'coreblow' });

console.log(result.status);      // 'completed' | 'failed' | 'partial'
console.log(result.steps);       // individual step results
console.log(result.totalDurationMs);
```

---

## 4. Security Scanning

### 4.1 Skill Scanner

Scans JS/TS source code for dangerous patterns (exec, eval, crypto mining, data exfiltration).

```typescript
import {
    scanSource,
    scanDirectory,
    scanDirectoryWithSummary,
} from './security/skill-scanner.js';

// Scan a single source string
const findings = scanSource(`
    const { exec } = require('child_process');
    exec('rm -rf /');
`, 'suspicious-file.ts');

console.log(findings);
// [{
//     ruleId: 'dangerous-exec',
//     severity: 'critical',
//     file: 'suspicious-file.ts',
//     line: 2,
//     message: 'Shell command execution detected (child_process)',
//     evidence: "const { exec } = require('child_process');"
// }]

// Scan an entire directory
const dirFindings = await scanDirectory('/path/to/plugin', {
    maxFiles: 500,            // max files to scan
    maxFileBytes: 1_048_576,  // skip files > 1MB
});

// Scan with summary (used by skills-install)
const summary = await scanDirectoryWithSummary('/path/to/skill');
console.log(summary);
// {
//     scannedFiles: 42,
//     critical: 1,
//     warn: 3,
//     info: 0,
//     findings: [...]
// }

if (summary.critical > 0) {
    console.error('❌ Skill blocked: critical security findings!');
}
```

**Detection rules:**

| Rule | Severity | What it detects |
|------|----------|-----------------|
| `dangerous-exec` | 🔴 critical | `child_process` exec/spawn calls |
| `dynamic-code-execution` | 🔴 critical | `eval()`, `new Function()` |
| `crypto-mining` | 🔴 critical | Stratum, CoinHive, XMRig |
| `env-harvesting` | 🔴 critical | `process.env` + network send |
| `suspicious-network` | 🟡 warn | WebSocket to non-standard ports |
| `potential-exfiltration` | 🟡 warn | File read + network send |
| `obfuscated-code` | 🟡 warn | Hex sequences, large base64 |

### 4.2 PII Scanner

Detects and masks personally identifiable information.

```typescript
import { PIIScanner } from './security/pii-scanner.js';

const scanner = new PIIScanner();

// Scan text for PII
const result = scanner.scan(
    'Contact john.doe@gmail.com or call 555-123-4567. SSN: 123-45-6789'
);

console.log(result.hasPII);      // true
console.log(result.piiCount);    // 3
console.log(result.maskedText);
// 'Contact jo***@gmail.com or call 555***67. SSN: ***-**-****'

// Check each match
for (const match of result.matches) {
    console.log(`${match.type}: "${match.value}" → "${match.masked}"`);
}
// email: "john.doe@gmail.com" → "jo***@gmail.com"
// phone: "555-123-4567" → "555***67"
// ssn: "123-45-6789" → "***-**-****"

// Add custom pattern
scanner.addPattern('employee_id', /EMP-\d{6}/g, (v) => 'EMP-******');

// Stats
console.log(scanner.getStats()); // { scanned: 1, piiFound: 3 }
```

**Built-in PII types:**

| Type | Example | Masked |
|------|---------|--------|
| `email` | `john@gmail.com` | `jo***@gmail.com` |
| `phone` | `555-123-4567` | `555***67` |
| `ssn` | `123-45-6789` | `***-**-****` |
| `credit_card` | `4111-1111-1111-1234` | `****-****-****-1234` |
| `ip_address` | `192.168.1.100` | `192.168.1.***` |

### 4.3 Toxicity Detector

Multi-category toxicity detection with severity scoring.

```typescript
import { ToxicityDetector } from './security/toxicity-detector.js';

const detector = new ToxicityDetector({
    threshold: 0.5,        // detection threshold (0-1)
    contextAware: true,    // contextual scoring
    maxTextLength: 10000,
});

// Analyze text
const result = detector.analyze('You are an incompetent idiot!');

console.log(result.toxic);     // true
console.log(result.score);     // 0.75
console.log(result.severity);  // 'high'
console.log(result.explanation);
// 'Toxic content detected (high): insult'

// Category breakdown
for (const cat of result.categories) {
    console.log(`${cat.category}: ${cat.score} (${cat.severity})`);
    console.log(`  Matched: ${cat.matched.join(', ')}`);
}

// Quick check
if (detector.isToxic(userMessage)) {
    return 'Message blocked for toxic content';
}

// Batch scan
const batch = detector.analyzeBatch([msg1, msg2, msg3]);
console.log(batch.totalToxic);     // 1
console.log(batch.averageScore);   // 0.3
console.log(batch.worstCategory);  // 'insult'

// Configuration
detector.setThreshold(0.3);                       // stricter detection
detector.disableCategory('spam');                  // disable spam detection
detector.addCustomPattern('insult', /\bnoob\b/gi); // add custom pattern
detector.addToAllowlist('damn good');              // allow specific phrases

// Stats
console.log(detector.getStats());
// { scanned: 5, toxic: 2, toxicRate: 0.4, byCategory: { insult: 2 } }
```

**Detection categories:** `insult`, `threat`, `sexual`, `hate_speech`, `harassment`, `spam`, `violence`, `self_harm`, `dangerous_content`

### 4.4 Bias Detector

Bias detection with intersectional analysis and inclusive language checking.

```typescript
import { BiasDetector } from './security/bias-detector.js';

const detector = new BiasDetector({
    threshold: 0.4,
    checkBalance: true,
});

// Analyze text
const result = detector.analyze(
    'The chairman said mankind should hire more firemen.'
);

console.log(result.biased);        // true
console.log(result.overallScore);  // 0.5
console.log(result.severity);      // 'medium'
console.log(result.balanceScore);  // 0.0 (no inclusive terms found)
console.log(result.recommendation);
// 'Potential bias detected. Consider using gender-neutral language'

// See indicators
for (const ind of result.indicators) {
    console.log(`${ind.category}: ${ind.severity}`);
    console.log(`  Found: ${ind.indicators.join(', ')}`);
    console.log(`  Suggestion: ${ind.suggestion}`);
    console.log(`  Mitigated: ${ind.mitigated}`);
}

// Quick check
if (detector.isBiased(aiOutput)) {
    // Flag for human review
}

// Batch scan
const batch = detector.analyzeBatch([text1, text2, text3]);
console.log(batch.prevalentCategory); // 'gender'
```

**Bias categories:** `gender`, `racial`, `age`, `political`, `socioeconomic`, `disability`, `religious`, `cultural`

### 4.5 Content Filter

Category-based content filtering with configurable rules.

```typescript
import { ContentFilter } from './security/content-filter.js';

const filter = new ContentFilter();

// Scan content
const result = filter.scan('Click here to buy now and win free money!');

console.log(result.passed);      // true (spam is only flagged, not blocked)
console.log(result.violations);
// [{ ruleId: 'filter-3', category: 'spam', severity: 'low',
//    match: 'buy now', action: 'flag' }]

// Add custom rule
const ruleId = filter.addRule(
    'company-policy',                          // category
    [/\b(confidential|internal\s+only)\b/gi],  // patterns
    'high',                                     // severity
    'block'                                     // action: 'flag' | 'block' | 'redact'
);

// Redacted content
const result2 = filter.scan('What the fuck is this shit?');
console.log(result2.filteredContent);
// 'What the **** is this ****?'

// Manage rules
filter.setEnabled(ruleId, false);   // disable a rule
console.log(filter.list());         // list all rules
console.log(filter.getStats());
// { scanned: 2, blocked: 0, flagged: 1, redacted: 1 }
```

---

## 5. Guardrails Engine (Unified Pipeline)

The `GuardrailsEngine` orchestrates **all** safety checks into one scan call.

```typescript
import { GuardrailsEngine } from './security/guardrails.js';

// Create with a policy preset
const guardrails = new GuardrailsEngine({
    policy: 'standard',  // 'strict' | 'standard' | 'permissive' | 'monitor'
});

// Single scan — runs ALL checks
const result = guardrails.scan('Contact me at john@evil.com, you stupid fool!');

console.log(result.safe);        // false
console.log(result.blocked);     // true (toxic content blocked in standard mode)
console.log(result.policy);      // 'standard'
console.log(result.enforcements);
// ['Blocked: toxic content (medium)', 'PII masked in output']

console.log(result.filteredText);  // PII masked version
console.log(result.toxicity);     // ToxicityResult
console.log(result.bias);         // BiasResult
console.log(result.pii);          // PIIScanResult
console.log(result.content);      // FilterResult
console.log(result.report);       // SafetyReportData

// Quick safe check
if (!guardrails.isSafe(userInput)) {
    return 'Message blocked by safety guardrails';
}

// Batch scan
const results = guardrails.scanBatch([msg1, msg2, msg3]);

// Switch policy at runtime
guardrails.setPolicy('strict');     // maximum safety
guardrails.setPolicy('monitor');    // log only, never block

// Enable/disable individual checks
guardrails.disableCheck('bias');
guardrails.enableCheck('pii');

// Get comprehensive stats
const stats = guardrails.getStats();
console.log(stats.blockRate);              // 0.15
console.log(stats.toxicity.toxicRate);     // 0.10
console.log(stats.pii.piiFound);           // 3
console.log(stats.bias.biasRate);          // 0.05

// Recent safety reports
const reports = guardrails.getRecentReports(10);
```

### Policy Presets

| Policy | Toxicity | Bias | PII | Content | Behavior |
|--------|----------|------|-----|---------|----------|
| **strict** | threshold 0.3, block | threshold 0.3, block | block + mask | block | Block everything suspicious |
| **standard** | threshold 0.5, block | threshold 0.4, log | mask only | block | Balanced safety |
| **permissive** | threshold 0.7, log | threshold 0.6, log | mask only | log | Minimal blocking |
| **monitor** | threshold 0.5, log | threshold 0.4, log | log only | log | Monitoring only, never blocks |

---

## 6. Model Scanning

Scan OpenRouter for free models with live tool/image capability probing.

### CLI Usage

```bash
# Scan with live probing (requires OPENROUTER_API_KEY)
coreblow models scan

# Metadata only (no API key needed)
coreblow models scan --no-probe

# Filter options
coreblow models scan --min-params 7     # only 7B+ models
coreblow models scan --max-age-days 90  # only recent models
coreblow models scan --provider google  # only Google models

# Tuning
coreblow models scan --max-candidates 10
coreblow models scan --timeout 15000
coreblow models scan --concurrency 5

# Non-interactive (apply defaults)
coreblow models scan --yes

# Auto-set as default model
coreblow models scan --set-default

# Auto-set image model
coreblow models scan --set-image

# JSON output
coreblow models scan --json
```

### Programmatic Usage

```typescript
import { scanOpenRouterModels } from './agents/model-scan.js';

const results = await scanOpenRouterModels({
    apiKey: process.env.OPENROUTER_API_KEY,
    minParamB: 7,           // minimum 7B parameters
    maxAgeDays: 180,         // models created in last 180 days
    providerFilter: 'meta',  // only Meta models
    timeoutMs: 15_000,
    concurrency: 5,
    probe: true,              // live probe tool/image capability
    onProgress: ({ phase, completed, total }) => {
        console.log(`${phase}: ${completed}/${total}`);
    },
});

// Filter results
const toolCapable = results.filter((r) => r.tool.ok);
const imageCapable = results.filter((r) => r.image.ok);
const bestModels = results
    .filter((r) => r.tool.ok && r.image.ok)
    .sort((a, b) => (a.tool.latencyMs ?? Infinity) - (b.tool.latencyMs ?? Infinity));

for (const model of bestModels.slice(0, 5)) {
    console.log(`${model.modelRef} — tool: ${model.tool.latencyMs}ms, image: ${model.image.latencyMs}ms`);
}
```

---

## 7. Status Scanning

Full system health scan via CLI or API.

### CLI Usage

```bash
# Interactive status with progress bar
coreblow status

# JSON output
coreblow status --json

# Full scan including all channels
coreblow status --all
```

### Programmatic Usage

```typescript
import { scanStatus } from './commands/status.scan.js';

const status = await scanStatus(
    { json: false, all: true },
    runtime,
);

console.log(status.osSummary);           // OS info
console.log(status.gatewayReachable);    // gateway health
console.log(status.update);              // update availability
console.log(status.agentStatus);         // agent statuses
console.log(status.memory);              // memory plugin status
console.log(status.pluginCompatibility); // plugin issues
console.log(status.channelIssues);       // channel problems
```

---

## Quick Reference

| What you want to do | Import from | Key API |
|---------------------|-------------|---------|
| Register agent tools | `tools/tool-registry.js` | `new ToolRegistry().register(tool)` |
| Execute tools | `tools/tool-executor.js` | `new ToolExecutor(registry).execute(name, args)` |
| Orchestrate workflows | `tools/workflow-engine.js` | `new WorkflowEngine().execute(id)` |
| Scan code for threats | `security/skill-scanner.js` | `scanDirectoryWithSummary(dir)` |
| Detect PII | `security/pii-scanner.js` | `new PIIScanner().scan(text)` |
| Detect toxicity | `security/toxicity-detector.js` | `new ToxicityDetector().analyze(text)` |
| Detect bias | `security/bias-detector.js` | `new BiasDetector().analyze(text)` |
| Filter content | `security/content-filter.js` | `new ContentFilter().scan(text)` |
| **Run ALL safety checks** | `security/guardrails.js` | `new GuardrailsEngine().scan(text)` |
| Scan free models | `agents/model-scan.js` | `scanOpenRouterModels(opts)` |
| System health check | `commands/status.scan.js` | `scanStatus(opts, runtime)` |
