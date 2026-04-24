// @mariozechner/* packages ship their own .d.ts — real types from node_modules.
// Only augmentation below (matching OpenClaw's src/types/pi-agent-core.d.ts pattern).

import "@mariozechner/pi-agent-core";

declare module "@mariozechner/pi-agent-core" {
  // CoreBlow persists compaction markers alongside normal agent history.
  interface CustomAgentMessages {
    compactionSummary: {
      role: "compactionSummary";
      summary: string;
      tokensBefore: number;
      timestamp: number | string;
      tokensAfter?: number;
      firstKeptEntryId?: string;
      details?: unknown;
    };
  }
}


// AgentClientProtocol SDK
declare module '@agentclientprotocol/sdk' {
  export const AgentClient: any;
  export type Agent = any;
  export class AgentSideConnection { constructor(...args: any[]); [k: string]: any; }
  export type AgentSession = any;
  export type AgentClientConfig = any;
  export type AcpMessage = any;
  export type AcpTool = any;
  export type AcpToolResult = any;
  export type AcpSessionState = any;
  export type AuthenticateRequest = any;
  export type AuthenticateResponse = any;
  export type AvailableCommand = any;
  export type CancelNotification = any;
  export class ClientSideConnection { constructor(...args: any[]); [k: string]: any; }
  export type InitializeRequest = any;
  export type InitializeResponse = any;
  export type ListSessionsRequest = any;
  export type ListSessionsResponse = any;
  export type LoadSessionRequest = any;
  export type LoadSessionResponse = any;
  export type NewSessionRequest = any;
  export type NewSessionResponse = any;
  export type PromptRequest = any;
  export type PromptResponse = any;
  export type RequestPermissionRequest = any;
  export type RequestPermissionResponse = any;
  export type SessionNotification = any;
  export type SetSessionConfigOptionRequest = any;
  export type SetSessionConfigOptionResponse = any;
  export type SetSessionModeRequest = any;
  export type SetSessionModeResponse = any;
  export const PROTOCOL_VERSION: string;
  export type ContentBlock = any;
  export type ImageContent = any;
  export type SessionConfigOption = any;
  export type SessionModeState = any;
  export type StopReason = any;
  export type ToolCallContent = any;
  export type ToolCallLocation = any;
  export type ToolKind = any;
  export function createAgentClient(...args: any[]): any;
  export function ndJsonStream(...args: any[]): any;
}

// Other external package stubs
declare module '@napi-rs/canvas' {
  export function createCanvas(w: number, h: number): any;
  export function loadImage(src: any): any;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(src: any): any;
}

declare module '@mozilla/readability' {
  export class Readability {
    constructor(doc: any);
    parse(): any;
  }
  export function isProbablyReaderable(doc: any): boolean;
}

