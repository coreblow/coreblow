// @ts-nocheck
/**
 * Irc Runtime
 */
import { IrcExtension } from '../extension.js';
import { IrcChannelImpl } from './channel.js';

export class IrcRuntime {
  [k: string]: any;
  private extension: IrcExtension;
  private channels = new Map<string, IrcChannelImpl>();
  private running = false;

  constructor(extension: IrcExtension) {
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
      this.channels.set(id, new IrcChannelImpl(id));
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
let _rt: IrcRuntime | undefined;
export function getIrcRuntime(): IrcRuntime { if (!_rt) _rt = new IrcRuntime(); return _rt; }
export function setIrcRuntime(r: IrcRuntime) { _rt = r; }
