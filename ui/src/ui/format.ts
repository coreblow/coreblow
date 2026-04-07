export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
}

export function relativeTime(ts: number): string {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const daysDifference = Math.round((ts - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (Math.abs(daysDifference) > 0) {
        return rtf.format(daysDifference, "day");
    }
    const hoursDifference = Math.round((ts - Date.now()) / (1000 * 60 * 60));
    if (Math.abs(hoursDifference) > 0) {
        return rtf.format(hoursDifference, "hour");
    }
    const minutesDifference = Math.round((ts - Date.now()) / (1000 * 60));
    if (Math.abs(minutesDifference) > 0) {
         return rtf.format(minutesDifference, "minute");
    }
    return "just now";
}
