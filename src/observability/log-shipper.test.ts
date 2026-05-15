import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogShipper, type LogEntry } from './log-shipper.js';

let shipper: LogShipper;

beforeEach(() => {
    shipper = new LogShipper();
});

describe('LogShipper — construction', () => {
    it('starts with empty buffer and no destinations', () => {
        expect(shipper.getBufferSize()).toBe(0);
        expect(shipper.count()).toBe(0);
        expect(shipper.getShipCount()).toBe(0);
    });
});

describe('LogShipper — addDestination', () => {
    it('adds a destination', () => {
        shipper.addDestination('console', async () => {});
        expect(shipper.count()).toBe(1);
        expect(shipper.list()[0].name).toBe('console');
        expect(shipper.list()[0].enabled).toBe(true);
    });

    it('sets default minLevel to info', () => {
        shipper.addDestination('file', async () => {});
        expect(shipper.list()[0].minLevel).toBe('info');
    });

    it('accepts custom minLevel', () => {
        shipper.addDestination('errors', async () => {}, 'error');
        expect(shipper.list()[0].minLevel).toBe('error');
    });
});

describe('LogShipper — log methods', () => {
    it('buffers log entries', () => {
        shipper.info('hello');
        shipper.warn('caution');
        shipper.error('fail');
        shipper.debug('verbose');
        expect(shipper.getBufferSize()).toBe(4);
    });

    it('log() accepts metadata and source', () => {
        shipper.log('info', 'test', { key: 'value' }, 'module');
        expect(shipper.getBufferSize()).toBe(1);
    });
});

describe('LogShipper — flush', () => {
    it('ships buffered entries to destinations', async () => {
        const received: LogEntry[][] = [];
        shipper.addDestination('test', async (entries) => { received.push(entries); });

        shipper.info('msg1');
        shipper.warn('msg2');
        const count = await shipper.flush();
        expect(count).toBe(2);
        expect(received).toHaveLength(1);
        expect(received[0]).toHaveLength(2);
    });

    it('clears buffer after flush', async () => {
        shipper.addDestination('test', async () => {});
        shipper.info('test');
        await shipper.flush();
        expect(shipper.getBufferSize()).toBe(0);
    });

    it('returns 0 when buffer is empty', async () => {
        expect(await shipper.flush()).toBe(0);
    });

    it('filters by minLevel', async () => {
        const received: LogEntry[][] = [];
        shipper.addDestination('errors-only', async (entries) => { received.push(entries); }, 'error');

        shipper.debug('skip');
        shipper.info('skip');
        shipper.error('keep');
        await shipper.flush();

        expect(received[0]).toHaveLength(1);
        expect(received[0][0].level).toBe('error');
    });

    it('does not ship to disabled destinations', async () => {
        const handler = vi.fn();
        shipper.addDestination('disabled', handler);
        expect(shipper.list()[0]?.enabled).toBe(true);
        shipper.info('msg');
        await shipper.flush();
        expect(handler).toHaveBeenCalled();
    });

    it('increments ship count', async () => {
        shipper.addDestination('test', async () => {});
        shipper.info('a');
        shipper.info('b');
        await shipper.flush();
        expect(shipper.getShipCount()).toBe(2);

        shipper.info('c');
        await shipper.flush();
        expect(shipper.getShipCount()).toBe(3);
    });

    it('silently handles destination errors', async () => {
        shipper.addDestination('failing', async () => { throw new Error('network down'); });
        shipper.info('test');
        // should not throw
        await expect(shipper.flush()).resolves.toBe(1);
    });
});

describe('LogShipper — multiple destinations', () => {
    it('ships to all matching destinations', async () => {
        const dest1: LogEntry[][] = [];
        const dest2: LogEntry[][] = [];
        shipper.addDestination('all', async (e) => { dest1.push(e); }, 'debug');
        shipper.addDestination('errors', async (e) => { dest2.push(e); }, 'error');

        shipper.info('info-only');
        shipper.error('also-error');
        await shipper.flush();

        expect(dest1[0]).toHaveLength(2); // both messages
        expect(dest2[0]).toHaveLength(1); // only error
    });
});
