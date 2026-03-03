/**
 * Msteams Message Formatter
 */
export class MsteamsFormatter {
  formatText(text: string): string {
    return text;
  }

  formatBold(text: string): string {
    return '**' + text + '**';
  }

  formatItalic(text: string): string {
    return '_' + text + '_';
  }

  formatCode(code: string, lang = ''): string {
    return '```' + lang + '\n' + code + '\n```';
  }

  formatLink(url: string, label?: string): string {
    return label ? '[' + label + '](' + url + ')' : url;
  }

  formatMention(userId: string): string {
    return '<@' + userId + '>';
  }

  formatEmbed(title: string, description: string, color?: string) {
    return { title, description, color: color || '#6366f1' };
  }

  truncate(text: string, maxLen = 2000): string {
    return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
  }
}
