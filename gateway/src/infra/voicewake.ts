/** CoreBlow — Voice Wake Detection */
export interface VoiceWakeConfig { keyword: string; sensitivity: number; }
export const DEFAULT_WAKE_KEYWORD = "hey coreblow";
export function matchesWakeWord(transcript: string, keyword = DEFAULT_WAKE_KEYWORD): boolean { return transcript.toLowerCase().includes(keyword.toLowerCase()); }
