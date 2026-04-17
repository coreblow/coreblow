/**
 * CoreBlow Prompt Composition Scenarios
 *
 * Advanced prompt composition patterns for different scenarios: code review,
 * debugging, refactoring, testing, documentation, security audit, and more.
 *
 * Equivalent: CoreBlow src/agents/prompt-composition-scenarios.ts (693 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('prompt-scenarios');

// ─── Types ────────────────────────────────────────────────────────

export type ScenarioId =
    | 'code-review'
    | 'debugging'
    | 'refactoring'
    | 'testing'
    | 'documentation'
    | 'security-audit'
    | 'performance'
    | 'architecture'
    | 'migration'
    | 'onboarding'
    | 'devops'
    | 'data-analysis'
    | 'api-design'
    | 'custom';

export interface PromptScenario {
    id: ScenarioId;
    name: string;
    description: string;
    systemPromptAdditions: string;
    suggestedTools: string[];
    priority: number;
    tags: string[];
}

export interface ScenarioContext {
    projectType?: string;
    language?: string;
    framework?: string;
    domain?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
}

// ─── Scenario Registry ────────────────────────────────────────────

const scenarios = new Map<ScenarioId, PromptScenario>();

function register(scenario: PromptScenario): void {
    scenarios.set(scenario.id, scenario);
}

// ─── Built-in Scenarios ───────────────────────────────────────────

register({
    id: 'code-review',
    name: 'Code Review',
    description: 'Systematic code review with quality, security, and style checks',
    systemPromptAdditions: `
## Code Review Mode

Focus on:
1. **Correctness**: Logic errors, edge cases, race conditions
2. **Security**: Injection, auth bypass, data leaks, path traversal
3. **Performance**: N+1 queries, unnecessary allocations, algorithmic complexity
4. **Maintainability**: Naming, abstractions, DRY violations, dead code
5. **Testing**: Missing test coverage, test quality
6. **Type Safety**: Any casts, type assertions, missing null checks

Format feedback as:
- 🔴 CRITICAL: Must fix before merge
- 🟡 IMPORTANT: Should fix
- 🟢 SUGGESTION: Nice to have
- 💡 NOTE: FYI / context
`.trim(),
    suggestedTools: ['read', 'grep', 'exec'],
    priority: 1,
    tags: ['code', 'review', 'quality'],
});

register({
    id: 'debugging',
    name: 'Debugging Assistant',
    description: 'Systematic debugging with root cause analysis',
    systemPromptAdditions: `
## Debugging Mode

Approach:
1. **Reproduce**: Understand how to consistently reproduce the issue
2. **Isolate**: Narrow down to the specific component/function
3. **Root Cause**: Identify the actual cause, not symptoms
4. **Fix**: Propose minimal, targeted fix
5. **Verify**: Confirm fix resolves the issue without regressions

Use systematic elimination. Check:
- Recent changes (git log, git diff)
- Error logs and stack traces
- Input validation and edge cases
- State management and race conditions
- External dependencies and API changes
`.trim(),
    suggestedTools: ['read', 'grep', 'exec', 'write'],
    priority: 2,
    tags: ['debug', 'fix', 'error'],
});

register({
    id: 'refactoring',
    name: 'Refactoring Guide',
    description: 'Safe refactoring with incremental changes',
    systemPromptAdditions: `
## Refactoring Mode

Principles:
1. **Small Steps**: Make one change at a time. Run tests between each.
2. **Preserve Behavior**: No functional changes during refactoring.
3. **Test First**: Ensure test coverage before refactoring.
4. **Extract, then Simplify**: Extract methods/classes first, optimize later.

Common refactoring patterns:
- Extract Method / Extract Class
- Rename for clarity
- Replace conditional with polymorphism
- Introduce Parameter Object
- Replace magic numbers with named constants
- Simplify boolean expressions
`.trim(),
    suggestedTools: ['read', 'write', 'exec', 'grep'],
    priority: 3,
    tags: ['refactor', 'clean', 'improve'],
});

register({
    id: 'testing',
    name: 'Testing Assistant',
    description: 'Write and improve tests',
    systemPromptAdditions: `
## Testing Mode

Testing best practices:
1. **Test Behavior, not Implementation**: Tests should verify what code does, not how.
2. **Arrange-Act-Assert**: Clear structure for every test.
3. **One Assert per Test**: Each test should verify one thing.
4. **Meaningful Names**: Test names should describe the scenario.
5. **Edge Cases**: Cover boundaries, nulls, empty inputs, errors.
6. **Co-located Tests**: Place test files next to source files as *.test.ts

Test types to consider:
- Unit tests (isolated, fast)
- Integration tests (component interactions)
- Edge case tests (boundaries, errors)
- Regression tests (prevent known bugs from recurring)
`.trim(),
    suggestedTools: ['read', 'write', 'exec'],
    priority: 2,
    tags: ['test', 'quality', 'coverage'],
});

register({
    id: 'documentation',
    name: 'Documentation Writer',
    description: 'Generate clear, maintainable documentation',
    systemPromptAdditions: `
## Documentation Mode

Writing principles:
1. **Audience First**: Write for the reader, not the writer.
2. **Examples**: Every concept needs a working example.
3. **Structure**: Use headers, lists, and code blocks consistently.
4. **Keep Current**: Documentation should match the actual code.
5. **API Reference**: Include parameters, return values, errors, examples.

Documentation types:
- README: Project overview, setup, quickstart
- API docs: Endpoint reference, request/response examples
- Architecture: System design, data flow, decisions
- Guides: Step-by-step tutorials and how-tos
`.trim(),
    suggestedTools: ['read', 'write', 'grep'],
    priority: 4,
    tags: ['docs', 'readme', 'guide'],
});

register({
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Security vulnerability assessment',
    systemPromptAdditions: `
## Security Audit Mode

OWASP Top 10 checklist:
1. **Injection**: SQL, NoSQL, OS command, LDAP injection
2. **Broken Auth**: Weak passwords, session management, credential exposure
3. **Sensitive Data**: Encryption at rest/transit, PII handling, logging secrets
4. **XML/XXE**: External entity processing
5. **Access Control**: IDOR, privilege escalation, CORS
6. **Misconfiguration**: Default credentials, error messages, headers
7. **XSS**: Reflected, stored, DOM-based
8. **Insecure Deserialization**: Untrusted data, prototype pollution
9. **Known Vulnerabilities**: Outdated dependencies, CVEs
10. **Logging**: Insufficient monitoring, audit trails

For each finding, specify:
- Severity: Critical / High / Medium / Low / Info
- Location: File and line number
- Recommendation: Specific fix with code example
`.trim(),
    suggestedTools: ['read', 'grep', 'exec'],
    priority: 1,
    tags: ['security', 'audit', 'vulnerability'],
});

register({
    id: 'performance',
    name: 'Performance Optimizer',
    description: 'Performance analysis and optimization',
    systemPromptAdditions: `
## Performance Mode

Analysis approach:
1. **Measure First**: Profile before optimizing. Use benchmarks.
2. **Identify Bottlenecks**: Focus on the slowest 20% that causes 80% of issues.
3. **Algorithm First**: Fix O(n²) before micro-optimizing.
4. **Cache Wisely**: Cache expensive computations, invalidate correctly.
5. **Minimize I/O**: Batch operations, reduce network calls.

Common patterns to check:
- N+1 queries
- Unnecessary re-renders / recomputations
- Missing indexes
- Synchronous blocking operations
- Memory leaks (event listeners, closures)
- Bundle size (tree-shaking, code splitting)
`.trim(),
    suggestedTools: ['read', 'exec', 'grep'],
    priority: 3,
    tags: ['performance', 'optimization', 'speed'],
});

register({
    id: 'architecture',
    name: 'Architecture Advisor',
    description: 'System design and architecture guidance',
    systemPromptAdditions: `
## Architecture Mode

Design principles:
1. **Separation of Concerns**: Each module has one responsibility.
2. **Dependency Inversion**: Depend on abstractions, not concretions.
3. **Interface Segregation**: Small, focused interfaces.
4. **Open/Closed**: Open for extension, closed for modification.
5. **YAGNI**: Don't build what you don't need yet.

Consider:
- Scalability: Horizontal vs vertical
- Resilience: Circuit breakers, retries, fallbacks
- Observability: Logging, metrics, tracing
- Security: Defense in depth, least privilege
- Data flow: Event-driven vs request-response
`.trim(),
    suggestedTools: ['read', 'grep'],
    priority: 4,
    tags: ['architecture', 'design', 'system'],
});

register({
    id: 'migration',
    name: 'Migration Guide',
    description: 'Safe migration planning and execution',
    systemPromptAdditions: `
## Migration Mode

Migration safety rules:
1. **Backward Compatible**: New code must work with old data.
2. **Incremental**: Deploy in stages, never big-bang.
3. **Reversible**: Every step must be rollback-able.
4. **Data Integrity**: Validate data before and after migration.
5. **Zero Downtime**: Use blue-green or canary deployments.
`.trim(),
    suggestedTools: ['read', 'write', 'exec'],
    priority: 5,
    tags: ['migration', 'upgrade', 'deploy'],
});

register({
    id: 'onboarding',
    name: 'Onboarding Assistant',
    description: 'Help new developers understand the codebase',
    systemPromptAdditions: `
## Onboarding Mode

Be patient and thorough. Explain:
1. **Project Structure**: What each directory and key file does.
2. **Architecture**: How components interact.
3. **Conventions**: Naming, patterns, and style guidelines used.
4. **Setup**: How to get the development environment running.
5. **Workflow**: How to make changes, test, and deploy.

Use analogies and diagrams where helpful.
`.trim(),
    suggestedTools: ['read', 'grep'],
    priority: 5,
    tags: ['onboarding', 'learning', 'guide'],
});

register({
    id: 'devops',
    name: 'DevOps Assistant',
    description: 'CI/CD, infrastructure, and deployment',
    systemPromptAdditions: `
## DevOps Mode

Focus areas:
1. **CI/CD**: Pipeline configuration, build optimization, test automation
2. **Infrastructure**: Docker, Kubernetes, cloud services
3. **Monitoring**: Alerting, logging, metrics, dashboards
4. **Security**: Secrets management, network policies, scanning
5. **Reliability**: SLOs, error budgets, incident response
`.trim(),
    suggestedTools: ['read', 'write', 'exec'],
    priority: 4,
    tags: ['devops', 'ci', 'deploy', 'infra'],
});

register({
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Data exploration and analysis',
    systemPromptAdditions: `
## Data Analysis Mode

Approach:
1. **Understand**: What question are we trying to answer?
2. **Explore**: Examine data shape, distributions, outliers
3. **Clean**: Handle missing values, duplicates, inconsistencies
4. **Analyze**: Apply appropriate statistical methods
5. **Visualize**: Present findings clearly
6. **Interpret**: Draw actionable conclusions
`.trim(),
    suggestedTools: ['read', 'exec', 'write'],
    priority: 5,
    tags: ['data', 'analysis', 'statistics'],
});

register({
    id: 'api-design',
    name: 'API Designer',
    description: 'REST/GraphQL API design and review',
    systemPromptAdditions: `
## API Design Mode

REST best practices:
1. **Resources**: Use nouns, not verbs. Pluralize collections.
2. **HTTP Methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
3. **Status Codes**: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Error
4. **Versioning**: URL prefix (v1) or header-based
5. **Pagination**: Cursor-based preferred over offset
6. **Error Format**: Consistent error response structure
7. **Documentation**: OpenAPI/Swagger spec
`.trim(),
    suggestedTools: ['read', 'write'],
    priority: 4,
    tags: ['api', 'rest', 'design'],
});

// ─── Scenario Operations ─────────────────────────────────────────

/**
 * Get a scenario by ID
 */
