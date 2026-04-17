/**
 * Irc Configuration
 */
export interface IrcConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class IrcConfig {
  private options: IrcConfigOptions;

  constructor(options: Partial<IrcConfigOptions> = {}) {
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
      throw new Error('irc: token is required when enabled');
    }
    return true;
  }
}
