import { describe, it, expect } from "vitest";
import {
  isPluginOwnedBindingMetadata,
  isPluginOwnedSessionBindingRecord,
  toPluginConversationBinding,
  buildPluginBindingUnavailableText,
  buildPluginBindingDeclinedText,
  buildPluginBindingErrorText,
  hasShownPluginBindingFallbackNotice,
  markPluginBindingFallbackNoticeShown,
  buildPluginBindingApprovalCustomId,
  parsePluginBindingApprovalCustomId,
  requestPluginConversationBinding,
  getCurrentPluginConversationBinding,
  detachPluginConversationBinding,
  resolvePluginConversationBindingApproval,
  buildPluginBindingResolvedText,
} from "./conversation-binding.js";

describe("conversation-binding — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof isPluginOwnedBindingMetadata).toBe("function");
    expect(typeof isPluginOwnedSessionBindingRecord).toBe("function");
    expect(typeof toPluginConversationBinding).toBe("function");
    expect(typeof buildPluginBindingUnavailableText).toBe("function");
    expect(typeof buildPluginBindingDeclinedText).toBe("function");
    expect(typeof buildPluginBindingErrorText).toBe("function");
    expect(typeof hasShownPluginBindingFallbackNotice).toBe("function");
    expect(typeof markPluginBindingFallbackNoticeShown).toBe("function");
    expect(typeof buildPluginBindingApprovalCustomId).toBe("function");
    expect(typeof parsePluginBindingApprovalCustomId).toBe("function");
    expect(typeof requestPluginConversationBinding).toBe("function");
    expect(typeof getCurrentPluginConversationBinding).toBe("function");
    expect(typeof detachPluginConversationBinding).toBe("function");
    expect(typeof resolvePluginConversationBindingApproval).toBe("function");
    expect(typeof buildPluginBindingResolvedText).toBe("function");
  });
});
