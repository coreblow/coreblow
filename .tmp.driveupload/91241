/**
 * CoreBlow — Persona Engine
 *
 * Manages AI agent personas — pre-configured personality templates
 * with system prompts, tone settings, guardrails, and dynamic
 * persona switching per conversation.
 */

/** Persona definition */
export interface Persona {
    id: string;
    name: string;
    description?: string;
    systemPrompt: string;
    tone?: 'professional' | 'casual' | 'technical' | 'friendly' | 'formal';
    language?: string;
    maxTokens?: number;
    temperature?: number;
    guardrails?: {
        blockedTopics?: string[];
        maxResponseLength?: number;
        requireCitation?: boolean;
    };
    examples?: Array<{ user: string; assistant: string }>;
    metadata?: Record<string, unknown>;
}

/** Active persona state */
interface PersonaState {
    persona: Persona;
    activatedAt: number;
    messageCount: number;
}

/**
 * CoreBlow Persona Engine
 */
export class PersonaEngine {
    private personas = new Map<string, Persona>();
    private activePersonas = new Map<string, PersonaState>();

    constructor() {
        // Built-in personas
        this.register({
            id: 'default',
            name: 'CoreBlow Assistant',
            systemPrompt: 'You are CoreBlow, a helpful AI assistant. Be concise, accurate, and friendly.',
            tone: 'friendly',
            temperature: 0.7,
        });
        this.register({
            id: 'coder',
            name: 'Code Expert',
            systemPrompt: 'You are an expert software engineer. Provide clean, well-documented code with explanations. Use industry best practices.',
            tone: 'technical',
            temperature: 0.3,
        });
        this.register({
            id: 'analyst',
            name: 'Data Analyst',
            systemPrompt: 'You are a data analyst. Provide structured analysis with tables, charts recommendations, and data-driven insights.',
            tone: 'professional',
            temperature: 0.5,
        });
        this.register({
            id: 'creative',
            name: 'Creative Writer',
            systemPrompt: 'You are a creative writer. Be imaginative, use vivid language, and craft engaging narratives.',
            tone: 'casual',
            temperature: 0.9,
        });
    }

    /**
     * Register a persona.
     */
    register(persona: Persona): void {
        this.personas.set(persona.id, persona);
    }

    /**
     * Get a persona by ID.
     */
    get(id: string): Persona | null {
        return this.personas.get(id) ?? null;
    }

    /**
     * Activate a persona for a conversation.
     */
    activate(conversationId: string, personaId: string): boolean {
        const persona = this.personas.get(personaId);
        if (!persona) return false;
        this.activePersonas.set(conversationId, {
            persona,
            activatedAt: Date.now(),
            messageCount: 0,
        });
        return true;
    }

    /**
     * Get the active persona for a conversation.
     */
    getActive(conversationId: string): Persona | null {
        return this.activePersonas.get(conversationId)?.persona ?? null;
    }

    /**
     * Build system messages for a persona.
     */
    buildSystemMessages(conversationId: string): Array<{ role: 'system'; content: string }> {
        const state = this.activePersonas.get(conversationId);
        const persona = state?.persona ?? this.personas.get('default')!;
        const messages: Array<{ role: 'system'; content: string }> = [
            { role: 'system', content: persona.systemPrompt },
        ];

        if (persona.guardrails?.blockedTopics?.length) {
            messages.push({
                role: 'system',
                content: `Avoid discussing: ${persona.guardrails.blockedTopics.join(', ')}`,
            });
        }

        return messages;
    }

    /**
     * Get model parameters for a persona.
     */
    getModelParams(conversationId: string): { temperature: number; maxTokens: number } {
        const persona = this.getActive(conversationId) ?? this.personas.get('default')!;
        return {
            temperature: persona.temperature ?? 0.7,
            maxTokens: persona.maxTokens ?? 4096,
        };
    }

    /**
     * Deactivate persona for a conversation.
     */
    deactivate(conversationId: string): boolean {
        return this.activePersonas.delete(conversationId);
    }

    /**
     * List all personas.
     */
    list(): Array<{ id: string; name: string; tone?: string }> {
        return Array.from(this.personas.values()).map((p) => ({
            id: p.id,
            name: p.name,
            tone: p.tone,
        }));
    }

    /**
     * Delete a persona.
     */
    delete(id: string): boolean {
        if (id === 'default') return false; // Can't delete default
        return this.personas.delete(id);
    }
}
