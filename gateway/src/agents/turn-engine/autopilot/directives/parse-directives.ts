import type { Directive } from '../directive.types.js';
import type { DirectiveResult } from '../directive.types.js';
const INLINE_MODEL_RE = /\[model:([^\]]+)\]/gi;
const INLINE_PROVIDER_RE = /\[provider:([^\]]+)\]/gi;
const INLINE_THINK_RE = /\[think:([^\]]+)\]/gi;
export function parseDirectives(text: string): DirectiveResult {
    const directives: Directive[] = [];
    let cleanedText = text;
    let modelOverride: string | undefined;
    let providerOverride: string | undefined;
    let thinkLevel: string | undefined;
    let match;
    while ((match = INLINE_MODEL_RE.exec(text)) !== null) {
        modelOverride = match[1]!.trim();
        directives.push({ type: 'model', key: 'model', value: modelOverride, raw: match[0] });
        cleanedText = cleanedText.replace(match[0], '').trim();
    }
    while ((match = INLINE_PROVIDER_RE.exec(text)) !== null) {
        providerOverride = match[1]!.trim();
        directives.push({ type: 'provider', key: 'provider', value: providerOverride, raw: match[0] });
        cleanedText = cleanedText.replace(match[0], '').trim();
    }
    while ((match = INLINE_THINK_RE.exec(text)) !== null) {
        thinkLevel = match[1]!.trim();
        directives.push({ type: 'think', key: 'think', value: thinkLevel, raw: match[0] });
        cleanedText = cleanedText.replace(match[0], '').trim();
    }
    if (modelOverride && modelOverride.includes('/') && !providerOverride) {
        const [prov, model] = modelOverride.split('/');
        providerOverride = prov; modelOverride = model;
    }
    return { directives, cleanedText: cleanedText.trim(), modelOverride, providerOverride, thinkLevel };
}
