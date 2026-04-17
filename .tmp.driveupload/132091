/**
 * ThreadOwnership Configuration
 */
export interface ThreadOwnershipConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class ThreadOwnershipConfig {
  private options: ThreadOwnershipConfigOptions;

  constructor(options: Partial<ThreadOwnershipConfigOptions> = {}) {
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
      throw new Error('thread-ownership: token is required when enabled');
    }
    return true;
  }
}
