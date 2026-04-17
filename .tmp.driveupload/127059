/**
 * NextcloudTalk Configuration
 */
export interface NextcloudTalkConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class NextcloudTalkConfig {
  private options: NextcloudTalkConfigOptions;

  constructor(options: Partial<NextcloudTalkConfigOptions> = {}) {
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
      throw new Error('nextcloud-talk: token is required when enabled');
    }
    return true;
  }
}
