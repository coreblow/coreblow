/**
 * CoreBlow — State Machine
 *
 * Finite state machine for managing complex state
 * transitions with guards, actions, and history.
 */

/** Transition */
export interface Transition {
    from: string;
    to: string;
    event: string;
    guard?: (ctx: Record<string, unknown>) => boolean;
    action?: (ctx: Record<string, unknown>) => void;
}

/** State machine definition */
export interface StateMachineDef {
    id: string;
    initialState: string;
    states: string[];
    transitions: Transition[];
}

/** Machine instance */
export interface MachineInstance {
    id: string;
    definitionId: string;
    currentState: string;
    context: Record<string, unknown>;
    history: Array<{ from: string; to: string; event: string; timestamp: number }>;
    createdAt: number;
}

/**
 * CoreBlow State Machine
 */
export class StateMachine {
    private definitions = new Map<string, StateMachineDef>();
    private instances = new Map<string, MachineInstance>();
    private idCounter = 0;

    /**
     * Register a machine definition.
     */
    define(def: StateMachineDef): void {
        this.definitions.set(def.id, def);
    }

    /**
     * Create a new instance.
     */
    create(definitionId: string, context?: Record<string, unknown>): MachineInstance | null {
        const def = this.definitions.get(definitionId);
        if (!def) return null;

        const instance: MachineInstance = {
            id: `sm-${++this.idCounter}`, definitionId,
            currentState: def.initialState,
            context: context ?? {}, history: [], createdAt: Date.now(),
        };
        this.instances.set(instance.id, instance);
        return instance;
    }

    /**
     * Send an event to transition.
     */
    send(instanceId: string, event: string): { success: boolean; newState?: string; error?: string } {
        const instance = this.instances.get(instanceId);
        if (!instance) return { success: false, error: 'Instance not found' };

        const def = this.definitions.get(instance.definitionId);
        if (!def) return { success: false, error: 'Definition not found' };

        const transition = def.transitions.find((t) => t.from === instance.currentState && t.event === event);
        if (!transition) return { success: false, error: `No transition for event "${event}" from state "${instance.currentState}"` };

        // Check guard
        if (transition.guard && !transition.guard(instance.context)) {
            return { success: false, error: 'Guard condition failed' };
        }

        // Execute action
        if (transition.action) transition.action(instance.context);

        // Transition
        const from = instance.currentState;
        instance.currentState = transition.to;
        instance.history.push({ from, to: transition.to, event, timestamp: Date.now() });

        return { success: true, newState: transition.to };
    }

    /**
     * Get current state.
     */
    getState(instanceId: string): string | null {
        return this.instances.get(instanceId)?.currentState ?? null;
    }

    /**
     * Get instance.
     */
    getInstance(instanceId: string): MachineInstance | null {
        return this.instances.get(instanceId) ?? null;
    }

    /**
     * Get available events for current state.
     */
    getAvailableEvents(instanceId: string): string[] {
        const instance = this.instances.get(instanceId);
        if (!instance) return [];
        const def = this.definitions.get(instance.definitionId);
        if (!def) return [];
        return def.transitions.filter((t) => t.from === instance.currentState).map((t) => t.event);
    }

    /** Count instances */
    count(): number { return this.instances.size; }
}
