/** Live model filtering. */
export function filterModels(models: Array<{ id: string; disabled?: boolean }>, query?: string): typeof models {
    let result = models.filter((m) => !m.disabled);
    if (query) result = result.filter((m) => m.id.toLowerCase().includes(query.toLowerCase()));
    return result;
}
