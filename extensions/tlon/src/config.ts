/**
 * Tlon Configuration
 */
export interface TlonConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class TlonConfig {
  private options: TlonConfigOptions;

  constructor(options: Partial<TlonConfigOptions> = {}) {
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
      throw new Error('tlon: token is required when enabled');
    }
    return true;
  }
}
