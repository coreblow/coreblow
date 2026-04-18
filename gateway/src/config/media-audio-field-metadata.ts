/** CoreBlow — Media Audio Field Metadata */
export interface AudioFieldMeta { field: string; format: "mp3" | "wav" | "ogg" | "opus"; maxDurationMs: number; maxSizeBytes: number; }
export const AUDIO_FIELD_DEFAULTS: AudioFieldMeta = { field: "audio", format: "mp3", maxDurationMs: 300_000, maxSizeBytes: 25_000_000 };
