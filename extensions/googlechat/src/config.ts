/**
 * Googlechat Configuration
 */
export interface GooglechatConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class GooglechatConfig {
  private options: GooglechatConfigOptions;

  constructor(options: Partial<GooglechatConfigOptions> = {}) {
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
      throw new Error('googlechat: token is required when enabled');
    }
    return true;
  }
}
