/**
 * Telegram Configuration
 */
export interface TelegramConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class TelegramConfig {
  private options: TelegramConfigOptions;

  constructor(options: Partial<TelegramConfigOptions> = {}) {
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
      throw new Error('telegram: token is required when enabled');
    }
    return true;
  }
}