export function getScenario(id: ScenarioId): PromptScenario | undefined {
    return scenarios.get(id);
}

/**
 * List all scenarios
 */
export function listScenarios(): PromptScenario[] {
    return Array.from(scenarios.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Search scenarios by query
 */
export function searchScenarios(query: string): PromptScenario[] {
    const lower = query.toLowerCase();
    return listScenarios().filter((s) =>
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.tags.some((t) => t.includes(lower)),
    );
}

/**
 * Auto-detect the best scenario from user message
 */
export function detectScenario(message: string): ScenarioId | undefined {
    const lower = message.toLowerCase();

    const keywords: Record<ScenarioId, string[]> = {
        'code-review': ['review', 'pr', 'pull request', 'code review', 'look at this code'],
        'debugging': ['bug', 'error', 'crash', 'broken', 'not working', 'fix', 'debug', 'issue'],
        'refactoring': ['refactor', 'clean up', 'simplify', 'restructure', 'improve code'],
        'testing': ['test', 'spec', 'coverage', 'unit test', 'integration test'],
        'documentation': ['document', 'readme', 'docs', 'jsdoc', 'comment'],
        'security-audit': ['security', 'vulnerability', 'audit', 'cve', 'owasp'],
        'performance': ['performance', 'slow', 'optimize', 'benchmark', 'latency'],
        'architecture': ['architecture', 'design', 'structure', 'pattern', 'scale'],
        'migration': ['migrate', 'upgrade', 'move to', 'switch to', 'convert'],
        'onboarding': ['explain', 'how does', 'what is', 'understand', 'overview'],
        'devops': ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'pipeline'],
        'data-analysis': ['data', 'analyze', 'statistics', 'chart', 'graph'],
        'api-design': ['api', 'endpoint', 'rest', 'graphql', 'schema'],
        'custom': [],
    };

    let bestMatch: ScenarioId | undefined;
    let bestScore = 0;

    for (const [id, words] of Object.entries(keywords)) {
        const score = words.filter((w) => lower.includes(w)).length;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = id as ScenarioId;
        }
    }

    return bestScore > 0 ? bestMatch : undefined;
}

/**
 * Get system prompt additions for active scenarios
 */
export function getScenarioPromptAdditions(scenarioIds: ScenarioId[]): string {
    const parts: string[] = [];
    for (const id of scenarioIds) {
        const scenario = scenarios.get(id);
        if (scenario) {
            parts.push(scenario.systemPromptAdditions);
        }
    }
    return parts.join('\n\n');
}

/**
 * Register a custom scenario
 */
export function registerCustomScenario(scenario: PromptScenario): void {
    scenarios.set(scenario.id, scenario);
    log.debug({ id: scenario.id, name: scenario.name }, 'Custom scenario registered');
}
