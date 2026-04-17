/**
 * Nostr Configuration
 */
export interface NostrConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class NostrConfig {
  private options: NostrConfigOptions;

  constructor(options: Partial<NostrConfigOptions> = {}) {
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
      throw new Error('nostr: token is required when enabled');
    }
    return true;
  }
}
