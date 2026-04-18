/** CoreBlow — Message Helpers */ export function formatMessagePreview(text: string, maxLen = 80): string { return text.length > maxLen ? text.slice(0, maxLen) + "..." : text; }
