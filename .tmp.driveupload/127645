/**
 * Mattermost Configuration
 */
export interface MattermostConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MattermostConfig {
  private options: MattermostConfigOptions;

  constructor(options: Partial<MattermostConfigOptions> = {}) {
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
      throw new Error('mattermost: token is required when enabled');
    }
    return true;
  }
}
