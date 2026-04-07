/**
 * Discord Select Menus — Dropdown selection components.
 */
export interface SelectOption { label: string; value: string; description?: string; emoji?: string; default?: boolean; }

export function createStringSelect(customId: string, options: SelectOption[], placeholder?: string, minValues = 1, maxValues = 1): Record<string, unknown> {
    return { type: 3, custom_id: customId, options, placeholder, min_values: minValues, max_values: maxValues };
}

export function createUserSelect(customId: string, placeholder?: string): Record<string, unknown> {
    return { type: 5, custom_id: customId, placeholder };
}

export function createChannelSelect(customId: string, placeholder?: string): Record<string, unknown> {
    return { type: 8, custom_id: customId, placeholder };
}