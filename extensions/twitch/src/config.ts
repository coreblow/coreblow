/**
 * Twitch Configuration
 */
export interface TwitchConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class TwitchConfig {
  private options: TwitchConfigOptions;

  constructor(options: Partial<TwitchConfigOptions> = {}) {
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
      throw new Error('twitch: token is required when enabled');
    }
    return true;
  }
}
