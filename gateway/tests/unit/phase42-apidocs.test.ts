/**
 * CoreBlow Phase 42 — API Documentation Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreAPIGenerator } from '../../src/tools/coreapi-generator.js';
import { RouteDocs } from '../../src/tools/route-docs.js';
import { TypeDocs } from '../../src/tools/type-docs.js';
import { ExampleGenerator } from '../../src/tools/example-generator.js';
import { ApiVersioningDocs } from '../../src/tools/api-versioning-docs.js';

// ================================================================
describe('CoreAPIGenerator', () => {
    let gen: CoreAPIGenerator;
    beforeEach(() => {
        gen = new CoreAPIGenerator();
        gen.setInfo('CoreBlow API', '1.0.0', 'AI Gateway API');
    });

    it('should generate spec', () => {
        gen.addOperation({
            method: 'GET', path: '/api/users', summary: 'List users',
            responses: { '200': { description: 'Success' } },
        });
        const spec = gen.generate();
        expect(spec.coreapi).toBe('3.0.3');
        expect(spec.paths['/api/users']).toBeTruthy();
    });

    it('should include schemas', () => {
        gen.addSchema('User', { type: 'object', properties: { name: { type: 'string' } } });
        const spec = gen.generate();
        expect(spec.components.schemas['User']).toBeTruthy();
    });

    it('should include parameters', () => {
        gen.addOperation({
            method: 'GET', path: '/api/users/{id}', summary: 'Get user',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'User found' } },
        });
        const spec = gen.generate();
        expect((spec.paths['/api/users/{id}'] as any).get.parameters).toHaveLength(1);
    });

    it('should add servers', () => {
        gen.addServer('https://api.coreblow.com', 'Production');
        const spec = gen.generate();
        expect(spec.servers[0]?.url).toBe('https://api.coreblow.com');
    });

    it('should output JSON', () => {
        gen.addOperation({
            method: 'POST', path: '/api/chat', summary: 'Chat',
            responses: { '200': { description: 'OK' } },
        });
        const json = gen.toJSON();
        expect(JSON.parse(json)).toBeTruthy();
    });
});

// ================================================================
describe('RouteDocs', () => {
    let docs: RouteDocs;
    beforeEach(() => {
        docs = new RouteDocs();
        docs.add({ method: 'GET', path: '/api/users', summary: 'List users', tags: ['Users'] });
        docs.add({ method: 'POST', path: '/api/users', summary: 'Create user', tags: ['Users'] });
        docs.add({ method: 'GET', path: '/api/chat', summary: 'Chat endpoint', tags: ['Chat'] });
    });

    it('should get by tag', () => {
        expect(docs.getByTag('Users')).toHaveLength(2);
    });

    it('should list tags', () => {
        expect(docs.getTags()).toContain('Users');
        expect(docs.getTags()).toContain('Chat');
    });

    it('should generate markdown', () => {
        const md = docs.toMarkdown();
        expect(md).toContain('# API Routes');
        expect(md).toContain('GET /api/users');
    });

    it('should search', () => {
        expect(docs.search('chat')).toHaveLength(1);
    });

    it('should count', () => {
        expect(docs.count()).toBe(3);
    });
});

// ================================================================
describe('TypeDocs', () => {
    let td: TypeDocs;
    beforeEach(() => {
        td = new TypeDocs();
        td.add({
            name: 'User', kind: 'interface', description: 'A user entity',
            properties: [
                { name: 'id', type: 'string', description: 'Unique ID', optional: false },
                { name: 'name', type: 'string', description: 'Full name', optional: false },
                { name: 'email', type: 'string', description: 'Email', optional: true },
            ],
        });
        td.add({ name: 'Role', kind: 'enum', description: 'User roles', values: ['admin', 'user', 'guest'] });
    });

    it('should get type', () => {
        expect(td.get('User')?.properties).toHaveLength(3);
    });

    it('should list by kind', () => {
        expect(td.listByKind('interface')).toHaveLength(1);
        expect(td.listByKind('enum')).toHaveLength(1);
    });

    it('should generate markdown', () => {
        const md = td.toMarkdown();
        expect(md).toContain('# Type Reference');
        expect(md).toContain('User');
    });

    it('should search', () => {
        expect(td.search('role')).toHaveLength(1);
    });
});

// ================================================================
describe('ExampleGenerator', () => {
    let eg: ExampleGenerator;
    beforeEach(() => { eg = new ExampleGenerator(); });

    it('should generate cURL', () => {
        const curl = eg.toCurl({ method: 'GET', path: '/api/users' });
        expect(curl).toContain('curl -X GET');
    });

    it('should generate fetch', () => {
        const js = eg.toFetch({ method: 'POST', path: '/api/chat', body: { message: 'hello' } });
        expect(js).toContain('fetch');
        expect(js).toContain('POST');
    });

    it('should generate Python', () => {
        const py = eg.toPython({ method: 'GET', path: '/api/users' });
        expect(py).toContain('import requests');
    });

    it('should generate full markdown', () => {
        const md = eg.toMarkdown({ method: 'GET', path: '/api/users', response: { users: [] } });
        expect(md).toContain('#### cURL');
        expect(md).toContain('#### JavaScript');
        expect(md).toContain('#### Python');
    });

    it('should use custom base URL', () => {
        eg.setDefaults('https://api.coreblow.com');
        const curl = eg.toCurl({ method: 'GET', path: '/api/users' });
        expect(curl).toContain('api.coreblow.com');
    });
});

// ================================================================
describe('ApiVersioningDocs', () => {
    let vd: ApiVersioningDocs;
    beforeEach(() => {
        vd = new ApiVersioningDocs();
        vd.addVersion({ version: '1.0.0', releaseDate: '2025-01-01', status: 'deprecated', changes: [{ type: 'added', description: 'Initial release' }] });
        vd.addVersion({ version: '2.0.0', releaseDate: '2025-06-01', status: 'current', changes: [{ type: 'changed', description: 'New auth system' }, { type: 'removed', description: 'Legacy endpoints' }] });
    });

    it('should get current', () => {
        expect(vd.getCurrent()?.version).toBe('2.0.0');
    });

    it('should get deprecated', () => {
        expect(vd.getDeprecated()).toHaveLength(1);
    });

    it('should get breaking changes', () => {
        const breaking = vd.getBreakingChanges('1.0.0', '2.0.0');
        expect(breaking.length).toBeGreaterThan(0);
    });

    it('should generate changelog', () => {
        const md = vd.toMarkdown();
        expect(md).toContain('# API Changelog');
        expect(md).toContain('2.0.0');
    });

    it('should count', () => {
        expect(vd.count()).toBe(2);
    });
});
