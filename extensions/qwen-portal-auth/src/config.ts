/**
 * QwenPortalAuth Configuration
 */
export interface QwenPortalAuthConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class QwenPortalAuthConfig {
  private options: QwenPortalAuthConfigOptions;

  constructor(options: Partial<QwenPortalAuthConfigOptions> = {}) {
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
      throw new Error('qwen-portal-auth: token is required when enabled');
    }
    return true;
  }
}
