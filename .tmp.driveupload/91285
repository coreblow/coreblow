/** PI read file tool. */
import fs from 'node:fs';
export function readFileTool(filePath: string, startLine?: number, endLine?: number): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (startLine === undefined) return content;
    const lines = content.split('\n');
    return lines.slice((startLine ?? 1) - 1, endLine ?? lines.length).join('\n');
}
