// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    ErrorCodes,
    PROTOCOL_VERSION,
    errorShape,
    validateRequestFrame,
    validateResponseFrame,
    validateEventFrame,
    formatValidationErrors,
    buildObjectValidator,
    validateWakeParams,
    validateChatSendParams,
    validateSessionsDeleteParams,
} from './index.js';
import {
    ConnectErrorDetailCodes,
    resolveAuthConnectErrorDetailCode,
    resolveDeviceAuthConnectErrorDetailCode,
    readConnectErrorDetailCode,
    readConnectErrorRecoveryAdvice,
} from './connect-error-details.js';

describe('Gateway Protocol — Phase 17', () => {

    // ─── Constants ─────────────────────────────────────────────

    it('protocol version is 3', () => expect(PROTOCOL_VERSION).toBe(3));

    it('error codes are defined', () => {
        expect(ErrorCodes.INVALID_REQUEST).toBe('invalid_request');
        expect(ErrorCodes.UNAUTHORIZED).toBe('unauthorized');
        expect(ErrorCodes.UNAVAILABLE).toBe('unavailable');
        expect(ErrorCodes.NOT_FOUND).toBe('not_found');
        expect(ErrorCodes.INTERNAL_ERROR).toBe('internal_error');
    });

    // ─── errorShape ────────────────────────────────────────────

    describe('errorShape', () => {
        it('creates error without details', () => {
            const e = errorShape('not_found', 'missing');
            expect(e).toEqual({ code: 'not_found', message: 'missing' });
        });

        it('creates error with details', () => {
            const e = errorShape('internal_error', 'boom', { stack: 'x' });
            expect(e.details).toEqual({ stack: 'x' });
        });
    });

    // ─── Frame Validators ──────────────────────────────────────

    describe('validateRequestFrame', () => {
        it('validates req frame', () => expect(validateRequestFrame({ type: 'req', id: '1', method: 'test' })).toBe(true));
        it('rejects non-object', () => expect(validateRequestFrame('string')).toBe(false));
        it('rejects array', () => expect(validateRequestFrame([1, 2])).toBe(false));
        it('rejects wrong type', () => expect(validateRequestFrame({ type: 'res' })).toBe(false));
    });

    describe('validateResponseFrame', () => {
        it('validates res frame', () => expect(validateResponseFrame({ type: 'res', id: '1', ok: true })).toBe(true));
        it('rejects null', () => expect(validateResponseFrame(null)).toBe(false));
    });

    describe('validateEventFrame', () => {
        it('validates evt frame', () => expect(validateEventFrame({ type: 'evt', event: 'tick' })).toBe(true));
        it('validates event-only (no type)', () => expect(validateEventFrame({ event: 'connect.challenge' })).toBe(true));
        it('accepts type=evt even without event field', () => expect(validateEventFrame({ type: 'evt' })).toBe(true));
        it('rejects plain object', () => expect(validateEventFrame({ foo: 'bar' })).toBe(false));
    });

    // ─── formatValidationErrors ────────────────────────────────

    describe('formatValidationErrors', () => {
        it('returns message for empty', () => expect(formatValidationErrors()).toBe('Unknown validation error'));
        it('formats path errors', () => {
            const result = formatValidationErrors([{ path: 'name', message: 'required' }]);
            expect(result).toBe('name: required');
        });
        it('formats pathless errors', () => {
            const result = formatValidationErrors([{ message: 'bad' }]);
            expect(result).toBe('bad');
        });
    });

    // ─── buildObjectValidator ──────────────────────────────────

    describe('buildObjectValidator', () => {
        it('validates required fields', () => {
            const v = buildObjectValidator({ required: ['name'] });
            expect(v({ name: 'foo' })).toBe(true);
            expect(v({})).toBe(false);
        });

        it('validates property types', () => {
            const v = buildObjectValidator({ properties: { count: { type: 'number' } } });
            expect(v({ count: 5 })).toBe(true);
            expect(v({ count: 'five' })).toBe(false);
        });

        it('validates enum', () => {
            const v = buildObjectValidator({ properties: { mode: { type: 'string', enum: ['a', 'b'] } } });
            expect(v({ mode: 'a' })).toBe(true);
            expect(v({ mode: 'c' })).toBe(false);
        });

        it('rejects non-object', () => {
            const v = buildObjectValidator({});
            expect(v(null)).toBe(false);
            expect(v('string')).toBe(false);
        });
    });

    // ─── Built-in Validators ───────────────────────────────────

    describe('built-in validators', () => {
        it('validateWakeParams requires mode and text', () => {
            expect(validateWakeParams({ mode: 'now', text: 'hello' })).toBe(true);
            expect(validateWakeParams({})).toBe(false);
        });

        it('validateChatSendParams requires sessionKey and message', () => {
            expect(validateChatSendParams({ sessionKey: 'k', message: 'hi' })).toBe(true);
            expect(validateChatSendParams({})).toBe(false);
        });

        it('validateSessionsDeleteParams requires key', () => {
            expect(validateSessionsDeleteParams({ key: 'sess-1' })).toBe(true);
            expect(validateSessionsDeleteParams({})).toBe(false);
        });
    });
});

