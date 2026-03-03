/**
 * Matrix Configuration
 */
export interface MatrixConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class MatrixConfig {
  private options: MatrixConfigOptions;

  constructor(options: Partial<MatrixConfigOptions> = {}) {
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
      throw new Error('matrix: token is required when enabled');
    }
    return true;
  }
}
