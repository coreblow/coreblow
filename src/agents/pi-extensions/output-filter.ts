/** CoreBlow — PI Output Filter */ export function filterOutput(text: string): string { return text.replace(/<\/?thinking>/g, ""); }
