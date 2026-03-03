/**
 * MemoryLancedb Configuration
 */
export interface MemoryLancedbConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MemoryLancedbConfig {
  private options: MemoryLancedbConfigOptions;

  constructor(options: Partial<MemoryLancedbConfigOptions> = {}) {
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
      throw new Error('memory-lancedb: token is required when enabled');
    }
    return true;
  }
}
