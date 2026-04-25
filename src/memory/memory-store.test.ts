import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from './memory-store.js';

let store: MemoryStore;

beforeEach(() => {
    store = new MemoryStore();
});

describe('MemoryStore — construction', () => {
    it('constructs with no conversations', () => {
        const stats = store.getStats();
        expect(stats.conversations).toBe(0);
        expect(stats.totalMessages).toBe(0);
    });
});

describe('MemoryStore — create', () => {
    it('creates a conversation with unique id', () => {
        const conv = store.create('Test Chat');
        expect(conv.id).toBeTruthy();
        expect(conv.title).toBe('Test Chat');
        expect(conv.messages).toEqual([]);
        expect(conv.createdAt).toBeGreaterThan(0);
    });

    it('creates multiple conversations with distinct ids', () => {
        const c1 = store.create();
        const c2 = store.create();
        expect(c1.id).not.toBe(c2.id);
    });

    it('stores metadata', () => {
        const conv = store.create('Chat', { channel: 'discord' });
        expect(conv.metadata).toEqual({ channel: 'discord' });
    });
});

describe('MemoryStore — addMessage / getMessages', () => {
    it('adds a message and retrieves it', () => {
        const conv = store.create();
        const msg = store.addMessage(conv.id, 'user', 'Hello!');
        expect(msg).not.toBeNull();
        expect(msg!.role).toBe('user');
        expect(msg!.content).toBe('Hello!');

        const messages = store.getMessages(conv.id);
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe('Hello!');
    });

    it('returns null for unknown conversation', () => {
        expect(store.addMessage('fake-id', 'user', 'test')).toBeNull();
    });

    it('returns empty array for unknown conversation messages', () => {
        expect(store.getMessages('fake-id')).toEqual([]);
    });

    it('respects limit parameter', () => {
        const conv = store.create();
        for (let i = 0; i < 10; i++) {
            store.addMessage(conv.id, 'user', `msg-${i}`);
        }
        const recent = store.getMessages(conv.id, 3);
        expect(recent).toHaveLength(3);
        expect(recent[0].content).toBe('msg-7');
    });

    it('adds metadata to messages', () => {
        const conv = store.create();
        const msg = store.addMessage(conv.id, 'assistant', 'response', { model: 'gpt-4' });
        expect(msg!.metadata).toEqual({ model: 'gpt-4' });
    });
});

describe('MemoryStore — get', () => {
    it('retrieves conversation by id', () => {
        const conv = store.create('Lookup Test');
        expect(store.get(conv.id)?.title).toBe('Lookup Test');
    });

    it('returns null for unknown id', () => {
        expect(store.get('nonexistent')).toBeNull();
    });
});

describe('MemoryStore — search', () => {
    it('finds messages matching query across conversations', () => {
        const c1 = store.create();
        const c2 = store.create();
        store.addMessage(c1.id, 'user', 'I love TypeScript');
        store.addMessage(c2.id, 'user', 'Python is great');
        store.addMessage(c2.id, 'assistant', 'TypeScript is also great');

        const results = store.search('TypeScript');
        expect(results).toHaveLength(2);
    });

    it('is case-insensitive', () => {
        const c = store.create();
        store.addMessage(c.id, 'user', 'Hello WORLD');
        const results = store.search('hello world');
        expect(results).toHaveLength(1);
    });

    it('respects limit', () => {
        const c = store.create();
        for (let i = 0; i < 5; i++) store.addMessage(c.id, 'user', 'match');
        const results = store.search('match', 2);
        expect(results).toHaveLength(2);
    });
});

describe('MemoryStore — summarize', () => {
    it('generates summary from default summarizer', async () => {
        const c = store.create();
        store.addMessage(c.id, 'user', 'msg1');
        store.addMessage(c.id, 'assistant', 'msg2');
        const summary = await store.summarize(c.id);
        expect(summary).toBe('Summary of 2 messages');
        expect(store.get(c.id)?.summary).toBe('Summary of 2 messages');
    });

    it('returns null for unknown conversation', async () => {
        expect(await store.summarize('fake')).toBeNull();
    });

    it('returns null for empty conversation', async () => {
        const c = store.create();
        expect(await store.summarize(c.id)).toBeNull();
    });

    it('uses custom summarizer', async () => {
        const custom = new MemoryStore({
            summarizer: async (msgs) => `Custom: ${msgs.length}`,
        });
        const c = custom.create();
        custom.addMessage(c.id, 'user', 'hi');
        const summary = await custom.summarize(c.id);
        expect(summary).toBe('Custom: 1');
    });
});

describe('MemoryStore — list', () => {
    it('lists conversations sorted by updatedAt desc', () => {
        const c1 = store.create('First');
        store.create('Second');
        // update c1 to be newest
        store.addMessage(c1.id, 'user', 'update');
        const list = store.list();
        expect(list[0].title).toBe('First');
    });

    it('respects limit', () => {
        for (let i = 0; i < 10; i++) store.create(`Chat ${i}`);
        expect(store.list(3)).toHaveLength(3);
    });
});

describe('MemoryStore — delete', () => {
    it('deletes a conversation', () => {
        const c = store.create();
        expect(store.delete(c.id)).toBe(true);
        expect(store.get(c.id)).toBeNull();
    });

    it('returns false for unknown conversation', () => {
        expect(store.delete('fake')).toBe(false);
    });
});

describe('MemoryStore — enforceLimit', () => {
    it('evicts oldest conversations when limit exceeded', () => {
        const limited = new MemoryStore({ maxConversations: 3 });
        const ids: string[] = [];
        for (let i = 0; i < 5; i++) {
            ids.push(limited.create(`Chat ${i}`).id);
        }
        expect(limited.getStats().conversations).toBe(3);
        // First two should be evicted
        expect(limited.get(ids[0]!)).toBeNull();
        expect(limited.get(ids[1]!)).toBeNull();
    });
});
