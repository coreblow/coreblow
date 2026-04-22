import { describe, it, expect } from 'vitest';
import { AutoComplete } from './autocomplete.js';

describe('AutoComplete', () => {
    it('should complete commands', () => {
        const ac = new AutoComplete();
        ac.setCommands(['help', 'history', 'quit', 'config']);
        expect(ac.complete('h')).toEqual(['help', 'history']);
        expect(ac.complete('q')).toEqual(['quit']);
        expect(ac.complete('x')).toEqual([]);
    });

    it('should return all on empty', () => {
        const ac = new AutoComplete();
        ac.setCommands(['a', 'b']);
        expect(ac.complete('')).toEqual(['a', 'b']);
    });
});
