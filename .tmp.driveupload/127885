/**
 * Lobster Configuration
 */
export interface LobsterConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class LobsterConfig {
  private options: LobsterConfigOptions;

  constructor(options: Partial<LobsterConfigOptions> = {}) {
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
      throw new Error('lobster: token is required when enabled');
    }
    return true;
  }
}
