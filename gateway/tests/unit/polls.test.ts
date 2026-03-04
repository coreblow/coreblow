/**
 * tests/unit/polls.test.ts
 * Tests for the polls system
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PollManager } from '../../src/tools/polls.js';

describe('PollManager', () => {
    let manager: PollManager;

    beforeEach(() => {
        manager = new PollManager();
    });

    afterEach(() => {
        manager.destroy();
    });

    it('should create a poll', () => {
        const poll = manager.create({
            question: 'Best language?',
            options: ['TypeScript', 'Python', 'Rust'],
            createdBy: 'alice',
        });
        expect(poll.id).toBeTruthy();
        expect(poll.question).toBe('Best language?');
        expect(poll.options.length).toBe(3);
        expect(poll.closed).toBe(false);
    });

    it('should vote on a poll', () => {
        const poll = manager.create({
            question: 'Favorite?',
            options: ['A', 'B'],
            createdBy: 'test',
        });
        const result = manager.vote(poll.id, 0, 'alice');
        expect(result.success).toBe(true);
        expect(manager.get(poll.id)!.options[0].votes).toBe(1);
    });

    it('should prevent double voting in single-vote mode', () => {
        const poll = manager.create({
            question: 'Pick one',
            options: ['X', 'Y'],
            createdBy: 'test',
        });
        manager.vote(poll.id, 0, 'alice');
        const result = manager.vote(poll.id, 1, 'alice');
        expect(result.success).toBe(false);
        expect(result.reason).toContain('Already voted');
    });

    it('should allow multi-vote when enabled', () => {
        const poll = manager.create({
            question: 'Pick many',
            options: ['X', 'Y', 'Z'],
            createdBy: 'test',
            multiVote: true,
        });
        expect(manager.vote(poll.id, 0, 'alice').success).toBe(true);
        expect(manager.vote(poll.id, 1, 'alice').success).toBe(true);
        expect(poll.totalVotes).toBe(2);
    });

    it('should close a poll', () => {
        const poll = manager.create({
            question: 'Test',
            options: ['A'],
            createdBy: 'test',
        });
        manager.close(poll.id);
        expect(manager.get(poll.id)!.closed).toBe(true);
    });

    it('should prevent voting on closed poll', () => {
        const poll = manager.create({ question: 'Q', options: ['A'], createdBy: 'test' });
        manager.close(poll.id);
        const result = manager.vote(poll.id, 0, 'alice');
        expect(result.success).toBe(false);
        expect(result.reason).toContain('closed');
    });

    it('should unvote', () => {
        const poll = manager.create({ question: 'Q', options: ['A', 'B'], createdBy: 'test' });
        manager.vote(poll.id, 0, 'alice');
        expect(manager.unvote(poll.id, 0, 'alice')).toBe(true);
        expect(poll.options[0].votes).toBe(0);
    });

    it('should format results with bar chart', () => {
        const poll = manager.create({ question: 'Colors?', options: ['Red', 'Blue'], createdBy: 'test' });
        manager.vote(poll.id, 0, 'alice');
        manager.vote(poll.id, 1, 'bob');
        const text = manager.formatResults(poll.id);
        expect(text).toContain('Colors?');
        expect(text).toContain('Red');
        expect(text).toContain('Blue');
        expect(text).toContain('█');
    });

    it('should list active polls', () => {
        manager.create({ question: 'Q1', options: ['A'], createdBy: 'test' });
        const p2 = manager.create({ question: 'Q2', options: ['B'], createdBy: 'test' });
        manager.close(p2.id);
        const active = manager.list({ active: true });
        expect(active.length).toBe(1);
    });

    it('should handle anonymous polls', () => {
        const poll = manager.create({ question: 'Q', options: ['A'], createdBy: 'test', anonymous: true });
        manager.vote(poll.id, 0, 'alice');
        const text = manager.formatResults(poll.id);
        expect(text).not.toContain('alice');
    });
});
