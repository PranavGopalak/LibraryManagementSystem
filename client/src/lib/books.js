export const AVAILABILITY_STATUS = {
    AVAILABLE: 'available',
    LOW: 'low',
    OUT: 'out',
};

export function mapBookFromApi(book) {
    if (!book || typeof book !== 'object') {
        return null;
    }
    return {
        id: book.id,
        title: book.title || '',
        authors: book.author || book.authors || '',
        isbn: book.isbn ? book.isbn : '',
        description: book.description || '',
        pageCount: typeof book.pageCount === 'number' ? book.pageCount : book.page_count || 0,
        copies: typeof book.copies === 'number' ? book.copies : 0,
        updatedAt: book.updatedAt || book.updated_at || book.modifiedAt || null,
    };
}

export function getAvailabilityStatus(copies) {
    if (copies <= 0) return AVAILABILITY_STATUS.OUT;
    if (copies <= 2) return AVAILABILITY_STATUS.LOW;
    return AVAILABILITY_STATUS.AVAILABLE;
}

export function getAvailabilityLabel(status) {
    switch (status) {
        case AVAILABILITY_STATUS.AVAILABLE:
            return 'Available';
        case AVAILABILITY_STATUS.LOW:
            return 'Low Stock';
        default:
            return 'Out of Stock';
    }
}

export function formatUpdatedAt(value) {
    if (!value) return 'Unknown';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date?.getTime?.())) {
        return 'Unknown';
    }
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
