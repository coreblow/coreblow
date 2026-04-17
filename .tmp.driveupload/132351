/**
 * Feishu Configuration
 */
export interface FeishuConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class FeishuConfig {
  private options: FeishuConfigOptions;

  constructor(options: Partial<FeishuConfigOptions> = {}) {
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
      throw new Error('feishu: token is required when enabled');
    }
    return true;
  }
}
