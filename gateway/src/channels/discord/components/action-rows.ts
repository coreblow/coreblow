/**
 * Discord Action Rows — Container for interactive components.
 */
export function createActionRow(components: Record<string, unknown>[]): Record<string, unknown> {
    return { type: 1, components: components.slice(0, 5) }; // Discord max 5 per row
}

export function createMultiRow(rows: Record<string, unknown>[][]): Record<string, unknown>[] {
    return rows.slice(0, 5).map((components) => createActionRow(components)); // Max 5 rows
}