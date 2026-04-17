/**
 * DiagnosticsOtel Configuration
 */
export interface DiagnosticsOtelConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class DiagnosticsOtelConfig {
  private options: DiagnosticsOtelConfigOptions;

  constructor(options: Partial<DiagnosticsOtelConfigOptions> = {}) {
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
      throw new Error('diagnostics-otel: token is required when enabled');
    }
    return true;
  }
}
