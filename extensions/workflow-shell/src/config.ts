/**
 * WorkflowShell Configuration
 */
export interface WorkflowShellConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class WorkflowShellConfig {
  private options: WorkflowShellConfigOptions;

  constructor(options: Partial<WorkflowShellConfigOptions> = {}) {
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
      throw new Error('workflow-shell: token is required when enabled');
    }
    return true;
  }
}
