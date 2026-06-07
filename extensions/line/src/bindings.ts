import { normalizeAccountId } from "./accounts.js";

export function normalizeLineAcpConversationId(params: {
  accountId?: string | null;
  conversationId: string;
}): string {
  const conversationId = params.conversationId.trim().replace(/^line:/i, "");
  const accountId = normalizeAccountId(params.accountId ?? undefined);
  return accountId === "default" ? conversationId : `${accountId}:${conversationId}`;
}

export function normalizeLineBindingTarget(raw: string): string {
  return raw.trim().replace(/^line:(?:group|room|user):/i, "").replace(/^line:/i, "");
}
