/**
 * src/agents/persona.ts
 * Agent personality system — custom tone, language, behavior
 * SUPERIOR: CoreBlow = hardcoded personality; CoreBlow = dynamic personas + templates + per-channel
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('persona');

// ─── Types ────────────────────────────────────────────────────────

export type PersonaTone = 'professional' | 'casual' | 'friendly' | 'concise' | 'verbose' | 'academic' | 'playful';
export type PersonaLanguage = 'auto' | 'en' | 'id' | 'ja' | 'zh' | 'ko' | 'es' | 'fr' | 'de' | 'pt' | 'ar';

export interface PersonaConfig {
    id: string;
    name: string;
    description: string;
    /** Base system prompt */
    systemPrompt: string;
    /** Tone of voice */
    tone: PersonaTone;
    /** Response language */
    language: PersonaLanguage;
    /** Max response length hint */
    maxResponseLength?: 'short' | 'medium' | 'long' | 'unlimited';
    /** Expertise areas */
    expertise?: string[];
    /** Things to avoid */
    avoid?: string[];
    /** Custom instructions appended to system prompt */
    customInstructions?: string;
    /** Channel overrides — different behavior per channel */
    channelOverrides?: Record<string, Partial<PersonaConfig>>;
    /** Emoji usage level */
    emojiLevel?: 'none' | 'minimal' | 'moderate' | 'heavy';
    /** Whether to adapt tone based on user's style */
    adaptiveTone?: boolean;
}

// ─── Built-in Templates ──────────────────────────────────────────

const TEMPLATES: Record<string, PersonaConfig> = {
    default: {
        id: 'default',
        name: 'CoreBlow',
        description: 'General-purpose AI assistant',
        systemPrompt: 'You are CoreBlow, a helpful AI assistant. Be concise, accurate, and friendly.',
        tone: 'friendly',
        language: 'auto',
        maxResponseLength: 'medium',
        emojiLevel: 'minimal',
        adaptiveTone: true,
    },
    coder: {
        id: 'coder',
        name: 'CodeBot',
        description: 'Expert programmer and code reviewer',
        systemPrompt: `You are CodeBot, an expert programmer. Follow these rules:
- Always provide working code with proper error handling
- Use TypeScript/modern JS unless asked otherwise
- Explain complex logic with inline comments
- Suggest improvements and best practices
- Format code with proper indentation`,
        tone: 'professional',
        language: 'en',
        maxResponseLength: 'long',
        expertise: ['typescript', 'python', 'react', 'node.js', 'databases'],
        avoid: ['placeholder code', 'incomplete examples'],
        emojiLevel: 'none',
        adaptiveTone: false,
    },
    tutor: {
        id: 'tutor',
        name: 'TutorBot',
        description: 'Patient teacher that explains concepts step by step',
        systemPrompt: `You are TutorBot, a patient and encouraging teacher. Follow these rules:
- Break complex topics into simple steps
- Use analogies and examples from daily life
- Ask follow-up questions to check understanding
- Celebrate progress and encourage curiosity
- Adapt explanations to the learner's level`,
        tone: 'friendly',
        language: 'auto',
        maxResponseLength: 'long',
        emojiLevel: 'moderate',
        adaptiveTone: true,
    },
    concise: {
        id: 'concise',
        name: 'BriefBot',
        description: 'Ultra-concise responses, no fluff',
        systemPrompt: 'Respond as briefly as possible. No greetings, no filler. Just the answer.',
        tone: 'concise',
        language: 'auto',
        maxResponseLength: 'short',
        emojiLevel: 'none',
        adaptiveTone: false,
    },
    creative: {
        id: 'creative',
        name: 'CreativeBot',
        description: 'Creative writer and brainstormer',
        systemPrompt: `You are CreativeBot, a creative writer and brainstorming partner.
- Generate unique, imaginative ideas
- Use vivid language and storytelling
- Offer multiple options and variations
- Be playful and experimental`,
        tone: 'playful',
        language: 'auto',
        maxResponseLength: 'long',
        emojiLevel: 'moderate',
        adaptiveTone: true,
    },
    bahasa: {
        id: 'bahasa',
        name: 'AsistenAI',
        description: 'Asisten AI berbahasa Indonesia',
        systemPrompt: `Kamu adalah AsistenAI, asisten AI yang berbicara dalam Bahasa Indonesia.
- Selalu jawab dalam Bahasa Indonesia yang baik dan benar
- Gunakan bahasa yang mudah dipahami
- Berikan contoh yang relevan dengan konteks Indonesia`,
        tone: 'friendly',
        language: 'id',
        maxResponseLength: 'medium',
        emojiLevel: 'minimal',
        adaptiveTone: true,
    },
};

// ─── Persona Manager ─────────────────────────────────────────────

