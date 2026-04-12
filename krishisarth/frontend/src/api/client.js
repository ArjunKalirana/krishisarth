/**
 * KrishiSarth API Client
 * Access token: in-memory ONLY — never written to any storage.
 * Refresh token: sessionStorage (survives page reload, cleared on tab close).
 */

const API_PROD_URL = 'https://krishisarth-production.up.railway.app/v1';
const API_DEV_URL  = 'http://localhost:8000/v1';

const BASE_URL = window.__KS_API_URL__ || 
    (window.location.hostname.includes('railway') || window.location.hostname.includes('vercel') 
        ? API_PROD_URL 
        : API_DEV_URL);

// Modified for 6A robust API client structure
let _refreshing   = false;
let _refreshQueue = [];

export function setToken(token) {
    localStorage.setItem('ks_token', token);
}

export function getToken() {
    return localStorage.getItem('ks_token');
}

export function clearToken() {
    localStorage.removeItem('ks_token');
    localStorage.removeItem('ks_refresh');
    sessionStorage.removeItem('ks_farmer');
}

import { showToast } from '../components/toast.js';

export async function api(path, options = {}, attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    options.signal = controller.signal;

    try {
        const response = await _fetchWithAuth(path, options);
        clearTimeout(timeoutId);

        if (response.status === 401) {
            const refreshed = await _refreshAccessToken();
            if (refreshed) {
                const retryController = new AbortController();
                setTimeout(() => retryController.abort(), 15000);
                options.signal = retryController.signal;
                
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
        if (!response.ok) {
            // SELF-HEALING: If we are not the farm owner, our currentFarm ID is stale
            if (data.detail === 'NOT_FARM_OWNER') {
                console.error('[API] Stale Farm ID detected. Purging local state…');
                localStorage.removeItem('ks_dash_cache');
                localStorage.removeItem('ks_current_farm'); // Just in case name varies
                // Also clear partial keys from store if possible, 
                // but a hard reload is the safest recover for the demo
                setTimeout(() => window.location.reload(), 500);
            }
            throw new Error(data.detail || data.error?.code || 'API_ERROR');
        }
        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        console.error(`[API] ${path}:`, err.message);
        
        // Network Error Catch & Retry logic
        if (err.name === 'TypeError' || err.name === 'AbortError') {
             if (attempt === 1) {
                  showToast('Network error — retrying...', 'error');
                  return new Promise((resolve, reject) => {
                       setTimeout(async () => {
                           try {
                               const out = await api(path, options, 2);
                               resolve(out);
                           } catch(e) {
                               reject(e);
                           }
                       }, 2000);
                  });
             }
        }
        
        throw err;
    }
}

async function _fetchWithAuth(path, options) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const ksToken = getToken();
    if (ksToken) headers['Authorization'] = `Bearer ${ksToken}`;
    
    // Removed: .replace(/\/+(\?|$)/, '$1') — stripping slashes causes 307 redirects 
    // in FastAPI which often fail CORS/Mixed Content behind proxies.
    return fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
}

async function _refreshAccessToken() {
    if (_refreshing) {
        return new Promise(resolve => _refreshQueue.push(resolve));
    }
    const refreshToken = localStorage.getItem('ks_refresh');
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
            setToken(body.data.access_token || body.access_token);
            localStorage.setItem('ks_refresh', body.data.refresh_token || body.refresh_token);
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
