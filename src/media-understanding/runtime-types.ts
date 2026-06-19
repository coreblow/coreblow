import type { AuthProfileStore } from "../agents/auth-profiles/types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { ActiveMediaModel } from "./active-model.types.js";
import type {
  MediaUnderstandingDecision,
  MediaUnderstandingOutput,
  MediaUnderstandingProvider,
  StructuredExtractionInput,
} from "./types.js";

export type RunMediaUnderstandingFileParams = {
  capability: "image" | "audio" | "video";
  filePath: string;
  mediaUrl?: string;
  cfg: CoreBlowConfig;
  agentDir?: string;
  workspaceDir?: string;
  mime?: string;
  activeModel?: ActiveMediaModel;
  prompt?: string;
  timeoutMs?: number;
};

export type RunMediaUnderstandingFileResult = {
  text: string | undefined;
  provider?: string;
  model?: string;
  output?: MediaUnderstandingOutput;
  decision?: MediaUnderstandingDecision;
};

export type DescribeImageFileParams = Omit<RunMediaUnderstandingFileParams, "capability">;
export type DescribeImageFileWithModelParams = DescribeImageFileParams & {
  provider: string;
  model: string;
  prompt: string;
  maxTokens?: number;
};
type DescribeImageFileWithModelResult = Awaited<
  ReturnType<NonNullable<MediaUnderstandingProvider["describeImage"]>>
>;

export type ExtractStructuredWithModelParams = {
  input: StructuredExtractionInput[];
  instructions: string;
  schemaName?: string;
  jsonSchema?: unknown;
  jsonMode?: boolean;
  cfg: CoreBlowConfig;
  agentDir?: string;
  provider: string;
  model: string;
  profile?: string;
  preferredProfile?: string;
  authStore?: AuthProfileStore;
  timeoutMs?: number;
};
type ExtractStructuredWithModelResult = Awaited<
  ReturnType<NonNullable<MediaUnderstandingProvider["extractStructured"]>>
>;

export type DescribeVideoFileParams = Omit<RunMediaUnderstandingFileParams, "capability">;
export type TranscribeAudioFileParams = Omit<RunMediaUnderstandingFileParams, "capability"> & {
  language?: string;
};

export type MediaUnderstandingRuntime = {
  runMediaUnderstandingFile(
    params: RunMediaUnderstandingFileParams,
  ): Promise<RunMediaUnderstandingFileResult>;
  describeImageFile(params: DescribeImageFileParams): Promise<RunMediaUnderstandingFileResult>;
  describeImageFileWithModel(
    params: DescribeImageFileWithModelParams,
  ): Promise<DescribeImageFileWithModelResult>;
  extractStructuredWithModel(
    params: ExtractStructuredWithModelParams,
  ): Promise<ExtractStructuredWithModelResult>;
  describeVideoFile(params: DescribeVideoFileParams): Promise<RunMediaUnderstandingFileResult>;
  transcribeAudioFile(params: TranscribeAudioFileParams): Promise<RunMediaUnderstandingFileResult>;
};
