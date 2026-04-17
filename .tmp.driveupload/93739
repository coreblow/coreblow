/**
 * CoreBlow Phase 28 — Developer Experience Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SDKBuilder } from '../../src/tools/sdk-builder.js';
import { ApiPlayground } from '../../src/tools/api-playground.js';
import { SchemaValidator } from '../../src/tools/schema-validator.js';
import { ChangelogGenerator } from '../../src/tools/changelog-generator.js';
import { DocSiteGenerator } from '../../src/tools/doc-site-generator.js';

const sampleConfig = {
    baseUrl: 'http://localhost:3000', apiName: 'CoreBlow', version: '1.0.0',
    endpoints: [
        { path: '/chat', method: 'POST', name: 'chat', params: [{ name: 'message', type: 'string', required: true }] },
        { path: '/models', method: 'GET', name: 'listModels' },
    ],
};

// ================================================================
describe('SDKBuilder', () => {
    const sdk = new SDKBuilder();

    it('should generate TypeScript', () => {
        const ts = sdk.generateTypeScript(sampleConfig);
        expect(ts).toContain('class CoreBlowClient');
        expect(ts).toContain('async chat');
    });

    it('should generate Python', () => {
        const py = sdk.generatePython(sampleConfig);
        expect(py).toContain('class CoreBlowClient');
        expect(py).toContain('def chat');
    });

    it('should generate cURL', () => {
        const curl = sdk.generateCurl(sampleConfig);
        expect(curl).toContain('curl');
        expect(curl).toContain('/chat');
    });

    it('should list languages', () => {
        expect(sdk.supportedLanguages()).toContain('typescript');
        expect(sdk.supportedLanguages()).toContain('python');
    });
});

// ================================================================
describe('ApiPlayground', () => {
    let pg: ApiPlayground;
    beforeEach(() => { pg = new ApiPlayground(); });

    it('should create requests', () => {
        const req = pg.createRequest('/chat', 'POST');
        expect(req.id).toBeTruthy();
    });

    it('should record responses', () => {
        const req = pg.createRequest('/chat', 'POST');
        pg.recordResponse(req, 200, { ok: true }, 50);
        expect(pg.count()).toBe(1);
    });

    it('should save/load requests', () => {
        const req = pg.createRequest('/health', 'GET');
        pg.saveRequest('health-check', req);
        expect(pg.loadRequest('health-check')).toBeTruthy();
    });

    it('should format response', () => {
        const formatted = pg.formatResponse({ requestId: 'r1', status: 200, headers: {}, body: { ok: true }, durationMs: 42, size: 10 });
        expect(formatted).toContain('HTTP 200');
        expect(formatted).toContain('42ms');
    });

    it('should get history', () => {
        const req = pg.createRequest('/a', 'GET');
        pg.recordResponse(req, 200, {}, 10);
        expect(pg.getHistory()).toHaveLength(1);
    });

    it('should list saved', () => {
        pg.saveRequest('a', pg.createRequest('/a', 'GET'));
        expect(pg.listSaved()).toContain('a');
    });
});

// ================================================================
describe('SchemaValidator', () => {
    let sv: SchemaValidator;
    beforeEach(() => {
        sv = new SchemaValidator();
        sv.register('user', {
            name: { type: 'string', required: true },
            age: { type: 'number' },
            role: { type: 'enum', enum: ['admin', 'user'] },
        });
    });

    it('should validate valid data', () => {
        const result = sv.validate('user', { name: 'Alice', age: 25, role: 'admin' });
        expect(result.valid).toBe(true);
    });

    it('should catch missing required', () => {
        const result = sv.validate('user', {});
        expect(result.valid).toBe(false);
    });

    it('should catch wrong type', () => {
        const result = sv.validate('user', { name: 123 });
        expect(result.valid).toBe(false);
    });

    it('should validate enums', () => {
        const result = sv.validate('user', { name: 'Bob', role: 'superadmin' });
        expect(result.valid).toBe(false);
    });

    it('should apply defaults', () => {
        sv.register('config', { port: { type: 'number', default: 3000 } });
        const data = sv.applyDefaults({}, sv.get('config')!);
        expect(data.port).toBe(3000);
    });

    it('should generate samples', () => {
        const sample = sv.generateSample(sv.get('user')!);
        expect(sample.name).toBe('example');
    });

    it('should validate nested objects', () => {
        sv.register('nested', {
            settings: { type: 'object', required: true, properties: { theme: { type: 'string', required: true } } },
        });
        const result = sv.validate('nested', { settings: { theme: 'dark' } });
        expect(result.valid).toBe(true);
    });
});

// ================================================================
describe('ChangelogGenerator', () => {
    let cl: ChangelogGenerator;
    beforeEach(() => {
        cl = new ChangelogGenerator();
        cl.addEntry({ version: '1.0.0', date: '2026-01-01', categories: { added: ['Initial release'] } });
        cl.addEntry({ version: '1.1.0', date: '2026-02-01', categories: { added: ['WebSocket'], fixed: ['Bug #42'] } });
    });

    it('should generate markdown', () => {
        const md = cl.generateMarkdown();
        expect(md).toContain('# Changelog');
        expect(md).toContain('[1.1.0]');
    });

    it('should generate JSON', () => {
        const json = JSON.parse(cl.generateJSON());
        expect(json).toHaveLength(2);
    });

    it('should get latest', () => {
        expect(cl.getLatest()?.version).toBe('1.1.0');
    });

    it('should diff versions', () => {
        const diffs = cl.diff('1.0.0', '1.1.0');
        expect(diffs).toHaveLength(1);
    });

    it('should list versions', () => {
        expect(cl.listVersions()).toEqual(['1.1.0', '1.0.0']);
    });
});

// ================================================================
describe('DocSiteGenerator', () => {
    let docs: DocSiteGenerator;
    beforeEach(() => {
        docs = new DocSiteGenerator();
        docs.addModule({
            name: 'SessionManager', description: 'Manages user sessions', category: 'Gateway',
            exports: [{ name: 'SessionManager', type: 'class', description: 'Main class' }],
            examples: [{ title: 'Basic', code: 'new SessionManager()' }],
        });
    });

    it('should generate module page', () => {
        const page = docs.generateModulePage('SessionManager');
        expect(page).toContain('# SessionManager');
        expect(page).toContain('## API Reference');
    });

    it('should generate sidebar', () => {
        const sidebar = docs.generateSidebar();
        expect(sidebar[0]?.category).toBe('Gateway');
    });

    it('should generate getting started', () => {
        const guide = docs.generateGettingStarted();
        expect(guide).toContain('# Getting Started');
        expect(guide).toContain('npm install');
    });

    it('should build search index', () => {
        const index = docs.buildSearchIndex();
        expect(index[0]?.keywords).toContain('SessionManager');
    });

    it('should search', () => {
        expect(docs.search('session')).toHaveLength(1);
        expect(docs.search('nonexistent')).toHaveLength(0);
    });
});
