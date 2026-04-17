/**
 * media-understanding/document-parser.ts
 */
export function parseTextDocument(content: string): {title: string; sections: Array<{heading: string; content: string}>} { const lines = content.split('\n'); const title = lines[0] || 'Untitled'; const sections: Array<{heading: string; content: string}> = []; let currentHeading = ''; let currentContent: string[] = []; for (const line of lines.slice(1)) { if (line.startsWith('#')) { if (currentHeading) sections.push({heading: currentHeading, content: currentContent.join('\n')}); currentHeading = line.replace(/^#+\s*/, ''); currentContent = []; } else currentContent.push(line); } if (currentHeading) sections.push({heading: currentHeading, content: currentContent.join('\n')}); return {title, sections}; }
