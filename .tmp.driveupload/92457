export function splitPages(text: string, maxLen = 1800): string[] { const pages: string[] = []; for (let i = 0; i < text.length; i += maxLen) pages.push(text.slice(i, i + maxLen)); return pages.length ? pages : ['']; }
export function paginate<T>(items: T[], pageSize = 10, page = 0) { return items.slice(page * pageSize, (page + 1) * pageSize); }
export function paginationButtons(page: number, totalPages: number) { return { page, totalPages, hasPrev: page > 0, hasNext: page < totalPages - 1 }; }

export function isPaginationButton(customId: string): boolean {
    return customId.startsWith('page_') || customId.startsWith('pagination_') || customId.startsWith('nav_');
}

export function getPaginationDirection(customId: string): 'next' | 'prev' | null {
    if (customId.includes('next') || customId.includes('forward')) return 'next';
    if (customId.includes('prev') || customId.includes('back')) return 'prev';
    return null;
}
export function getPaginationSessionId(customId: string): string {
    return customId.replace(/^(page_|pagination_|nav_)/, '').replace(/_(next|prev|forward|back)$/, '');
}
