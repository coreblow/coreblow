// @ts-nocheck
/**
 * Whatsapp Runtime
 */
import { WhatsappExtension } from '../extension.js';
import { WhatsappChannelImpl } from './channel.js';

export class WhatsappRuntime {
  [k: string]: any;
  private extension: WhatsappExtension;
  private channels = new Map<string, WhatsappChannelImpl>();
  private running = false;

  constructor(extension: WhatsappExtension) {
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
      this.channels.set(id, new WhatsappChannelImpl(id));
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



// Runtime aliases
let _rt: WhatsappRuntime | undefined;
export function getWhatsAppRuntime(): WhatsappRuntime { if (!_rt) _rt = new WhatsappRuntime(); return _rt; }
export function setWhatsAppRuntime(r: WhatsappRuntime) { _rt = r; }
