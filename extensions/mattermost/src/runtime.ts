// @ts-nocheck
/**
 * Mattermost Runtime
 */
import { MattermostExtension } from '../extension.js';
import { MattermostChannelImpl } from './channel.js';

export class MattermostRuntime {
  [k: string]: any;
  private extension: MattermostExtension;
  private channels = new Map<string, MattermostChannelImpl>();
  private running = false;

  constructor(extension: MattermostExtension) {
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
      this.channels.set(id, new MattermostChannelImpl(id));
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
let _rt: MattermostRuntime | undefined;
export function getMattermostRuntime(): MattermostRuntime { if (!_rt) _rt = new MattermostRuntime(); return _rt; }
export function setMattermostRuntime(r: MattermostRuntime) { _rt = r; }
