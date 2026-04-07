/**
 * Discord Timestamp Formatter — Discord's built-in timestamp format.
 */
export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export function discordTimestamp(date: Date | number, style: TimestampStyle = 'f'): string {
    const unix = Math.floor((typeof date === 'number' ? date : date.getTime()) / 1000);
    return `<t:${unix}:${style}>`;
}

export function relativeTime(date: Date | number): string { return discordTimestamp(date, 'R'); }
export function shortDate(date: Date | number): string { return discordTimestamp(date, 'd'); }
export function longDateTime(date: Date | number): string { return discordTimestamp(date, 'F'); }