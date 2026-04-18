/** CoreBlow — Image Tool Helpers */ export function isValidImageUrl(url: string): boolean { return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(url); }
