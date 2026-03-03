/** CoreBlow — PI Image Handler */ export function isImageUrl(url: string): boolean { return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url); }
