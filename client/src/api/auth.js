const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
    console.log('[API][REQUEST]', { url: `${BASE_URL}${path}`, method: options.method || 'GET' });
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
        const message = (data && data.message) || res.statusText;
        console.warn('[API][ERROR]', { status: res.status, message, data });
        const error = new Error(message);
        error.status = res.status;
        error.data = data;
        throw error;
    }
    console.log('[API][RESPONSE]', { status: res.status, ok: res.ok });
    return data;
}

export async function signup({ username, email, password, role = 'patron', adminInviteCode }) {
    console.log('[API][SIGNUP] sending payload', { username, emailPresent: !!email });
    return request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role, adminInviteCode })
    });
}

export async function login({ usernameOrEmail, password }) {
    console.log('[API][LOGIN] sending payload', { usernameOrEmailPresent: !!usernameOrEmail });
    return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, password })
    });
}

export async function me(token) {
    return request('/api/auth/me', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
}

export function storeToken(token) {
    if (token) localStorage.setItem('auth_token', token);
}

export function getToken() {
    return localStorage.getItem('auth_token');
}

export function clearToken() {
    localStorage.removeItem('auth_token');
}


