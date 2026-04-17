// @ts-nocheck
import MarkdownIt from "markdown-it";
import { isAutoLinkedFileRef } from "coreblow/plugin-sdk/text-runtime";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

md.enable("strikethrough");

const { escapeHtml } = md.utils;
function shouldSuppressAutoLink(
  tokens: Parameters<NonNullable<typeof md.renderer.rules.link_open>>[0],
  idx: number,
): boolean {
  const token = tokens[idx];
  if (token?.type !== "link_open" || token.info !== "auto") {
    return false;
  }
  const href = token.attrGet("href") ?? "";
  const label = tokens[idx + 1]?.type === "text" ? (tokens[idx + 1]?.content ?? "") : "";
  return Boolean(href && label && isAutoLinkedFileRef(href, label));
}

md.renderer.rules.image = (tokens: any, idx: any) => escapeHtml(tokens[idx]?.content ?? "");

md.renderer.rules.html_block = (tokens: any, idx: any) => escapeHtml(tokens[idx]?.content ?? "");
md.renderer.rules.html_inline = (tokens: any, idx: any) => escapeHtml(tokens[idx]?.content ?? "");
md.renderer.rules.link_open = (tokens: any, idx: any, _options: any, _env: any, self: any) =>
  shouldSuppressAutoLink(tokens, idx) ? "" : self.renderToken(tokens, idx, _options);
md.renderer.rules.link_close = (tokens: any, idx: any, _options: any, _env: any, self: any) => {
  const openIdx = idx - 2;
  if (openIdx >= 0 && shouldSuppressAutoLink(tokens, openIdx)) {
    return "";
  }
  return self.renderToken(tokens, idx, _options);
};

export function markdownToMatrixHtml(markdown: string): string {
  const rendered = md.render(markdown ?? "");
  return rendered.trimEnd();
}