declare module '@buape/carbon' {
  export class Client { constructor(opts: any); rest: any; application: any; [k: string]: any; }
  export class Command { constructor(opts: any); [k: string]: any; }
  export class BaseCommand { constructor(opts: any); [k: string]: any; }
  export class CommandWithSubcommands { constructor(opts: any); [k: string]: any; }
  export class Row { constructor(opts: any); [k: string]: any; }
  export class Button { constructor(opts: any); [k: string]: any; }
  export class LinkButton { constructor(opts: any); [k: string]: any; }
  export class CommandInteraction { constructor(opts: any); update(...args: any[]): any; reply(...args: any[]): any; rawData: any; [k: string]: any; }
  export class AutocompleteInteraction { constructor(opts: any); [k: string]: any; }
  export class ButtonInteraction { constructor(opts: any); update(...args: any[]): any; reply(...args: any[]): any; rawData: any; [k: string]: any; }
  export class ModalInteraction { constructor(opts: any); [k: string]: any; }
  export class SelectMenu { constructor(opts: any); [k: string]: any; }
  export class StringSelectMenu { constructor(opts: any); [k: string]: any; }
  export class StringSelectMenuInteraction { constructor(opts: any); update(...args: any[]): any; reply(...args: any[]): any; rawData: any; [k: string]: any; }
  export class ChannelSelectMenu { constructor(opts: any); [k: string]: any; }
  export class ChannelSelectMenuInteraction { constructor(opts: any); [k: string]: any; }
  export class MentionableSelectMenu { constructor(opts: any); [k: string]: any; }
  export class MentionableSelectMenuInteraction { constructor(opts: any); [k: string]: any; }
  export class RoleSelectMenuInteraction { constructor(opts: any); [k: string]: any; }
  export class UserSelectMenuInteraction { constructor(opts: any); [k: string]: any; }
  export class Modal { constructor(opts: any); [k: string]: any; }
  export class TextInput { constructor(opts: any); [k: string]: any; }
  export class Embed { constructor(opts: any); [k: string]: any; }
  export class Guild { constructor(opts: any); id: any; name: any; [k: string]: any; }
  export class User { constructor(opts: any); id: any; username: any; displayName: any; avatar: any; [k: string]: any; }
  export class Message { constructor(opts: any); id: any; content: any; author: any; channel: any; [k: string]: any; }
  export class Plugin { constructor(opts: any); [k: string]: any; }
  export class Container { constructor(opts: any); [k: string]: any; }
  export class Section { constructor(opts: any); [k: string]: any; }
  export class Separator { constructor(opts: any); [k: string]: any; }
  export class TextDisplay { constructor(opts: any); [k: string]: any; }
  export class Thumbnail { constructor(opts: any); [k: string]: any; }
  export class MediaGallery { constructor(opts: any); [k: string]: any; }
  export class Label { constructor(opts: any); [k: string]: any; }
  export class File { constructor(opts: any); [k: string]: any; }
  export class CheckboxGroup { constructor(opts: any); [k: string]: any; }
  export class RadioGroup { constructor(opts: any); [k: string]: any; }
  export class RequestClient { constructor(opts: any); get(...args: any[]): any; post(...args: any[]): any; put(...args: any[]): any; patch(...args: any[]): any; delete(...args: any[]): any; [k: string]: any; }
  export class RateLimitError extends Error {}
  export const InteractionType: any;
  export const ComponentType: any;
  export const TextInputStyle: any;
  export const ButtonStyle: any;
  export const ChannelType: any;
  export const MessageType: any;
  export type BaseInteraction = any;
  export type CommandData = any;
  export type CommandOptions = any;
  export type ComponentData = any;
  export type ComponentParserResult = any;
  export type TopLevelComponents = any;
  export type MessagePayloadObject = any;
  export type MessagePayloadFile = any;
  export type MessageCreateListener = any;
  export type MessageReactionAddListener = any;
  export type MessageReactionRemoveListener = any;
  export type PresenceUpdateListener = any;
  export type ReadyListener = any;
  export type ThreadUpdateListener = any;
  export type EventSource = any;
  export type AgentComponentInteraction = any;
  export function parseCustomId(...args: any[]): any;
  export function serializePayload(...args: any[]): any;
}

declare module '@buape/carbon/gateway' {
  export class GatewayPlugin { constructor(opts: any); }
  export const GatewayCloseCodes: any;
  export type Activity = any;
  export type UpdatePresenceData = any;
  export function createGatewayHandler(...args: any[]): any;
}

declare module '@pierre/diffs' {
  export function createDiffView(...args: any[]): any;
  export function parsePatch(...args: any[]): any;
  export type DiffResult = any;
  export type PatchResult = any;
  export type FileContents = any;
  export type FileDiffMetadata = any;
  export type RegisteredCustomThemes = any;
  export type ResolvedThemes = any;
  export type ResolvingThemes = any;
  export type SupportedLanguages = any;
  export type ThemeRegistrationResolved = any;
}

declare module '@mariozechner/pi-ai/oauth' {
  export type OAuthCredentials = any;
  export type OAuthProvider = any;
  export type OAuthConfig = any;
  export type OAuthTokenResponse = any;
  export function getOAuthApiKey(...args: any[]): any;
  export function getOAuthProviders(...args: any[]): any;
  export function loginOpenAICodex(...args: any[]): any;
  export function refreshOpenAICodexToken(...args: any[]): any;
  export function createOAuthRedirectUrl(...args: any[]): any;
  export function exchangeOAuthCode(...args: any[]): any;
  export function refreshOAuthToken(...args: any[]): any;
}

declare module '@slack/bolt' {
  export class App { constructor(opts: any); start(...args: any[]): any; }
  export type SlackEventMiddlewareArgs<T = any> = any;
  export type SlackActionMiddlewareArgs = any;
  export type SlackCommandMiddlewareArgs = any;
}

declare module '@homebridge/ciao' {
  export function getResponder(...args: any[]): Responder;
  export class Responder { constructor(...args: any[]); createService(...args: any[]): CiaoService; [k: string]: any; }
  export class CiaoService { constructor(...args: any[]); advertise(...args: any[]): any; end(...args: any[]): any; [k: string]: any; }
  export const ServiceType: any;
  export const Protocol: { IPv4: any; IPv6: any; UNSPECIFIED: any; [k: string]: any; };
}

declare module '@lancedb/lancedb' {
  export function connect(...args: any[]): any;
  export type Connection = any;
  export type Table = any;
}

declare module 'jszip' {
  class JSZip { file(...args: any[]): any; generateAsync(...args: any[]): any; loadAsync(...args: any[]): any; [k: string]: any; }
  export = JSZip;
}

