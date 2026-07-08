import {
  getTtsProvider,
  resolveAgentDir,
  resolveTtsConfig,
  resolveTtsPrefsPath,
  type ResolvedTtsConfig,
} from "coreblow/plugin-sdk/agent-runtime";
import type { CoreBlowConfig, TtsConfig } from "coreblow/plugin-sdk/config-runtime";
import { parseTtsDirectives } from "coreblow/plugin-sdk/speech";
import { normalizeOptionalString } from "coreblow/plugin-sdk/string-coerce-runtime";
import { getDiscordRuntime } from "../runtime.js";
import { sanitizeVoiceReplyTextForSpeech } from "./sanitize.js";

type VoiceReplyAudioResult =
  | {
      status: "ok";
      mode: "file";
      audioPath: string;
      speakText: string;
    }
  | {
      status: "empty";
    }
  | {
      status: "failed";
      error?: string;
    };

function mergeTtsConfig(base: TtsConfig, override?: TtsConfig): TtsConfig {
  if (!override) {
    return base;
  }
  const baseProviders = base.providers ?? {};
  const overrideProviders = override.providers ?? {};
  const mergedProviders = Object.fromEntries(
    [...new Set([...Object.keys(baseProviders), ...Object.keys(overrideProviders)])].map(
      (providerId) => {
        const baseProvider = baseProviders[providerId] ?? {};
        const overrideProvider = overrideProviders[providerId] ?? {};
        return [
          providerId,
          {
            ...baseProvider,
            ...overrideProvider,
          },
        ];
      },
    ),
  );
  return {
    ...base,
    ...override,
    modelOverrides: {
      ...base.modelOverrides,
      ...override.modelOverrides,
    },
    ...(Object.keys(mergedProviders).length === 0 ? {} : { providers: mergedProviders }),
  };
}

function resolveVoiceTtsConfig(params: { cfg: CoreBlowConfig; override?: TtsConfig }): {
  cfg: CoreBlowConfig;
  resolved: ResolvedTtsConfig;
} {
  if (!params.override) {
    return { cfg: params.cfg, resolved: resolveTtsConfig(params.cfg) };
  }
  const base = params.cfg.messages?.tts ?? {};
  const merged = mergeTtsConfig(base, params.override);
  const messages = params.cfg.messages ?? {};
  const cfg = {
    ...params.cfg,
    messages: {
      ...messages,
      tts: merged,
    },
  };
  return { cfg, resolved: resolveTtsConfig(cfg) };
}

export async function transcribeVoiceAudio(params: {
  cfg: CoreBlowConfig;
  agentId: string;
  filePath: string;
}): Promise<string | undefined> {
  const result = await getDiscordRuntime().mediaUnderstanding.transcribeAudioFile({
    filePath: params.filePath,
    cfg: params.cfg,
    agentDir: resolveAgentDir(params.cfg, params.agentId),
    mime: "audio/wav",
  });
  return normalizeOptionalString(result.text);
}

export async function synthesizeVoiceReplyAudio(params: {
  cfg: CoreBlowConfig;
  override?: TtsConfig;
  replyText: string;
  speakerLabel: string;
}): Promise<VoiceReplyAudioResult> {
  const { cfg: ttsCfg, resolved: ttsConfig } = resolveVoiceTtsConfig({
    cfg: params.cfg,
    override: params.override,
  });
  // ponytail: preferredProviderId not in CoreBlow ParseTtsDirectiveOptions yet;
  // add when voice provider selection lands.
  const directive = parseTtsDirectives(params.replyText, ttsConfig.modelOverrides, {
    cfg: ttsCfg,
    providerConfigs: ttsConfig.providerConfigs,
  });
  const rawSpeakText = directive.overrides.ttsText ?? directive.cleanedText.trim();
  const speakText = sanitizeVoiceReplyTextForSpeech(rawSpeakText, params.speakerLabel);
  if (!speakText) {
    return { status: "empty" };
  }

  const runtime = getDiscordRuntime();
  // ponytail: textToSpeechStream not in CoreBlow TTS runtime yet;
  // add when streaming TTS lands.
  const result = await runtime.tts.textToSpeech({
    text: speakText,
    cfg: ttsCfg,
    channel: "discord",
    overrides: directive.overrides,
  });
  if (!result.success || !result.audioPath) {
    return { status: "failed", error: result.error ?? "unknown error" };
  }
  return { status: "ok", mode: "file", audioPath: result.audioPath, speakText };
}
