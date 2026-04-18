/** CoreBlow — PI Run Images */ export function extractImageUrls(content: string): string[] { return [...content.matchAll(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/gi)].map((m) => m[0]); }
