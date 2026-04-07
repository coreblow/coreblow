/**
 * DevicePair Configuration
 */
export interface DevicePairConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class DevicePairConfig {
  private options: DevicePairConfigOptions;

  constructor(options: Partial<DevicePairConfigOptions> = {}) {
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
      throw new Error('device-pair: token is required when enabled');
    }
    return true;
  }
}
