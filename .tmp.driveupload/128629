/**
 * Whatsapp Configuration
 */
export interface WhatsappConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class WhatsappConfig {
  private options: WhatsappConfigOptions;

  constructor(options: Partial<WhatsappConfigOptions> = {}) {
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
      throw new Error('whatsapp: token is required when enabled');
    }
    return true;
  }
}
