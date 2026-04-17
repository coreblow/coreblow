/**
 * TestUtils Configuration
 */
export interface TestUtilsConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class TestUtilsConfig {
  private options: TestUtilsConfigOptions;

  constructor(options: Partial<TestUtilsConfigOptions> = {}) {
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
      throw new Error('test-utils: token is required when enabled');
    }
    return true;
  }
}
