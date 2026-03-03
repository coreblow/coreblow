/**
 * ThreadOwnership Runtime
 */
import { ThreadOwnershipExtension } from '../extension.js';
import { ThreadOwnershipChannelImpl } from './channel.js';

export class ThreadOwnershipRuntime {
  [k: string]: any;
  private extension: ThreadOwnershipExtension;
  private channels = new Map<string, ThreadOwnershipChannelImpl>();
  private running = false;

  constructor(extension: ThreadOwnershipExtension) {
    this.extension = extension;
  }

  async start() {
    this.running = true;
    return this;
  }

  async stop() {
    this.running = false;
    for (const ch of this.channels.values()) await ch.disconnect();
    this.channels.clear();
  }

  isRunning() { return this.running; }

  getChannel(id: string) {
    if (!this.channels.has(id)) {
      this.channels.set(id, new ThreadOwnershipChannelImpl(id));
    }
    return this.channels.get(id)!;
  }

  async processMessage(channelId: string, message: any) {
    const channel = this.getChannel(channelId);
    return { channelId, processed: true, extension: this.extension.name };
  }

  async handleWebhook(payload: any) {
    return { handled: true, extension: this.extension.name };
  }
}
