/**
 * Discord Modals — Popup forms for user input.
 */
export function createModal(customId: string, title: string, fields: Array<{ id: string; label: string; style?: number; placeholder?: string; required?: boolean; maxLength?: number }>): Record<string, unknown> {
    return {
        title, custom_id: customId,
        components: fields.map((f) => ({
            type: 1,
            components: [{ type: 4, custom_id: f.id, label: f.label, style: f.style ?? 1, placeholder: f.placeholder, required: f.required ?? true, max_length: f.maxLength ?? 4000 }],
        })),
    };
}

export function parseModalSubmission(data: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    const components = (data.components ?? []) as Array<{ components: Array<{ custom_id: string; value: string }> }>;
    for (const row of components) {
        for (const field of row.components) result[field.custom_id] = field.value;
    }
    return result;
}
