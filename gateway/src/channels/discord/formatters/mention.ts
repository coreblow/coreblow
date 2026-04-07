export function mentionUser(id: string) { return `<@${id}>`; }
export function mentionRole(id: string) { return `<@&${id}>`; }
export function mentionChannel(id: string) { return `<#${id}>`; }