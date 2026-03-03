import { describe, it, expect } from 'vitest';
import { CommandAliases } from './alias.js';

describe('CommandAliases', () => {
    it('should set and resolve alias', () => {
        const aliases = new CommandAliases();
        aliases.set('h', 'help');
        expect(aliases.resolve('h')).toBe('help');
    });

    it('should return input if no alias', () => {
        const aliases = new CommandAliases();
        expect(aliases.resolve('unknown')).toBe('unknown');
    });

    it('should list all aliases', () => {
        const aliases = new CommandAliases();
        aliases.set('h', 'help');
        aliases.set('q', 'quit');
        const list = aliases.list();
        expect(list.h).toBe('help');
        expect(list.q).toBe('quit');
    });

    it('should remove alias', () => {
        const aliases = new CommandAliases();
        aliases.set('h', 'help');
        aliases.remove('h');
        expect(aliases.resolve('h')).toBe('h');
    });
});
