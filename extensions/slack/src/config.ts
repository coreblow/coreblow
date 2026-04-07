/**
 * Slack Configuration
 */
export interface SlackConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class SlackConfig {
  private options: SlackConfigOptions;

  constructor(options: Partial<SlackConfigOptions> = {}) {
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
      throw new Error('slack: token is required when enabled');
    }
    return true;
  }
}
