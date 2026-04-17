/**
 * CoreBlow — Message Broker
 *
 * In-memory message broker with queues, consumers,
 * acknowledgment, retry, and priority support.
 */

/** Message */
export interface BrokerMessage {
    id: string;
    queue: string;
    payload: unknown;
    priority: number;
    attempts: number;
    maxAttempts: number;
    createdAt: number;
    processedAt?: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

/** Consumer */
export interface Consumer {
    id: string;
    queue: string;
    handler: (msg: BrokerMessage) => Promise<boolean>;
}

/**
 * CoreBlow Message Broker
 */
export class MessageBroker {
    private queues = new Map<string, BrokerMessage[]>();
    private consumers = new Map<string, Consumer[]>();
    private idCounter = 0;
    private stats = { published: 0, consumed: 0, failed: 0, retried: 0 };

    /**
     * Publish a message.
     */
    publish(queue: string, payload: unknown, priority: number = 0, maxAttempts: number = 3): BrokerMessage {
        if (!this.queues.has(queue)) this.queues.set(queue, []);
        const msg: BrokerMessage = {
            id: `msg-${++this.idCounter}`, queue, payload, priority, attempts: 0,
            maxAttempts, createdAt: Date.now(), status: 'pending',
        };
        this.queues.get(queue)!.push(msg);
        this.queues.get(queue)!.sort((a, b) => b.priority - a.priority);
        this.stats.published++;
        return msg;
    }

    /**
     * Subscribe a consumer.
     */
    subscribe(queue: string, handler: Consumer['handler']): string {
        if (!this.consumers.has(queue)) this.consumers.set(queue, []);
        const id = `consumer-${++this.idCounter}`;
        this.consumers.get(queue)!.push({ id, queue, handler });
        return id;
    }

    /**
     * Process next message in queue.
     */
    async processNext(queue: string): Promise<BrokerMessage | null> {
        const messages = this.queues.get(queue);
        const consumers = this.consumers.get(queue);
        if (!messages || !consumers || consumers.length === 0) return null;

        const msg = messages.find((m) => m.status === 'pending');
        if (!msg) return null;

        msg.status = 'processing';
        msg.attempts++;
        const consumer = consumers[0]!;

        try {
            const success = await consumer.handler(msg);
            if (success) {
                msg.status = 'completed';
                msg.processedAt = Date.now();
                this.stats.consumed++;
            } else {
                if (msg.attempts >= msg.maxAttempts) { msg.status = 'failed'; this.stats.failed++; }
                else { msg.status = 'pending'; this.stats.retried++; }
            }
        } catch {
            if (msg.attempts >= msg.maxAttempts) { msg.status = 'failed'; this.stats.failed++; }
            else { msg.status = 'pending'; this.stats.retried++; }
        }

        return msg;
    }

    /**
     * Get queue depth.
     */
    depth(queue: string): number {
        return this.queues.get(queue)?.filter((m) => m.status === 'pending').length ?? 0;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List queues.
     */
    listQueues(): Array<{ name: string; depth: number; consumers: number }> {
        const result: Array<{ name: string; depth: number; consumers: number }> = [];
        for (const [name, msgs] of Array.from(this.queues)) {
            result.push({ name, depth: msgs.filter((m) => m.status === 'pending').length, consumers: this.consumers.get(name)?.length ?? 0 });
        }
        return result;
    }
}
