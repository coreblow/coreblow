// @ts-nocheck
/**
 * NextcloudTalk Runtime
 */
import { NextcloudTalkExtension } from '../extension.js';
import { NextcloudTalkChannelImpl } from './channel.js';

export class NextcloudTalkRuntime {
  [k: string]: any;
  private extension: NextcloudTalkExtension;
  private channels = new Map<string, NextcloudTalkChannelImpl>();
  private running = false;

  constructor(extension: NextcloudTalkExtension) {
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
      this.channels.set(id, new NextcloudTalkChannelImpl(id));
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
let _rt: NextcloudTalkRuntime | undefined;
export function getNextcloudTalkRuntime(): NextcloudTalkRuntime { if (!_rt) _rt = new NextcloudTalkRuntime(); return _rt; }
export function setNextcloudTalkRuntime(r: NextcloudTalkRuntime) { _rt = r; }
