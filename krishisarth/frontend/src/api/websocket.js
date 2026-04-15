import { store } from '../state/store.js';
import { getDashboard } from './farms.js';

/**
 * KrishiSarth Real-Time Engine
 * WebSocket client with exponential backoff and gap-filling.
 */

export let wsStatus = 'disconnected';

class TelemetryWS {
    constructor() {
        this.ws = null;
        this.farmId = null;
        this.delay = 1000;
        this.reconnectTimer = null;
    }

    _setStatus(status) {
        wsStatus = status;
        document.dispatchEvent(new CustomEvent('ws-status', { detail: status }));
    }

    connect(farmId) {
        if (!farmId) return;
        this.farmId = farmId;
        
        let wsRoot = (window.__KS_API_URL__ || 'http://localhost:8000/v1').replace('http', 'ws');
        const url = `${wsRoot}/ws/farms/${farmId}`;
        console.log(`WS: Connecting to ${url}...`);
        this._setStatus('connecting');
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("WS: Connectivity ESTABLISHED");
            this.delay = 1000; // Reset backoff delay
            this._setStatus('connected');
            
            // Re-subscribe payload
            const farm = store.getState('currentFarm');
            if (farm?.id) {
                this.ws.send(JSON.stringify({ type: 'subscribe', farm_id: farm.id }));
            }
            
            // Gap-fill: Fetch fresh REST snapshot on reconnect
            this.syncState();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (err) {
                console.error("WS: Malformed message received", err);
            }
        };

        this.ws.onclose = () => {
            console.warn("WS: Connectivity LOST");
            this._setStatus('disconnected');
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error("WS: Transport error", err);
            // close will fire automatically and handle reconnect
        };
    }

    handleMessage(msg) {
        // Expected message format: { type: 'ZONE_UPDATE' | 'SYS_UPDATE' | 'HARDWARE_UPDATE', data: { ... } }
        if (msg.type === 'ZONE_UPDATE' || msg.type === 'HARDWARE_UPDATE') {
            const currentData = store.getState('sensorData') || {};
            currentData[msg.data.zone_id] = {
                ...currentData[msg.data.zone_id],
                ...msg.data
            };
            store.setState('sensorData', { ...currentData });
            
            // Dispatch a custom event to update non-react views dynamically
            if (msg.type === 'HARDWARE_UPDATE') {
                document.dispatchEvent(new CustomEvent('hardware-update', { detail: msg.data }));
            }
        }
    }

    async syncState() {
        try {
            const data = await getDashboard(this.farmId);
            if (data && data.success) {
                // Map dashboard data to sensorData state
                const sensorMap = {};
                data.data.zones.forEach(z => {
                    sensorMap[z.id] = z.latest_readings;
                });
                store.setState('sensorData', sensorMap);
            }
        } catch (err) {
            console.error("WS_SYNC: Failed to fill gaps", err);
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        
        console.log(`WS: Reconnecting in ${this.delay/1000}s`);
        this.reconnectTimer = setTimeout(() => {
            this.connect(this.farmId);
        }, this.delay);
        
        this.delay = Math.min(this.delay * 2, 30000); // cap at 30s
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            // Nullify reconnect logic first before closing explicitly
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
            this._setStatus('disconnected');
        }
    }
}

export const telemetryWS = new TelemetryWS();
