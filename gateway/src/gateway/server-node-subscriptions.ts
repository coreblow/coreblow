export class NodeSubscriptionManager {
    // Maps sessionKey -> Set of nodeIds
    private subscriptions = new Map<string, Set<string>>();

    subscribe(nodeId: string, sessionKey: string) {
        if (!this.subscriptions.has(sessionKey)) {
            this.subscriptions.set(sessionKey, new Set());
        }
        this.subscriptions.get(sessionKey)!.add(nodeId);
    }

    unsubscribe(nodeId: string, sessionKey: string) {
        const subs = this.subscriptions.get(sessionKey);
        if (subs) {
            subs.delete(nodeId);
            if (subs.size === 0) {
                this.subscriptions.delete(sessionKey);
            }
        }
    }

    getSubscribers(sessionKey: string): string[] {
        const subs = this.subscriptions.get(sessionKey);
        return subs ? Array.from(subs) : [];
    }

    // Clean up all subscriptions for a node when it disconnects
    handleNodeDisconnect(nodeId: string) {
        for (const [sessionKey, subs] of this.subscriptions.entries()) {
            if (subs.has(nodeId)) {
                subs.delete(nodeId);
                if (subs.size === 0) {
                    this.subscriptions.delete(sessionKey);
                }
            }
        }
    }
}
