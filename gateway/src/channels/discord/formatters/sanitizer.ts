/**
 * Discord Sanitizer — Removes potentially dangerous content for safe embed rendering.
 */
export function sanitize(text: string): string {
    return text.replace(/@everyone/g, '@\u200beveryone').replace(/@here/g, '@\u200bhere');
}

export function escapeMarkdown(text: string): string {
    return text.replace(/([*_~`|\\])/g, '\\$1');
}

export function stripMentions(text: string): string {
    return text.replace(/<@!?\d+>/g, '[user]').replace(/<@&\d+>/g, '[role]').replace(/<#\d+>/g, '[channel]');
}

export function sanitizeEmbed(text: string, maxLength: number = 4096): string {
    return sanitize(text).slice(0, maxLength);
}