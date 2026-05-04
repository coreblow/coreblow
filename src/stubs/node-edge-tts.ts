// Stub for node-edge-tts — optional native dep not installed
export class MsEdgeTTS {
  async setMetadata() {}
  async toStream() { return { audio: Buffer.alloc(0), subtitle: "" }; }
  async close() {}
}

// DRM module exports used by extensions/microsoft/speech-provider.ts
export const CHROMIUM_FULL_VERSION = "130.0.6723.70";
export const SEC_MS_GEC_VERSION = "1-130.0.6723.70";
export const BASE_URL = "https://speech.platform.bing.com";
export const VOICES_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list";
export const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"; // pragma: allowlist secret

export function calculateSec_MS_GEC() {
  return "stub-gec-token";
}

export function generateSecMsGecToken() {
  return "stub-gec-token";
}

export default MsEdgeTTS;
