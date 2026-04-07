/**
 * tests/unit/deploy.test.ts
 * Tests for cloud deploy configurations
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../');

describe('Deploy Configurations', () => {
    it('should have Dockerfile', () => {
        expect(fs.existsSync(path.join(ROOT, 'Dockerfile'))).toBe(true);
    });

    it('Dockerfile should use multi-stage build', () => {
        const content = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf-8');
        expect(content).toContain('AS deps');
        expect(content).toContain('AS runtime');
        expect(content).toContain('HEALTHCHECK');
    });

    it('Dockerfile should run as non-root user', () => {
        const content = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf-8');
        expect(content).toContain('USER node');
    });

    it('should have docker-compose.yml', () => {
        expect(fs.existsSync(path.join(ROOT, 'docker-compose.yml'))).toBe(true);
    });

    it('docker-compose should define gateway and ollama services', () => {
        const content = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf-8');
        expect(content).toContain('gateway');
        expect(content).toContain('ollama');
    });

    it('should have fly.toml', () => {
        expect(fs.existsSync(path.join(ROOT, 'fly.toml'))).toBe(true);
    });

    it('fly.toml should have health check', () => {
        const content = fs.readFileSync(path.join(ROOT, 'fly.toml'), 'utf-8');
        expect(content).toContain('/api/health');
    });

    it('should have render.yaml', () => {
        expect(fs.existsSync(path.join(ROOT, 'render.yaml'))).toBe(true);
    });

    it('should have GitHub Actions CI', () => {
        expect(fs.existsSync(path.join(ROOT, '..', '.github', 'workflows', 'ci.yml'))).toBe(true);
    });
});
