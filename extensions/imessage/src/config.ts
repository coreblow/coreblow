/**
 * Imessage Configuration
 */
export interface ImessageConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class ImessageConfig {
  private options: ImessageConfigOptions;

  constructor(options: Partial<ImessageConfigOptions> = {}) {
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
      throw new Error('imessage: token is required when enabled');
    }
    return true;
  }
}
