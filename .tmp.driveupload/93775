import { describe, it, expect } from "vitest";
import {
  markdownToHtml,
  htmlToPlaintext,
  markdownToPlaintext,
  formatForChannel,
  normalizeInboundMessage,
  buildOutboundMessage,
  extractSenderName,
  truncateMessage,
} from "../../src/hooks/message-hook-mappers.js";

describe("message-hook-mappers", () => {
  describe("markdownToHtml", () => {
    it("converts headings", () => {
      expect(markdownToHtml("# Title")).toContain("<h1>Title</h1>");
      expect(markdownToHtml("## Sub")).toContain("<h2>Sub</h2>");
    });

    it("converts bold and italic", () => {
      expect(markdownToHtml("**bold**")).toContain("<strong>bold</strong>");
      expect(markdownToHtml("*italic*")).toContain("<em>italic</em>");
    });

    it("converts inline code", () => {
      expect(markdownToHtml("`code`")).toContain("<code>code</code>");
    });

    it("converts links", () => {
      expect(markdownToHtml("[text](url)")).toContain('<a href="url">text</a>');
    });
  });

  describe("htmlToPlaintext", () => {
    it("strips HTML tags", () => {
      expect(htmlToPlaintext("<strong>bold</strong>")).toBe("bold");
    });

    it("converts br to newline", () => {
      expect(htmlToPlaintext("a<br>b")).toBe("a\nb");
    });

    it("decodes entities", () => {
      expect(htmlToPlaintext("&amp; &lt; &gt;")).toBe("& < >");
    });
  });

  describe("markdownToPlaintext", () => {
    it("strips markdown formatting", () => {
      expect(markdownToPlaintext("**bold** and *italic*")).toBe("bold and italic");
    });

    it("converts links to text (url)", () => {
      expect(markdownToPlaintext("[text](url)")).toBe("text (url)");
    });
  });

  describe("formatForChannel", () => {
    it("returns markdown as-is for discord", () => {
      expect(formatForChannel("**bold**", "discord")).toBe("**bold**");
    });

    it("converts for slack", () => {
      const result = formatForChannel("**bold** and *italic*", "slack");
      expect(result).toContain("*bold*");
      expect(result).toContain("_italic_");
    });

    it("converts to html", () => {
      expect(formatForChannel("**bold**", "html")).toContain("<strong>");
    });

    it("converts to plaintext", () => {
      expect(formatForChannel("**bold**", "plain")).toBe("bold");
    });
  });

  describe("normalizeInboundMessage", () => {
    it("normalizes standard fields", () => {
      const msg = normalizeInboundMessage({
        from: "user1",
        content: "hello",
        channelId: "telegram",
      });
      expect(msg.from).toBe("user1");
      expect(msg.content).toBe("hello");
      expect(msg.channelId).toBe("telegram");
      expect(msg.timestamp).toBeGreaterThan(0);
    });

    it("handles alternative field names", () => {
      const msg = normalizeInboundMessage({
        sender: "user2",
        body: "hi",
        provider: "whatsapp",
      });
      expect(msg.from).toBe("user2");
      expect(msg.content).toBe("hi");
      expect(msg.channelId).toBe("whatsapp");
    });

    it("defaults missing fields", () => {
      const msg = normalizeInboundMessage({});
      expect(msg.from).toBe("unknown");
      expect(msg.content).toBe("");
      expect(msg.channelId).toBe("unknown");
    });
  });

  describe("buildOutboundMessage", () => {
    it("builds outbound with formatting", () => {
      const msg = buildOutboundMessage("**hello**", {
        to: "user1",
        channelId: "telegram",
      }, "plain");
      expect(msg.content).toBe("hello");
      expect(msg.to).toBe("user1");
    });
  });

  describe("extractSenderName", () => {
    it("extracts from various fields", () => {
      expect(extractSenderName({ senderName: "Alice" })).toBe("Alice");
      expect(extractSenderName({ displayName: "Bob" })).toBe("Bob");
      expect(extractSenderName({ from: "Charlie" })).toBe("Charlie");
      expect(extractSenderName({})).toBe("Unknown");
    });
  });

  describe("truncateMessage", () => {
    it("returns short messages unchanged", () => {
      expect(truncateMessage("hello", 200)).toBe("hello");
    });

    it("truncates long messages with ellipsis", () => {
      const long = "a".repeat(300);
      const result = truncateMessage(long, 200);
      expect(result.length).toBe(200);
      expect(result.endsWith("...")).toBe(true);
    });
  });
});
