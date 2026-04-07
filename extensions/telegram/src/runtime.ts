/**
 * Telegram Runtime
 */
import { TelegramExtension } from '../extension';
import { TelegramChannelImpl } from './channel';

export class TelegramRuntime {
  private extension: TelegramExtension;
  private channels = new Map<string, TelegramChannelImpl>();
  private running = false;

  constructor(extension: TelegramExtension) {
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
      this.channels.set(id, new TelegramChannelImpl(id));
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