declare module 'yaml' {
  export function parse(...args: any[]): any;
  export function stringify(...args: any[]): any;
}

declare module 'file-type' {
  export function fileTypeFromBuffer(...args: any[]): any;
  export function fileTypeFromFile(...args: any[]): any;
}

declare module 'qrcode-terminal' {
  export function generate(...args: any[]): any;
}

declare module 'markdown-it' {
  class MarkdownIt { constructor(...args: any[]); render(...args: any[]): any; [k: string]: any; }
  export = MarkdownIt;
}

declare module '@anthropic-ai/vertex-sdk' {
  export class AnthropicVertex { constructor(...args: any[]); messages: any; [k: string]: any; }
}

declare module '@buape/carbon/voice' {
  export class VoiceManager { constructor(...args: any[]); [k: string]: any; }
  export class VoiceConnection { constructor(...args: any[]); [k: string]: any; }
}

declare module '@twurple/chat' {
  export class ChatClient { constructor(...args: any[]); connect(): any; onMessage(...args: any[]): any; say(...args: any[]): any; [k: string]: any; }
}

declare module '@twurple/api' {
  export class ApiClient { constructor(...args: any[]); [k: string]: any; }
}

declare module '@matrix-org/matrix-sdk-crypto-nodejs' {
  const m: any;
  export = m;
}

declare module 'https-proxy-agent' {
  export class HttpsProxyAgent { constructor(url: string); [k: string]: any; }
}

declare module 'sqlite-vec' {
  const m: any;
  export = m;
}

declare module 'music-metadata' {
  export function parseBuffer(...args: any[]): any;
  export function parseFile(...args: any[]): any;
}

declare module 'google-auth-library' {
  export class GoogleAuth { constructor(opts?: any); getClient(): any; [k: string]: any; }
  export class OAuth2Client { constructor(...args: any[]); [k: string]: any; }
}

declare module 'fake-indexeddb' {
  const m: any;
  export default m;
}

declare module '@urbit/aura' {
  export function patp2dec(...args: any[]): any;
  export function dec2patp(...args: any[]): any;
}

declare module '@line/bot-sdk' {
  export const messagingApi: any;
  export type WebhookRequestBody = any;
  export type MessageEvent = any;
  export type TextMessage = any;
  export type WebhookEvent = any;
  export class Client { constructor(opts: any); [k: string]: any; }
  export class HTTPFetchError extends Error { statusCode: number; [k: string]: any; }
}

declare module '@pierre/diffs/ssr' { const m: any; export default m; export const createDiffView: any; }
declare module '@opentelemetry/api' { const m: any; export = m; }
declare module '@opentelemetry/api-logs' { const m: any; export = m; }
declare module '@opentelemetry/sdk-node' { export class NodeSDK { constructor(opts?: any); start(): any; [k: string]: any; } }
declare module '@opentelemetry/sdk-trace-base' { export class SimpleSpanProcessor { constructor(...args: any[]); } export class BatchSpanProcessor { constructor(...args: any[]); } }
declare module '@opentelemetry/sdk-metrics' { export class PeriodicExportingMetricReader { constructor(...args: any[]); } }
declare module '@opentelemetry/sdk-logs' { export class SimpleLogRecordProcessor { constructor(...args: any[]); } export class BatchLogRecordProcessor { constructor(...args: any[]); } }
declare module '@opentelemetry/resources' { export class Resource { constructor(attrs?: any); static default(): any; [k: string]: any; } }
declare module '@opentelemetry/semantic-conventions' { const m: any; export = m; }
declare module '@opentelemetry/exporter-trace-otlp-proto' { export class OTLPTraceExporter { constructor(opts?: any); } }
declare module '@opentelemetry/exporter-metrics-otlp-proto' { export class OTLPMetricExporter { constructor(opts?: any); } }
declare module '@opentelemetry/exporter-logs-otlp-proto' { export class OTLPLogExporter { constructor(opts?: any); } }
declare module '@grammyjs/transformer-throttler' { export function apiThrottler(...args: any[]): any; }
declare module '@aws-sdk/client-s3' { export class S3Client { constructor(opts?: any); send(...args: any[]): any; } export class PutObjectCommand { constructor(input: any); } export class GetObjectCommand { constructor(input: any); } }
declare module '@aws-sdk/s3-request-presigner' { export function getSignedUrl(...args: any[]): any; }
declare module '@aws-sdk/client-bedrock' { export class BedrockClient { constructor(opts?: any); send(...args: any[]): any; } export class ListFoundationModelsCommand { constructor(input?: any); } }
declare module '@grammyjs/runner' { export function run(...args: any[]): any; export type RunOptions = any; export type RunnerHandle = any; }
