/** PI host edit tool. */
export interface EditOperation { filePath: string; oldContent: string; newContent: string; }
export function validateEdit(op: EditOperation): { valid: boolean; error?: string } {
    if (!op.filePath) return { valid: false, error: 'Missing file path' };
    if (!op.oldContent && !op.newContent) return { valid: false, error: 'Empty edit' };
    return { valid: true };
}
