import { api, setToken, clearToken } from './client.js';
import { store } from '../state/store.js';

export async function login(email, password) {
    const response = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

    if (!response?.success) throw new Error('LOGIN_FAILED');

    const d = response.data;

    // Access token → memory only (via client.js)
    setToken(d.access_token);

    // Refresh token → sessionStorage directly (never through store)
    sessionStorage.setItem('ks_refresh_token', d.refresh_token);

    // Store ONLY safe farmer info — no tokens
    store.setState('currentFarmer', {
        farmer_id: d.farmer_id,
        name:      d.name,
        email:     d.email,
    });

    return response;
}

export async function register(name, email, password, phone) {
    const response = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone }),
    });

    if (!response?.success) throw new Error('REGISTER_FAILED');

    const d = response.data;
    setToken(d.access_token);
    sessionStorage.setItem('ks_refresh_token', d.refresh_token);
    store.setState('currentFarmer', { farmer_id: d.farmer_id, name: d.name, email: d.email });
    return response;
}

export function logout() {
    clearToken();
    store.setState('currentFarmer', null);
    store.setState('currentFarm', null);
    window.location.hash = '#login';
}
