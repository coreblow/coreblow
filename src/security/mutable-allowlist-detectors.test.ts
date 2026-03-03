import { describe, it, expect } from 'vitest';
import {
    isDiscordMutableAllowEntry,
    isSlackMutableAllowEntry,
    isGoogleChatMutableAllowEntry,
    isMSTeamsMutableAllowEntry,
    isMattermostMutableAllowEntry,
    isIrcMutableAllowEntry,
    isZalouserMutableGroupEntry,
} from './mutable-allowlist-detectors.js';

describe('isDiscordMutableAllowEntry', () => {
    it('rejects empty', () => expect(isDiscordMutableAllowEntry('')).toBe(false));
    it('rejects wildcard *', () => expect(isDiscordMutableAllowEntry('*')).toBe(false));
    it('rejects numeric Discord ID', () => expect(isDiscordMutableAllowEntry('123456789012345678')).toBe(false));
    it('rejects mention <@123>', () => expect(isDiscordMutableAllowEntry('<@123456>')).toBe(false));
    it('rejects mention <@!123>', () => expect(isDiscordMutableAllowEntry('<@!123456>')).toBe(false));
    it('rejects discord: with valid ID', () => expect(isDiscordMutableAllowEntry('discord:123456')).toBe(false));
    it('flags discord: with empty value', () => expect(isDiscordMutableAllowEntry('discord:')).toBe(true));
    it('flags user: with empty value', () => expect(isDiscordMutableAllowEntry('user:')).toBe(true));
    it('flags pk: with empty value', () => expect(isDiscordMutableAllowEntry('pk:')).toBe(true));
    it('flags freeform text', () => expect(isDiscordMutableAllowEntry('some display name')).toBe(true));
});

describe('isSlackMutableAllowEntry', () => {
    it('rejects empty', () => expect(isSlackMutableAllowEntry('')).toBe(false));
    it('rejects *', () => expect(isSlackMutableAllowEntry('*')).toBe(false));
    it('rejects valid Slack ID <@U12345678>', () => expect(isSlackMutableAllowEntry('<@U12345678>')).toBe(false));
    it('rejects bare Slack-style ID U12345678', () => expect(isSlackMutableAllowEntry('U12345678')).toBe(false));
    it('rejects slack:U12345678', () => expect(isSlackMutableAllowEntry('slack:U12345678')).toBe(false));
    it('flags freeform text', () => expect(isSlackMutableAllowEntry('john doe')).toBe(true));
});

describe('isGoogleChatMutableAllowEntry', () => {
    it('rejects empty', () => expect(isGoogleChatMutableAllowEntry('')).toBe(false));
    it('rejects *', () => expect(isGoogleChatMutableAllowEntry('*')).toBe(false));
    it('rejects prefixed without content', () => expect(isGoogleChatMutableAllowEntry('googlechat:')).toBe(false));
    it('flags entry with @ in it', () => expect(isGoogleChatMutableAllowEntry('user@example.com')).toBe(true));
    it('flags googlechat:users/user@example.com', () => expect(isGoogleChatMutableAllowEntry('googlechat:users/user@example.com')).toBe(true));
    it('rejects googlechat:1234567890 (numeric ID)', () => expect(isGoogleChatMutableAllowEntry('googlechat:1234567890')).toBe(false));
});

describe('isMSTeamsMutableAllowEntry', () => {
    it('rejects empty', () => expect(isMSTeamsMutableAllowEntry('')).toBe(false));
    it('rejects *', () => expect(isMSTeamsMutableAllowEntry('*')).toBe(false));
    it('flags freeform name with spaces', () => expect(isMSTeamsMutableAllowEntry('John Doe')).toBe(true));
    it('flags entry with @', () => expect(isMSTeamsMutableAllowEntry('user@domain.com')).toBe(true));
    it('rejects compact ID', () => expect(isMSTeamsMutableAllowEntry('abcdef123456')).toBe(false));
});

describe('isMattermostMutableAllowEntry', () => {
    it('rejects empty', () => expect(isMattermostMutableAllowEntry('')).toBe(false));
    it('rejects *', () => expect(isMattermostMutableAllowEntry('*')).toBe(false));
    it('rejects 26-char Mattermost ID', () => expect(isMattermostMutableAllowEntry('abcdefghijklmnopqrstuvwxyz')).toBe(false));
    it('rejects mattermost: prefixed 26-char ID', () => expect(isMattermostMutableAllowEntry('mattermost:abcdefghijklmnopqrstuvwxyz')).toBe(false));
    it('flags freeform name', () => expect(isMattermostMutableAllowEntry('john.doe')).toBe(true));
    it('flags @username', () => expect(isMattermostMutableAllowEntry('@johndoe')).toBe(true));
});

describe('isIrcMutableAllowEntry', () => {
    it('rejects empty', () => expect(isIrcMutableAllowEntry('')).toBe(false));
    it('rejects *', () => expect(isIrcMutableAllowEntry('*')).toBe(false));
    it('rejects hostmask with !', () => expect(isIrcMutableAllowEntry('nick!user@host')).toBe(false));
    it('rejects hostmask with @', () => expect(isIrcMutableAllowEntry('user@host')).toBe(false));
    it('flags simple nickname', () => expect(isIrcMutableAllowEntry('coolnick')).toBe(true));
    it('flags irc: prefixed nick', () => expect(isIrcMutableAllowEntry('irc:coolnick')).toBe(true));
});

describe('isZalouserMutableGroupEntry', () => {
    it('rejects empty', () => expect(isZalouserMutableGroupEntry('')).toBe(false));
    it('rejects *', () => expect(isZalouserMutableGroupEntry('*')).toBe(false));
    it('rejects numeric Zalo ID', () => expect(isZalouserMutableGroupEntry('123456789')).toBe(false));
    it('rejects zalouser:123456', () => expect(isZalouserMutableGroupEntry('zalouser:123456')).toBe(false));
    it('rejects g- prefixed group ID', () => expect(isZalouserMutableGroupEntry('zalouser:group:g-abc123')).toBe(false));
    it('flags freeform entry', () => expect(isZalouserMutableGroupEntry('some group name')).toBe(true));
    it('rejects empty after prefix stripping', () => expect(isZalouserMutableGroupEntry('zalouser:')).toBe(false));
});
