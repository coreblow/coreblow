/**
 * Discord Paginated Embed — Multi-page embed navigation.
 */
export interface PaginatedEmbedOptions { pages: Record<string, unknown>[]; currentPage: number; totalPages: number; }

export function createPaginatedEmbed(options: PaginatedEmbedOptions): { embed: Record<string, unknown>; components: Record<string, unknown>[] } {
    const embed = { ...options.pages[options.currentPage] ?? {}, footer: { text: `Page ${options.currentPage + 1} / ${options.totalPages}` } };
    const components = [{ type: 1, components: [
        { type: 2, custom_id: 'page_first', label: '⏮', style: 2, disabled: options.currentPage === 0 },
        { type: 2, custom_id: 'page_prev', label: '◀', style: 1, disabled: options.currentPage === 0 },
        { type: 2, custom_id: 'page_next', label: '▶', style: 1, disabled: options.currentPage >= options.totalPages - 1 },
        { type: 2, custom_id: 'page_last', label: '⏭', style: 2, disabled: options.currentPage >= options.totalPages - 1 },
    ] }];
    return { embed, components };
}

export function paginateItems<T>(items: T[], perPage: number): T[][] {
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
}