describe('Connect Error Details — Phase 17', () => {

    it('has all error detail codes', () => {
        expect(ConnectErrorDetailCodes.AUTH_TOKEN_MISSING).toBe('AUTH_TOKEN_MISSING');
        expect(ConnectErrorDetailCodes.PAIRING_REQUIRED).toBe('PAIRING_REQUIRED');
    });

    describe('resolveAuthConnectErrorDetailCode', () => {
        it('maps token_missing', () => expect(resolveAuthConnectErrorDetailCode('token_missing')).toBe('AUTH_TOKEN_MISSING'));
        it('maps token_mismatch', () => expect(resolveAuthConnectErrorDetailCode('token_mismatch')).toBe('AUTH_TOKEN_MISMATCH'));
        it('maps password_missing', () => expect(resolveAuthConnectErrorDetailCode('password_missing')).toBe('AUTH_PASSWORD_MISSING'));
        it('maps rate_limited', () => expect(resolveAuthConnectErrorDetailCode('rate_limited')).toBe('AUTH_RATE_LIMITED'));
        it('maps undefined to AUTH_REQUIRED', () => expect(resolveAuthConnectErrorDetailCode(undefined)).toBe('AUTH_REQUIRED'));
        it('maps unknown to AUTH_UNAUTHORIZED', () => expect(resolveAuthConnectErrorDetailCode('unknown')).toBe('AUTH_UNAUTHORIZED'));
    });

    describe('resolveDeviceAuthConnectErrorDetailCode', () => {
        it('maps device-id-mismatch', () => expect(resolveDeviceAuthConnectErrorDetailCode('device-id-mismatch')).toBe('DEVICE_AUTH_DEVICE_ID_MISMATCH'));
        it('maps device-signature', () => expect(resolveDeviceAuthConnectErrorDetailCode('device-signature')).toBe('DEVICE_AUTH_SIGNATURE_INVALID'));
        it('maps unknown to DEVICE_AUTH_INVALID', () => expect(resolveDeviceAuthConnectErrorDetailCode('x')).toBe('DEVICE_AUTH_INVALID'));
    });

    describe('readConnectErrorDetailCode', () => {
        it('reads code from details', () => expect(readConnectErrorDetailCode({ code: 'AUTH_TOKEN_MISSING' })).toBe('AUTH_TOKEN_MISSING'));
        it('returns null for non-object', () => expect(readConnectErrorDetailCode(null)).toBeNull());
        it('returns null for empty code', () => expect(readConnectErrorDetailCode({ code: '' })).toBeNull());
        it('returns null for array', () => expect(readConnectErrorDetailCode([1])).toBeNull());
    });

    describe('readConnectErrorRecoveryAdvice', () => {
        it('reads valid advice', () => {
            const advice = readConnectErrorRecoveryAdvice({
                canRetryWithDeviceToken: true,
                recommendedNextStep: 'retry_with_device_token',
            });
            expect(advice.canRetryWithDeviceToken).toBe(true);
            expect(advice.recommendedNextStep).toBe('retry_with_device_token');
        });

        it('ignores invalid nextStep', () => {
            const advice = readConnectErrorRecoveryAdvice({ recommendedNextStep: 'invalid' });
            expect(advice.recommendedNextStep).toBeUndefined();
        });

        it('returns empty for null', () => {
            expect(readConnectErrorRecoveryAdvice(null)).toEqual({});
        });
    });
});
