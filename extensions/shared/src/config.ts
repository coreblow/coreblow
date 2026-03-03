/**
 * Shared Configuration
 */
export interface SharedConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class SharedConfig {
  private options: SharedConfigOptions;

  constructor(options: Partial<SharedConfigOptions> = {}) {
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
      throw new Error('shared: token is required when enabled');
    }
    return true;
  }
}
