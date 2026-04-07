/**
 * KrishiSarth API Client
 * Access token: in-memory ONLY — never written to any storage.
 * Refresh token: sessionStorage (survives page reload, cleared on tab close).
 */

const BASE_URL = window.__KS_API_URL__ || 'http://localhost:8000/v1';

let _accessToken = null;
let _refreshing   = false;
let _refreshQueue = [];

export function setToken(token) {
    _accessToken = token;
}

export function getToken() {
    return _accessToken;
}

export function clearToken() {
    _accessToken = null;
    sessionStorage.removeItem('ks_refresh_token');
    sessionStorage.removeItem('ks_farmer');
}

export async function api(path, options = {}) {
    try {
        const response = await _fetchWithAuth(path, options);

        if (response.status === 401) {
            const refreshed = await _refreshAccessToken();
            if (refreshed) {
                const retry = await _fetchWithAuth(path, options);
                const retryData = await retry.json();
                if (!retry.ok) throw new Error(retryData.error?.code || 'API_ERROR');
                return retryData;
            }
            clearToken();
            window.location.hash = '#login';
            return null;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.code || 'API_ERROR');
        return data;
    } catch (err) {
        console.error(`[API] ${path}:`, err.message);
        throw err;
    }
}

async function _fetchWithAuth(path, options) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
    
    // Fix: Strip trailing slashes to prevent 307 redirects to HTTP which cause Mixed Content
    const cleanPath = path.replace(/\/+(\?|$)/, '$1');
    return fetch(`${BASE_URL}${cleanPath}`, { ...options, headers, credentials: 'include' });
}

async function _refreshAccessToken() {
    if (_refreshing) {
        return new Promise(resolve => _refreshQueue.push(resolve));
    }
    const refreshToken = sessionStorage.getItem('ks_refresh_token');
    if (!refreshToken) return false;

    _refreshing = true;
    try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
            credentials: 'include',
        });
        if (res.ok) {
            const body = await res.json();
            setToken(body.data.access_token);
            sessionStorage.setItem('ks_refresh_token', body.data.refresh_token);
            _refreshQueue.forEach(r => r(true));
            _refreshQueue = [];
            return true;
        }
        _refreshQueue.forEach(r => r(false));
        _refreshQueue = [];
        return false;
    } catch {
        _refreshQueue.forEach(r => r(false));
        _refreshQueue = [];
        return false;
    } finally {
        _refreshing = false;
    }
}
