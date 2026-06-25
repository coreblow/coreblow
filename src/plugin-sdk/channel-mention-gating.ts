export type {
  MentionGateParams,
  MentionGateResult,
  MentionGateWithBypassParams,
  MentionGateWithBypassResult,
} from "../channels/mention-gating.js";
export {
  resolveMentionGating,
  resolveMentionGatingWithBypass,
} from "../channels/mention-gating.js";
export {
  CURRENT_MESSAGE_MARKER,
  buildMentionRegexes,
  normalizeMentionText,
} from "../auto-reply/reply/mentions.js";
