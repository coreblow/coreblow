/**
 * Msteams Extension
 */
export class MsteamsExtension {
  name = 'msteams';
  version = '0.1.0';

  async init(config: any) {
    return this;
  }

  async start() {
    return true;
  }

  async stop() {
    return true;
  }

  async handleMessage(message: any) {
    return { handled: true, extension: this.name };
  }

  async sendMessage(to: string, content: string) {
    return { sent: true, to, extension: this.name };
  }
}
