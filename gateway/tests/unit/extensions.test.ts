/**
 * tests/unit/extensions.test.ts
 * Tests for individual extension files — verify they export valid extensions
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions');

describe('Extension Files', () => {
    const extensionDirs = fs.readdirSync(EXTENSIONS_DIR)
        .filter(d => fs.statSync(path.join(EXTENSIONS_DIR, d)).isDirectory());

    it('should have 30 extensions', () => {
        expect(extensionDirs.length).toBe(30);
    });

    it('should have index.ts in every extension directory', () => {
        for (const dir of extensionDirs) {
            const indexPath = path.join(EXTENSIONS_DIR, dir, 'index.ts');
            expect(fs.existsSync(indexPath), `Missing index.ts in extensions/${dir}/`).toBe(true);
        }
    });

    it('should import defineExtension in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing defineExtension import`).toContain('defineExtension');
        }
    });

    it('should call defineExtension in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing defineExtension call`).toContain('defineExtension(');
        }
    });

    it('should export default in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing default export`).toContain('export default');
        }
    });

    it('should have meta.name in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing meta.name`).toContain("name:");
        }
    });

    it('should have meta.version in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing meta.version`).toContain("version:");
        }
    });

    it('should have meta.description in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing meta.description`).toContain("description:");
        }
    });

    it('should have init function in every extension', () => {
        for (const dir of extensionDirs) {
            const content = fs.readFileSync(path.join(EXTENSIONS_DIR, dir, 'index.ts'), 'utf-8');
            expect(content, `extensions/${dir} missing init`).toContain('init');
        }
    });
});
