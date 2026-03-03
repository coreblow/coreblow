/**
 * Msteams Configuration
 */
export interface MsteamsConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MsteamsConfig {
  private options: MsteamsConfigOptions;

  constructor(options: Partial<MsteamsConfigOptions> = {}) {
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
      throw new Error('msteams: token is required when enabled');
    }
    return true;
  }
}
