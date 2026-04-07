/**
 * Discord Configuration
 */
export interface DiscordConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class DiscordConfig {
  private options: DiscordConfigOptions;

  constructor(options: Partial<DiscordConfigOptions> = {}) {
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
      throw new Error('discord: token is required when enabled');
    }
    return true;
  }
}
