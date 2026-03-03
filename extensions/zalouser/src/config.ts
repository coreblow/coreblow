/**
 * Zalouser Configuration
 */
export interface ZalouserConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class ZalouserConfig {
  private options: ZalouserConfigOptions;

  constructor(options: Partial<ZalouserConfigOptions> = {}) {
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
      throw new Error('zalouser: token is required when enabled');
    }
    return true;
  }
}
