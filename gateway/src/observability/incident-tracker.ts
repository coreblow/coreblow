/**
 * CoreBlow — Incident Tracker
 *
 * Tracks production incidents with severity, timeline,
 * postmortem notes, and resolution tracking.
 */

/** Incident */
export interface Incident {
    id: string;
    title: string;
    severity: 'sev1' | 'sev2' | 'sev3' | 'sev4';
    status: 'open' | 'investigating' | 'mitigated' | 'resolved';
    description: string;
    timeline: Array<{ action: string; timestamp: number; actor?: string }>;
    assignee?: string;
    createdAt: number;
    resolvedAt?: number;
    postmortem?: string;
}

/**
 * CoreBlow Incident Tracker
 */
export class IncidentTracker {
    private incidents = new Map<string, Incident>();
    private idCounter = 0;

    /**
     * Create an incident.
     */
    create(title: string, severity: Incident['severity'], description: string): Incident {
        const id = `inc-${++this.idCounter}`;
        const incident: Incident = {
            id, title, severity, status: 'open', description,
            timeline: [{ action: 'Incident created', timestamp: Date.now() }],
            createdAt: Date.now(),
        };
        this.incidents.set(id, incident);
        return incident;
    }

    /**
     * Update status.
     */
    updateStatus(id: string, status: Incident['status'], actor?: string): boolean {
        const inc = this.incidents.get(id);
        if (!inc) return false;
        inc.status = status;
        inc.timeline.push({ action: `Status changed to ${status}`, timestamp: Date.now(), actor });
        if (status === 'resolved') inc.resolvedAt = Date.now();
        return true;
    }

    /**
     * Assign.
     */
    assign(id: string, assignee: string): boolean {
        const inc = this.incidents.get(id);
        if (!inc) return false;
        inc.assignee = assignee;
        inc.timeline.push({ action: `Assigned to ${assignee}`, timestamp: Date.now() });
        return true;
    }

    /**
     * Add timeline entry.
     */
    addTimelineEntry(id: string, action: string, actor?: string): boolean {
        const inc = this.incidents.get(id);
        if (!inc) return false;
        inc.timeline.push({ action, timestamp: Date.now(), actor });
        return true;
    }

    /**
     * Add postmortem.
     */
    addPostmortem(id: string, postmortem: string): boolean {
        const inc = this.incidents.get(id);
        if (!inc) return false;
        inc.postmortem = postmortem;
        return true;
    }

    /**
     * Get active incidents.
     */
    getActive(): Incident[] {
        return Array.from(this.incidents.values()).filter((i) => i.status !== 'resolved');
    }

    /**
     * Get by severity.
     */
    getBySeverity(severity: Incident['severity']): Incident[] {
        return Array.from(this.incidents.values()).filter((i) => i.severity === severity);
    }

    /**
     * Get MTTR (mean time to resolve).
     */
    getMTTR(): number {
        const resolved = Array.from(this.incidents.values()).filter((i) => i.resolvedAt);
        if (resolved.length === 0) return 0;
        const total = resolved.reduce((s, i) => s + (i.resolvedAt! - i.createdAt), 0);
        return total / resolved.length;
    }

    /**
     * Get incident.
     */
    get(id: string): Incident | null { return this.incidents.get(id) ?? null; }

    /** Count */
    count(): number { return this.incidents.size; }
}
