/** CoreBlow — Web Fetch Utils */ export function extractTextFromHtml(html: string): string { return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
