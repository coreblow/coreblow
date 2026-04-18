/** CoreBlow — Reply Prefix */ export function buildReplyPrefix(userName?: string): string { return userName ? "@" + userName + " " : ""; }
