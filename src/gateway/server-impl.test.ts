/**
 * Gateway server-impl tests
 */
import { describe, it, expect } from 'vitest';
import { createGatewayServer, GatewayServer } from './server-impl.js';

describe('GatewayServer', () => {
    it('should create server with default config', () => {
        const server = createGatewayServer();
        expect(server).toBeInstanceOf(GatewayServer);
    });

    it('should create server with custom config', () => {
        const server = createGatewayServer({ port: 8080, host: '127.0.0.1' });
        expect(server).toBeInstanceOf(GatewayServer);
    });

    it('should register routes', () => {
        const server = createGatewayServer();
        const returned = server.get('/test', () => {});
        expect(returned).toBe(server); // chainable
    });

    it('should support all HTTP methods', () => {
        const server = createGatewayServer();
        server.get('/a', () => {});
        server.post('/b', () => {});
        server.put('/c', () => {});
        server.del('/d', () => {});
        expect(server).toBeTruthy();
    });

    it('should report 0 uptime before start', () => {
        const server = createGatewayServer();
        expect(server.uptime()).toBe(0);
    });

    it('should return null http server before start', () => {
        const server = createGatewayServer();
        expect(server.getHttpServer()).toBeNull();
    });
});
