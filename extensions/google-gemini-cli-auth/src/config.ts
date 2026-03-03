/**
 * GoogleGeminiCliAuth Configuration
 */
export interface GoogleGeminiCliAuthConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class GoogleGeminiCliAuthConfig {
  private options: GoogleGeminiCliAuthConfigOptions;

  constructor(options: Partial<GoogleGeminiCliAuthConfigOptions> = {}) {
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
      throw new Error('google-gemini-cli-auth: token is required when enabled');
    }
    return true;
  }
}
