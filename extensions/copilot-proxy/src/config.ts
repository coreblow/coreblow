/**
 * CopilotProxy Configuration
 */
export interface CopilotProxyConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class CopilotProxyConfig {
  private options: CopilotProxyConfigOptions;

  constructor(options: Partial<CopilotProxyConfigOptions> = {}) {
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
      throw new Error('copilot-proxy: token is required when enabled');
    }
    return true;
  }
}
