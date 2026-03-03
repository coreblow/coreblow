/**
 * SynologyChat Configuration
 */
export interface SynologyChatConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class SynologyChatConfig {
  private options: SynologyChatConfigOptions;

  constructor(options: Partial<SynologyChatConfigOptions> = {}) {
    this.options = {
      enabled: true,
      debug: false,
      ...options,
    };
  }

  get enabled() { return this.options.enabled; }
  get token() { return this.options.token; }
  get debug() { return this.options.debug; }

  validate() {
    if (this.options.enabled && !this.options.token) {
      throw new Error('synology-chat: token is required when enabled');
    }
    return true;
  }
}
