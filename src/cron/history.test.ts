import { describe, it, expect } from 'vitest';
import { CronHistory } from './history.js';

describe('CronHistory', () => {
    it('should record runs', () => {
        const h = new CronHistory();
        h.record('job1', 100, true);
        h.record('job1', 200, false, 'timeout');
        expect(h.getByJob('job1')).toHaveLength(2);
    });

    it('should get failures only', () => {
        const h = new CronHistory();
        h.record('j1', 100, true);
        h.record('j2', 200, false, 'err');
        expect(h.getFailures()).toHaveLength(1);
    });
});
