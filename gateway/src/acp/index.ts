/**
 * src/acp/index.ts
 * ACP barrel exports
 */

export { AcpServer, WebSocketAcpConnection, StdioAcpConnection, type AcpConnection } from './server.js';
export { AcpSessionStore } from './session-store.js';
export { extractTextFromPrompt, extractAttachments, inferToolKind, formatToolTitle } from './event-mapper.js';
export {
    type AcpSession,
    type AcpServerConfig,
    type AcpMessage,
    type InitializeResponse,
    type PromptRequest,
    type PromptResponse,
    type ContentBlock,
    type SessionUpdate,
    type ToolKind,
    ACP_AGENT_INFO,
    ACP_VERSION,
    PROTOCOL_VERSION,
} from './types.js';