export class PersonaManager {
    private personas = new Map<string, PersonaConfig>();
    private activePersona: string = 'default';
    private sessionPersonas = new Map<string, string>(); // sessionId → personaId

    constructor() {
        // Load built-in templates
        for (const [id, template] of Object.entries(TEMPLATES)) {
            this.personas.set(id, template);
        }
    }

    /**
     * Get list of available template names
     */
    getTemplateNames(): string[] {
        return Object.keys(TEMPLATES);
    }

    /**
     * Create persona from a built-in template
     */
    fromTemplate(templateId: string, overrides?: Partial<PersonaConfig>): PersonaConfig {
        const template = TEMPLATES[templateId];
        if (!template) throw new Error(`Template not found: ${templateId}`);
        const persona = { ...template, ...overrides, id: overrides?.id || templateId };
        this.personas.set(persona.id, persona);
        return persona;
    }

    /**
     * Register a custom persona
     */
    register(config: PersonaConfig): void {
        this.personas.set(config.id, config);
        log.info({ id: config.id, name: config.name }, 'Persona registered');
    }

    /**
     * Set the global active persona
     */
    setActive(personaId: string): boolean {
        if (!this.personas.has(personaId)) return false;
        this.activePersona = personaId;
        log.info({ personaId }, 'Active persona changed');
        return true;
    }

    /**
     * Set persona for a specific session
     */
    setSessionPersona(sessionId: string, personaId: string): boolean {
        if (!this.personas.has(personaId)) return false;
        this.sessionPersonas.set(sessionId, personaId);
        return true;
    }

    /**
     * Get the effective persona for a session + channel
     */
    resolve(sessionId?: string, channel?: string): PersonaConfig {
        // Priority: session override → global active → default
        let personaId = this.activePersona;

        if (sessionId && this.sessionPersonas.has(sessionId)) {
            personaId = this.sessionPersonas.get(sessionId)!;
        }

        const persona = this.personas.get(personaId) ?? this.personas.get('default')!;

        // Apply channel overrides if present
        if (channel && persona.channelOverrides?.[channel]) {
            return { ...persona, ...persona.channelOverrides[channel], id: persona.id };
        }

        return persona;
    }

    /**
     * Build the full system prompt for a persona
     */
    buildSystemPrompt(persona: PersonaConfig): string {
        const parts: string[] = [persona.systemPrompt];

        // Tone instruction
        const toneMap: Record<PersonaTone, string> = {
            professional: 'Maintain a professional and polished tone.',
            casual: 'Use a casual, conversational tone.',
            friendly: 'Be warm and approachable.',
            concise: 'Be extremely brief and to the point.',
            verbose: 'Provide detailed, thorough explanations.',
            academic: 'Use an academic and analytical tone.',
            playful: 'Be creative and playful in your responses.',
        };
        if (toneMap[persona.tone]) parts.push(toneMap[persona.tone]);

        // Language instruction
        if (persona.language !== 'auto') {
            const langNames: Record<string, string> = {
                en: 'English', id: 'Bahasa Indonesia', ja: '日本語',
                zh: '中文', ko: '한국어', es: 'Español',
                fr: 'Français', de: 'Deutsch', pt: 'Português', ar: 'العربية',
            };
            parts.push(`Always respond in ${langNames[persona.language] || persona.language}.`);
        }

        // Length hint
        if (persona.maxResponseLength === 'short') parts.push('Keep responses under 100 words.');
        if (persona.maxResponseLength === 'long') parts.push('Provide thorough, detailed responses.');

        // Expertise
        if (persona.expertise?.length) {
            parts.push(`Your areas of expertise: ${persona.expertise.join(', ')}.`);
        }

        // Avoid
        if (persona.avoid?.length) {
            parts.push(`Avoid: ${persona.avoid.join(', ')}.`);
        }

        // Custom instructions
        if (persona.customInstructions) parts.push(persona.customInstructions);

        // Emoji
        if (persona.emojiLevel === 'none') parts.push('Do not use any emojis.');
        if (persona.emojiLevel === 'heavy') parts.push('Use emojis liberally throughout your responses.');

        return parts.join('\n');
    }

    /**
     * List all personas
     */
    list(): PersonaConfig[] {
        return [...this.personas.values()];
    }

    /**
     * Get a persona by ID
     */
    get(id: string): PersonaConfig | undefined {
        return this.personas.get(id);
    }

    /**
     * Remove a persona
     */
    remove(id: string): boolean {
        if (id === 'default') return false;
        if (this.activePersona === id) this.activePersona = 'default';
        return this.personas.delete(id);
    }

    /**
     * Get stats
     */
    getStats(): { total: number; active: string; templates: number; sessionOverrides: number } {
        return {
            total: this.personas.size,
            active: this.activePersona,
            templates: Object.keys(TEMPLATES).length,
            sessionOverrides: this.sessionPersonas.size,
        };
    }
}
