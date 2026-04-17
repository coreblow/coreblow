/**
 * CoreBlow — Alert Manager
 *
 * Manages alert rules, firing conditions, escalation
 * policies, silencing, and alert history.
 */

/** Alert rule */
export interface AlertRule {
    id: string;
    name: string;
    metric: string;
    condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    severity: 'info' | 'warning' | 'critical';
    cooldownMs: number;
    enabled: boolean;
    lastFired?: number;
}

/** Fired alert */
export interface FiredAlert {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: string;
    value: number;
    threshold: number;
    message: string;
    firedAt: number;
    acknowledged: boolean;
    resolvedAt?: number;
}

/**
 * CoreBlow Alert Manager
 */
export class AlertManager {
    private rules = new Map<string, AlertRule>();
    private alerts: FiredAlert[] = [];
    private silenced = new Set<string>();
    private idCounter = 0;
    private alertCounter = 0;

    /**
     * Add an alert rule.
     */
    addRule(name: string, metric: string, condition: AlertRule['condition'], threshold: number, severity: AlertRule['severity'] = 'warning', cooldownMs: number = 60_000): string {
        const id = `rule-${++this.idCounter}`;
        this.rules.set(id, { id, name, metric, condition, threshold, severity, cooldownMs, enabled: true });
        return id;
    }

    /**
     * Evaluate a metric value against rules.
     */
    evaluate(metric: string, value: number): FiredAlert[] {
        const fired: FiredAlert[] = [];
        for (const rule of Array.from(this.rules.values())) {
            if (!rule.enabled || rule.metric !== metric || this.silenced.has(rule.id)) continue;
            if (rule.lastFired && Date.now() - rule.lastFired < rule.cooldownMs) continue;

            const triggered = this.checkCondition(value, rule.condition, rule.threshold);
            if (triggered) {
                rule.lastFired = Date.now();
                const alert: FiredAlert = {
                    id: `alert-${++this.alertCounter}`, ruleId: rule.id, ruleName: rule.name,
                    severity: rule.severity, value, threshold: rule.threshold,
                    message: `${rule.name}: ${metric} is ${value} (threshold: ${rule.condition} ${rule.threshold})`,
                    firedAt: Date.now(), acknowledged: false,
                };
                this.alerts.push(alert);
                fired.push(alert);
            }
        }
        return fired;
    }

    /**
     * Acknowledge an alert.
     */
    acknowledge(alertId: string): boolean {
        const alert = this.alerts.find((a) => a.id === alertId);
        if (!alert) return false;
        alert.acknowledged = true;
        return true;
    }

    /**
     * Resolve an alert.
     */
    resolve(alertId: string): boolean {
        const alert = this.alerts.find((a) => a.id === alertId);
        if (!alert) return false;
        alert.resolvedAt = Date.now();
        return true;
    }

    /**
     * Silence a rule.
     */
    silence(ruleId: string): void { this.silenced.add(ruleId); }

    /**
     * Unsilence a rule.
     */
    unsilence(ruleId: string): void { this.silenced.delete(ruleId); }

    /**
     * Get active (unresolved) alerts.
     */
    getActive(): FiredAlert[] { return this.alerts.filter((a) => !a.resolvedAt); }

    /**
     * Get alert history.
     */
    getHistory(limit?: number): FiredAlert[] { return this.alerts.slice(-(limit ?? 50)); }

    /** Count rules */
    countRules(): number { return this.rules.size; }

    // === Private ===
    private checkCondition(value: number, condition: AlertRule['condition'], threshold: number): boolean {
        switch (condition) {
            case 'gt': return value > threshold;
            case 'lt': return value < threshold;
            case 'eq': return value === threshold;
            case 'gte': return value >= threshold;
            case 'lte': return value <= threshold;
        }
    }
}
