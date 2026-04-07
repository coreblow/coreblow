/**
 * Acpx Configuration
 */
export interface AcpxConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class AcpxConfig {
  private options: AcpxConfigOptions;

  constructor(options: Partial<AcpxConfigOptions> = {}) {
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
      throw new Error('acpx: token is required when enabled');
    }
    return true;
  }
}
