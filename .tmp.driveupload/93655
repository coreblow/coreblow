/**
 * CoreBlow Phase 43 — Final Integration Tests
 *
 * Tests the complete CoreBlow Gateway system through
 * barrel exports to verify the public API surface.
 */
import { describe, it, expect } from 'vitest';

// Import through barrel exports
import {
    // Auth
    JWTManager, ApiKeyManager, PermissionResolver, SessionAuth,
    // Gateway
    ApiGateway, RouteMatcher, ResponseBuilder, MiddlewareChain, RequestPipeline,
    // Infra - Caching
    LRUCache, CacheInvalidation, LazyLoader,
    // Infra - Search
    SearchEngine, FuzzySearch, QueryParser, SearchRanking,
    // Infra - Messaging
    MessageBroker, PubSub, EventBus, DeadLetterQueue,
    // Infra - Deployment
    DeploymentManager, HealthProbe, BlueGreenDeployer, RollbackManager,
    // Infra - Data
    DataTransformer, DataValidator, FormatConverter,
    // Tools
    CoreAPIGenerator, RouteDocs, ExampleGenerator, ApiVersioningDocs,
    // Config
    ConfigHotReload,
    // Meta
    VERSION, NAME,
} from '../../src/index.js';

// ================================================================
describe('CoreBlow Gateway — Final Integration', () => {

    it('should export version and name', () => {
        expect(VERSION).toBe('1.0.0');
        expect(NAME).toBe('CoreBlow Gateway');
    });

    it('should build a complete auth flow', () => {
        const jwt = new JWTManager({ issuer: 'coreblow' });
        const akm = new ApiKeyManager();
        const perms = new PermissionResolver();
        const sessions = new SessionAuth();

        // Issue JWT
        const { token } = jwt.issue('user-1', ['admin']);
        expect(jwt.verify(token).valid).toBe(true);

        // Create API key
        const key = akm.create('Test App', 'user-1', ['read', 'write']);
        expect(akm.validate(key.key).valid).toBe(true);

        // Setup permissions
        perms.defineRole('admin', [{ resource: '*', action: '*' }]);
        perms.assignRoles('user-1', ['admin']);
        expect(perms.can('user-1', 'users', 'delete')).toBe(true);

        // Create session
        const session = sessions.create('user-1');
        expect(sessions.validate(session.id).valid).toBe(true);
    });

    it('should build a complete gateway flow', async () => {
        const gw = new ApiGateway();
        gw.get('/api/health', async (ctx) => { ctx.response.body = { status: 'ok' }; });
        gw.post('/api/echo', async (ctx) => { ctx.response.body = ctx.request.body; });

        const health = await gw.handle('GET', '/api/health');
        expect(health.body).toEqual({ status: 'ok' });

        const echo = await gw.handle('POST', '/api/echo', {}, { msg: 'hello' });
        expect(echo.body).toEqual({ msg: 'hello' });

        expect(gw.getStats().requests).toBe(2);
    });

    it('should build a complete caching layer', () => {
        const cache = new LRUCache<string>(100);
        const invalidation = new CacheInvalidation();

        cache.set('user:1', 'Alice');
        invalidation.register('user:1', ['users']);

        expect(cache.get('user:1')).toBe('Alice');
        invalidation.invalidateByTag('users');
        expect(invalidation.isInvalidated('user:1')).toBe(true);
    });

    it('should build a complete search pipeline', () => {
        const engine = new SearchEngine();
        const parser = new QueryParser();
        const ranking = new SearchRanking();

        engine.index('1', { title: 'CoreBlow Gateway', body: 'AI-powered API gateway' });
        engine.index('2', { title: 'Quick Start Guide', body: 'Get started with CoreBlow' });

        const query = parser.parse('CoreBlow type:docs');
        expect(query.terms).toContain('CoreBlow');
        expect(query.filters[0]?.field).toBe('type');

        const results = engine.search('CoreBlow');
        expect(results.total).toBe(2);
    });

    it('should build a complete messaging pipeline', async () => {
        const broker = new MessageBroker();
        const ps = new PubSub();
        const bus = new EventBus();
        const dlq = new DeadLetterQueue();

        // Broker
        broker.publish('emails', { to: 'admin@coreblow.com' });
        broker.subscribe('emails', async () => true);
        await broker.processNext('emails');
        expect(broker.getStats().consumed).toBe(1);

        // PubSub
        let received = false;
        ps.subscribe('user.created', () => { received = true; });
        ps.publish('user.created', { id: 1 });
        expect(received).toBe(true);

        // EventBus
        let eventHandled = false;
        bus.on('deploy', () => { eventHandled = true; });
        await bus.emit('deploy', { version: '1.0' });
        expect(eventHandled).toBe(true);

        // DLQ
        dlq.add('emails', {}, 'timeout', 3);
        expect(dlq.count()).toBe(1);
    });

    it('should build a complete deployment pipeline', async () => {
        const dm = new DeploymentManager();
        const bg = new BlueGreenDeployer();
        const probe = new HealthProbe();
        const rm = new RollbackManager();

        // Create and deploy
        const dep = dm.create('v1.0.0', 'production', ['gateway.js']);
        dm.deploy(dep.id);
        dm.markDeployed(dep.id);
        expect(dm.getCurrent('production')?.version).toBe('v1.0.0');

        // Blue-green
        await bg.deploy('v1.0');
        bg.switchTraffic();
        expect(bg.getStatus().activeSlot).toBe('green');

        // Health probe
        probe.register('api', async () => true);
        const result = await probe.probe('api');
        expect(result.healthy).toBe(true);

        // Rollback point
        const point = rm.create('deployment', 'v1.0 state', { version: '1.0' });
        expect(rm.rollback(point.id).success).toBe(true);
    });

    it('should generate API documentation', () => {
        const gen = new CoreAPIGenerator();
        gen.setInfo('CoreBlow API', '1.0.0', 'The ultimate AI gateway');
        gen.addServer('https://api.coreblow.com');
        gen.addOperation({
            method: 'POST', path: '/api/v1/chat', summary: 'Send message',
            responses: { '200': { description: 'Success' } },
        });

        const spec = gen.generate();
        expect(spec.coreapi).toBe('3.0.3');
        expect(spec.info.title).toBe('CoreBlow API');

        const docs = new RouteDocs();
        docs.add({ method: 'POST', path: '/api/v1/chat', summary: 'Send message', tags: ['Chat'] });
        expect(docs.toMarkdown()).toContain('POST /api/v1/chat');

        const examples = new ExampleGenerator();
        examples.setDefaults('https://api.coreblow.com');
        const curl = examples.toCurl({ method: 'POST', path: '/api/v1/chat', body: { message: 'Hello' } });
        expect(curl).toContain('api.coreblow.com');
    });

    it('should manage configuration hot reload', () => {
        const config = new ConfigHotReload({ port: 3000, debug: false, name: 'CoreBlow' });
        expect(config.get('name')).toBe('CoreBlow');

        config.set('port', 8080);
        expect(config.get('port')).toBe(8080);

        config.rollback();
        expect(config.get('port')).toBe(3000);
    });

    it('should process data transformations', () => {
        const transformer = new DataTransformer();
        const validator = new DataValidator();
        const converter = new FormatConverter();

        transformer.rename('name', 'fullName');
        const result = transformer.transform({ name: 'CoreBlow', version: '1.0' });
        expect(result.fullName).toBe('CoreBlow');

        validator.required('name');
        const validation = validator.validate({ name: 'test' });
        expect(validation.valid).toBe(true);

        const json = JSON.stringify({ key: 'value' });
        expect(JSON.parse(json)).toEqual({ key: 'value' });
    });
});
