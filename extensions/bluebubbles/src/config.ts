/**
 * Bluebubbles Configuration
 */
export interface BluebubblesConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class BluebubblesConfig {
  private options: BluebubblesConfigOptions;

  constructor(options: Partial<BluebubblesConfigOptions> = {}) {
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
      throw new Error('bluebubbles: token is required when enabled');
    }
    return true;
  }
}
