/** CoreBlow — Types: TTS */ export interface TtsConfig { enabled: boolean; provider: "google" | "elevenlabs" | "openai"; voiceId?: string; speed?: number; }
