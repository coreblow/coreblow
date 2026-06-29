import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInteractiveConversationBindingHelpers } from "./interactive-binding-helpers.js";
import * as conversationBinding from "./conversation-binding.js";

vi.mock("./conversation-binding.js");

describe("createInteractiveConversationBindingHelpers", () => {
  const mockConversation = {
    channel: "discord",
    accountId: "user123",
    conversationId: "conv456",
  };

  const mockRegistration = {
    pluginId: "test-plugin",
    pluginName: "Test Plugin",
    pluginRoot: "/path/to/plugin",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return helpers object with three methods", () => {
    const helpers = createInteractiveConversationBindingHelpers({
      registration: mockRegistration,
      conversation: mockConversation,
    });

    expect(helpers).toHaveProperty("requestConversationBinding");
    expect(helpers).toHaveProperty("detachConversationBinding");
    expect(helpers).toHaveProperty("getCurrentConversationBinding");
    expect(typeof helpers.requestConversationBinding).toBe("function");
    expect(typeof helpers.detachConversationBinding).toBe("function");
    expect(typeof helpers.getCurrentConversationBinding).toBe("function");
  });

  it("should call requestPluginConversationBinding with correct params", async () => {
    const mockBinding = { summary: "Test binding" };
    const mockResult = { status: "bound" as const, binding: {} as any };
    vi.mocked(conversationBinding.requestPluginConversationBinding).mockResolvedValue(mockResult);

    const helpers = createInteractiveConversationBindingHelpers({
      registration: mockRegistration,
      senderId: "sender789",
      conversation: mockConversation,
    });

    const result = await helpers.requestConversationBinding(mockBinding);

    expect(conversationBinding.requestPluginConversationBinding).toHaveBeenCalledWith({
      pluginId: "test-plugin",
      pluginName: "Test Plugin",
      pluginRoot: "/path/to/plugin",
      requestedBySenderId: "sender789",
      conversation: mockConversation,
      binding: mockBinding,
    });
    expect(result).toBe(mockResult);
  });

  it("should return error when pluginRoot is undefined for requestConversationBinding", async () => {
    const registrationWithoutRoot = {
      pluginId: "test-plugin",
      pluginName: "Test Plugin",
      pluginRoot: undefined,
    };
    const helpers = createInteractiveConversationBindingHelpers({
      registration: registrationWithoutRoot,
      conversation: mockConversation,
    });

    const result = await helpers.requestConversationBinding();

    expect(result).toEqual({
      status: "error",
      message: "This interaction cannot bind the current conversation.",
    });
    expect(conversationBinding.requestPluginConversationBinding).not.toHaveBeenCalled();
  });

  it("should call detachPluginConversationBinding with correct params", async () => {
    const mockResult = { removed: true };
    vi.mocked(conversationBinding.detachPluginConversationBinding).mockResolvedValue(mockResult);

    const helpers = createInteractiveConversationBindingHelpers({
      registration: mockRegistration,
      conversation: mockConversation,
    });

    const result = await helpers.detachConversationBinding();

    expect(conversationBinding.detachPluginConversationBinding).toHaveBeenCalledWith({
      pluginRoot: "/path/to/plugin",
      conversation: mockConversation,
    });
    expect(result).toBe(mockResult);
  });

  it("should return removed false when pluginRoot is undefined for detachConversationBinding", async () => {
    const registrationWithoutRoot = {
      pluginId: "test-plugin",
      pluginName: "Test Plugin",
      pluginRoot: undefined,
    };
    const helpers = createInteractiveConversationBindingHelpers({
      registration: registrationWithoutRoot,
      conversation: mockConversation,
    });

    const result = await helpers.detachConversationBinding();

    expect(result).toEqual({ removed: false });
    expect(conversationBinding.detachPluginConversationBinding).not.toHaveBeenCalled();
  });

  it("should call getCurrentPluginConversationBinding with correct params", async () => {
    const mockBinding = { bindingId: "bind123" } as any;
    vi.mocked(conversationBinding.getCurrentPluginConversationBinding).mockResolvedValue(
      mockBinding,
    );

    const helpers = createInteractiveConversationBindingHelpers({
      registration: mockRegistration,
      conversation: mockConversation,
    });

    const result = await helpers.getCurrentConversationBinding();

    expect(conversationBinding.getCurrentPluginConversationBinding).toHaveBeenCalledWith({
      pluginRoot: "/path/to/plugin",
      conversation: mockConversation,
    });
    expect(result).toBe(mockBinding);
  });

  it("should return null when pluginRoot is undefined for getCurrentConversationBinding", async () => {
    const registrationWithoutRoot = {
      pluginId: "test-plugin",
      pluginName: "Test Plugin",
      pluginRoot: undefined,
    };
    const helpers = createInteractiveConversationBindingHelpers({
      registration: registrationWithoutRoot,
      conversation: mockConversation,
    });

    const result = await helpers.getCurrentConversationBinding();

    expect(result).toBeNull();
    expect(conversationBinding.getCurrentPluginConversationBinding).not.toHaveBeenCalled();
  });

  it("should use empty binding params when not provided", async () => {
    const mockResult = { status: "bound" as const, binding: {} as any };
    vi.mocked(conversationBinding.requestPluginConversationBinding).mockResolvedValue(mockResult);

    const helpers = createInteractiveConversationBindingHelpers({
      registration: mockRegistration,
      conversation: mockConversation,
    });

    await helpers.requestConversationBinding();

    expect(conversationBinding.requestPluginConversationBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        binding: {},
      }),
    );
  });
});
