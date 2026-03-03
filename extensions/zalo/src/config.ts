/**
 * Zalo Configuration
 */
export interface ZaloConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class ZaloConfig {
  private options: ZaloConfigOptions;

  constructor(options: Partial<ZaloConfigOptions> = {}) {
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
      throw new Error('zalo: token is required when enabled');
    }
    return true;
  }
}
