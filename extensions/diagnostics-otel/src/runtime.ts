/**
 * DiagnosticsOtel Runtime
 */
import { DiagnosticsOtelExtension } from '../extension';
import { DiagnosticsOtelChannelImpl } from './channel';

export class DiagnosticsOtelRuntime {
  private extension: DiagnosticsOtelExtension;
  private channels = new Map<string, DiagnosticsOtelChannelImpl>();
  private running = false;

  constructor(extension: DiagnosticsOtelExtension) {
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
      this.channels.set(id, new DiagnosticsOtelChannelImpl(id));
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
