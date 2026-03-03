/**
 * cli/banner.ts
 * Startup banner with version, tagline, and config summary.
 * Ported from CoreBlow reference src/cli/banner.ts.
 */

import pkg from '../../package.json' with { type: 'json' };
const { version } = pkg;

export type TaglineMode = 'random' | 'default' | 'off';

const TAGLINES = [
    '🧠 Thinking at the speed of light',
    '🚀 Multi-agent orchestration, reimagined',
    '🔒 Security-first AI gateway',
    '⚡ Your AI, your rules',
    '🌐 Connect any channel, any model',
    '🔧 Built for operators, loved by developers',
    '🎯 Production-grade from day one',
    '💎 Diamond-cut code quality',
    '🌊 Riding the wave of AI innovation',
    '🔥 Blazingly fast, unfailingly reliable',
];

const graphemeSegmenter =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;

function splitGraphemes(value: string): string[] {
    if (!graphemeSegmenter) return Array.from(value);
    try { return Array.from(graphemeSegmenter.segment(value), (seg) => seg.segment); }
    catch { return Array.from(value); }
}

function visibleWidth(text: string): number {
    // Strip ANSI escape codes
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
    return splitGraphemes(stripped).length;
}

export function pickTagline(mode: TaglineMode = 'random'): string {
    if (mode === 'off') return '';
    if (mode === 'default') return TAGLINES[0];
    return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

export interface BannerOptions {
    taglineMode?: TaglineMode;
    columns?: number;
    commit?: string | null;
    richTty?: boolean;
    noColor?: boolean;
}

let bannerEmitted = false;

export function formatBanner(opts?: BannerOptions): string {
    const cols = opts?.columns ?? process.stdout.columns ?? 80;
    const rich = opts?.richTty ?? process.stdout.isTTY ?? false;
    const useColor = rich && !opts?.noColor;

    const ver = `v${version}`;
    const tag = pickTagline(opts?.taglineMode ?? 'random');
    const commitSuffix = opts?.commit ? ` (${opts.commit.slice(0, 7)})` : '';

    const bold = useColor ? '\x1b[1m' : '';
    const dim = useColor ? '\x1b[2m' : '';
    const cyan = useColor ? '\x1b[36m' : '';
    const reset = useColor ? '\x1b[0m' : '';
    const yellow = useColor ? '\x1b[33m' : '';

    const logo = `${bold}${cyan}╔═══════════════════════════╗${reset}`;
    const title = `${bold}${cyan}║     COREBLOW GATEWAY      ║${reset}`;
    const border = `${bold}${cyan}╚═══════════════════════════╝${reset}`;
    const versionLine = `  ${dim}${ver}${commitSuffix}${reset}`;
    const taglineLine = tag ? `  ${yellow}${tag}${reset}` : '';

    const lines = [logo, title, border, versionLine];
    if (taglineLine) lines.push(taglineLine);
    lines.push('');

    return lines.join('\n');
}

export function emitBanner(opts?: BannerOptions): void {
    if (bannerEmitted) return;
    bannerEmitted = true;
    process.stderr.write(formatBanner(opts));
}

export function resetBannerState(): void {
    bannerEmitted = false;
}

export function hasJsonFlag(argv: string[]): boolean {
    return argv.some((arg) => arg === '--json' || arg.startsWith('--json='));
}

export function hasVersionFlag(argv: string[]): boolean {
    return argv.some((arg) => arg === '--version' || arg === '-V');
}

export function hasQuietFlag(argv: string[]): boolean {
    return argv.some((arg) => arg === '--quiet' || arg === '-q');
}
