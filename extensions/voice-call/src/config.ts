/**
 * VoiceCall Configuration
 */
export interface VoiceCallConfigOptions {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  debug?: boolean;
}

export class VoiceCallConfig {
  private options: VoiceCallConfigOptions;

  constructor(options: Partial<VoiceCallConfigOptions> = {}) {
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
      throw new Error('voice-call: token is required when enabled');
    }
    return true;
  }
}
