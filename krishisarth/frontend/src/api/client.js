/**
 * KrishiSarth API Client
 * - Access token: In-memory closure ONLY (XSS-safe)
 * - Refresh token: sessionStorage (survives reload, wiped on tab close)
 */

const API_PROD_URL = 'https://krishisarth-production.up.railway.app/v1';
const API_DEV_URL  = 'http://localhost:8000/v1';

const BASE_URL = window.__KS_API_URL__ || 
    (window.location.hostname.includes('railway') || window.location.hostname.includes('vercel') 
        ? API_PROD_URL 
        : API_DEV_URL);

// --- Secure Token Closure ---
let _accessToken = null;
let _refreshing  = false;
let _refreshQueue = [];

export function setToken(token) {
    _accessToken = token;
}

export function getToken() {
    return _accessToken;
}

export function clearToken() {
    _accessToken = null;
    sessionStorage.removeItem('ks_refresh');
    sessionStorage.removeItem('ks_farmer');
}

/** 
 * Silent Refresh on Page Reload 
 * This attempts to restore a session using the sessionStorage refresh token.
 */
export async function attemptSilentRefresh() {
    const rf = sessionStorage.getItem('ks_refresh');
    if (!rf) return false;
    try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: rf }),
            credentials: 'include'
        });
        if (res.ok) {
            const body = await res.json();
            const data = body.data || body;
            setToken(data.access_token);
            sessionStorage.setItem('ks_refresh', data.refresh_token);
            return true;
        }
    } catch (e) {
        console.warn('[AUTH] Silent refresh failed:', e);
    }
    return false;
}

import { showToast } from '../components/toast.js';

export async function api(path, options = {}, attempt = 1) {
    const timeout = options.timeout || 30000; // Default increased to 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;

    try {
        const response = await _fetchWithAuth(path, options);
        clearTimeout(timeoutId);

        if (response.status === 401) {
            if (path.includes('/auth/refresh') || path.includes('/auth/login')) {
                throw new Error('AUTH_FAILED');
            }

            const refreshed = await _refreshAccessToken();
            if (refreshed) {
                return await api(path, options, 2);
            }

            clearToken();
            showToast('Session Expired — Re-authenticating', 'warning');
            window.location.hash = '#login';
            return null;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'API_ERROR');
        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') throw new Error('REQUEST_TIMEOUT');
        throw err;
    }
}

async function _fetchWithAuth(path, options) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
}

async function _refreshAccessToken() {
    if (_refreshing) {
        return new Promise(resolve => _refreshQueue.push(resolve));
    }
    const refreshToken = sessionStorage.getItem('ks_refresh');
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
            const data = body.data || body;
            setToken(data.access_token);
            sessionStorage.setItem('ks_refresh', data.refresh_token);
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
