export const VALID_PAGE_SIZES = [10, 20, 50];
export const ADMIN_DEFAULT_STATE = {
    search: '',
    availability: 'all',
    sort: 'updated_desc',
    view: 'table',
    page: 1,
    pageSize: 10,
};

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

export function clampPage(page, totalItems, pageSize) {
    if (totalItems === 0) return 1;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (page > totalPages) return totalPages;
    if (page < 1) return 1;
    return page;
}

export function parseAdminUrlState(searchParams) {
    const params = typeof searchParams.get === 'function'
        ? searchParams
        : new URLSearchParams(searchParams);

    const rawView = params.get('view');
    const view = rawView === 'cards' ? 'cards' : 'table';

    const rawAvailability = params.get('availability');
    const availability = ['available', 'low', 'out'].includes(rawAvailability) ? rawAvailability : 'all';

    const rawSort = params.get('sort');
    const sort = ['updated_desc', 'title', 'author', 'copies'].includes(rawSort) ? rawSort : 'updated_desc';

    const search = params.get('search') || '';

    const pageSizeCandidate = parseInteger(params.get('pageSize'), ADMIN_DEFAULT_STATE.pageSize);
    const pageSize = VALID_PAGE_SIZES.includes(pageSizeCandidate) ? pageSizeCandidate : ADMIN_DEFAULT_STATE.pageSize;

    const page = parseInteger(params.get('page'), ADMIN_DEFAULT_STATE.page);

    return {
        search,
        availability,
        sort,
        view,
        page,
        pageSize,
    };
}

export function serializeAdminUrlState(state) {
    const params = new URLSearchParams();
    if (state.search) params.set('search', state.search);
    if (state.availability !== 'all') params.set('availability', state.availability);
    if (state.sort !== 'updated_desc') params.set('sort', state.sort);
    if (state.view !== 'table') params.set('view', state.view);
    if (state.page !== ADMIN_DEFAULT_STATE.page) params.set('page', String(state.page));
    if (state.pageSize !== ADMIN_DEFAULT_STATE.pageSize) params.set('pageSize', String(state.pageSize));
    return params;
}
