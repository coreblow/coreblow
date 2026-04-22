/**
 * CoreBlow — Subagent Lifecycle Events Tests
 *
 * Tests for constants and resolveSubagentSessionEndedOutcome.
 */

import { describe, it, expect } from 'vitest';
import {
    SUBAGENT_TARGET_KIND_SUBAGENT,
    SUBAGENT_TARGET_KIND_ACP,
    SUBAGENT_ENDED_REASON_COMPLETE,
    SUBAGENT_ENDED_REASON_ERROR,
    SUBAGENT_ENDED_REASON_KILLED,
    SUBAGENT_ENDED_REASON_SESSION_RESET,
    SUBAGENT_ENDED_REASON_SESSION_DELETE,
    SUBAGENT_ENDED_OUTCOME_OK,
    SUBAGENT_ENDED_OUTCOME_ERROR,
    SUBAGENT_ENDED_OUTCOME_TIMEOUT,
    SUBAGENT_ENDED_OUTCOME_KILLED,
    SUBAGENT_ENDED_OUTCOME_RESET,
    SUBAGENT_ENDED_OUTCOME_DELETED,
    resolveSubagentSessionEndedOutcome,
} from './subagent-lifecycle-events.js';

describe('subagent lifecycle constants', () => {
    it('target kinds', () => {
        expect(SUBAGENT_TARGET_KIND_SUBAGENT).toBe('subagent');
        expect(SUBAGENT_TARGET_KIND_ACP).toBe('acp');
    });

    it('ended reasons', () => {
        expect(SUBAGENT_ENDED_REASON_COMPLETE).toBe('subagent-complete');
        expect(SUBAGENT_ENDED_REASON_ERROR).toBe('subagent-error');
        expect(SUBAGENT_ENDED_REASON_KILLED).toBe('subagent-killed');
        expect(SUBAGENT_ENDED_REASON_SESSION_RESET).toBe('session-reset');
        expect(SUBAGENT_ENDED_REASON_SESSION_DELETE).toBe('session-delete');
    });

    it('ended outcomes', () => {
        expect(SUBAGENT_ENDED_OUTCOME_OK).toBe('ok');
        expect(SUBAGENT_ENDED_OUTCOME_ERROR).toBe('error');
        expect(SUBAGENT_ENDED_OUTCOME_TIMEOUT).toBe('timeout');
        expect(SUBAGENT_ENDED_OUTCOME_KILLED).toBe('killed');
        expect(SUBAGENT_ENDED_OUTCOME_RESET).toBe('reset');
        expect(SUBAGENT_ENDED_OUTCOME_DELETED).toBe('deleted');
    });
});

describe('resolveSubagentSessionEndedOutcome', () => {
    it('maps session-reset to reset', () => {
        expect(resolveSubagentSessionEndedOutcome('session-reset')).toBe('reset');
    });

    it('maps session-delete to deleted', () => {
        expect(resolveSubagentSessionEndedOutcome('session-delete')).toBe('deleted');
    });
});
