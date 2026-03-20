/**
 * KrishiSarth Store — minimal pub/sub.
 * Token storage policy:
 *   accessToken  → client.js memory only
 *   refreshToken → sessionStorage via client.js
 *   currentFarmer → sessionStorage (survives hash navigation)
 */

function _safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

class Store {
    constructor() {
        this.state = {
            currentFarmer: _safeParse(sessionStorage.getItem('ks_farmer')),
            currentFarm:   _safeParse(sessionStorage.getItem('ks_current_farm')),
            activeZones:      [],
            unreadAlertCount: 0,
            sensorData:       {},
            activePage:       window.location.hash || '#dashboard',
        };
        this.listeners = {};
    }

    getState(key) {
        return this.state[key];
    }

    setState(key, value) {
        this.state[key] = value;

        if (key === 'currentFarmer') {
            if (value) sessionStorage.setItem('ks_farmer', JSON.stringify(value));
            else sessionStorage.removeItem('ks_farmer');
        }
        if (key === 'currentFarm') {
            if (value) sessionStorage.setItem('ks_current_farm', JSON.stringify(value));
            else sessionStorage.removeItem('ks_current_farm');
        }

        this._notify(key, value);
    }

    subscribe(key, callback) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(callback);
        // Returns unsubscribe function
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    _notify(key, value) {
        (this.listeners[key] || []).forEach(cb => cb(value));
    }
}

export const store = new Store();
