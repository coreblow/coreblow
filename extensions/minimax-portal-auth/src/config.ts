/**
 * MinimaxPortalAuth Configuration
 */
export interface MinimaxPortalAuthConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MinimaxPortalAuthConfig {
  private options: MinimaxPortalAuthConfigOptions;

  constructor(options: Partial<MinimaxPortalAuthConfigOptions> = {}) {
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
      throw new Error('minimax-portal-auth: token is required when enabled');
    }
    return true;
  }
}
