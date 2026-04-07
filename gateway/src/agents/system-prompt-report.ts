/** System prompt report generation. */
export function generatePromptReport(prompt: string): { charCount: number; estimatedTokens: number; sections: number } {
    return { charCount: prompt.length, estimatedTokens: Math.ceil(prompt.length / 4), sections: (prompt.match(/^##/gm) ?? []).length };
}
