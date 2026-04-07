/**
 * Diffs Configuration
 */
export interface DiffsConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class DiffsConfig {
  private options: DiffsConfigOptions;

  constructor(options: Partial<DiffsConfigOptions> = {}) {
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
      throw new Error('diffs: token is required when enabled');
    }
    return true;
  }
}
