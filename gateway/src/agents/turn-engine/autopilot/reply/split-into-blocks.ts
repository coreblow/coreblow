/**
 * CoreBlow AutoPilot — splitIntoBlocks
 */
export function splitIntoBlocks(text: string, maxBlockSize?: number): string[] {
    const max = maxBlockSize ?? 4000;
    if (text.length <= max) return [text];

    const blocks: string[] = [];
    const paragraphs = text.split('\n\n');
    let current = '';

    for (const para of paragraphs) {
        if (current.length + para.length + 2 > max) {
            if (current) blocks.push(current.trim());
            current = para;
        } else {
            current += (current ? '\n\n' : '') + para;
        }
    }
    if (current) blocks.push(current.trim());

    return blocks;
}
