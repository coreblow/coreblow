/**
 * LlmTask Configuration
 */
export interface LlmTaskConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class LlmTaskConfig {
  private options: LlmTaskConfigOptions;

  constructor(options: Partial<LlmTaskConfigOptions> = {}) {
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
      throw new Error('llm-task: token is required when enabled');
    }
    return true;
  }
}
