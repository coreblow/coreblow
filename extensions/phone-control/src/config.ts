/**
 * PhoneControl Configuration
 */
export interface PhoneControlConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class PhoneControlConfig {
  private options: PhoneControlConfigOptions;

  constructor(options: Partial<PhoneControlConfigOptions> = {}) {
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
      throw new Error('phone-control: token is required when enabled');
    }
    return true;
  }
}
