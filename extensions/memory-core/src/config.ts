/**
 * MemoryCore Configuration
 */
export interface MemoryCoreConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MemoryCoreConfig {
  private options: MemoryCoreConfigOptions;

  constructor(options: Partial<MemoryCoreConfigOptions> = {}) {
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
      throw new Error('memory-core: token is required when enabled');
    }
    return true;
  }
}
