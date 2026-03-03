/**
 * Signal Configuration
 */
export interface SignalConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class SignalConfig {
  private options: SignalConfigOptions;

  constructor(options: Partial<SignalConfigOptions> = {}) {
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
      throw new Error('signal: token is required when enabled');
    }
    return true;
  }
}
