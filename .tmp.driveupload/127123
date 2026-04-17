/**
 * OpenProse Configuration
 */
export interface OpenProseConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class OpenProseConfig {
  private options: OpenProseConfigOptions;

  constructor(options: Partial<OpenProseConfigOptions> = {}) {
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
      throw new Error('open-prose: token is required when enabled');
    }
    return true;
  }
}
