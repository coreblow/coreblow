/**
 * Line Configuration
 */
export interface LineConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class LineConfig {
  private options: LineConfigOptions;

  constructor(options: Partial<LineConfigOptions> = {}) {
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
      throw new Error('line: token is required when enabled');
    }
    return true;
  }
}
