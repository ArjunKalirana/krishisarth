import { store } from '../state/store.js';
import { getDashboard } from './farms.js';

/**
 * KrishiSarth Real-Time Engine
 * WebSocket client with exponential backoff and gap-filling.
 */

class TelemetryWS {
    constructor() {
        this.ws = null;
        this.farmId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 30000; // 30s
    }

    connect(farmId) {
        if (!farmId) return;
        this.farmId = farmId;
        
        const url = `ws://localhost:8000/v1/ws/farms/${farmId}`;
        
        console.log(`WS: Connecting to ${url}...`);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("WS: Connectivity ESTABLISHED");
            this.reconnectAttempts = 0;
            this.updateNavbarStatus(true);
            
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
            this.updateNavbarStatus(false);
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error("WS: Transport error", err);
            this.ws.close();
        };
    }

    handleMessage(msg) {
        // Expected message format: { type: 'ZONE_UPDATE' | 'SYS_UPDATE', data: { ... } }
        if (msg.type === 'ZONE_UPDATE') {
            const currentData = store.getState('sensorData') || {};
            currentData[msg.data.zone_id] = {
                ...currentData[msg.data.zone_id],
                ...msg.data
            };
            store.setState('sensorData', { ...currentData });
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
        const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, this.maxReconnectDelay);
        console.log(`WS: Reconnecting in ${delay/1000}s (Attempt ${this.reconnectAttempts + 1})`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.farmId);
        }, delay);
    }

    updateNavbarStatus(isOnline) {
        const liveBadge = document.querySelector('.pulse-dot');
        if (liveBadge) {
            if (isOnline) {
                liveBadge.classList.replace('bg-amber-500', 'bg-primary-light');
                liveBadge.title = "Live: Synchronized";
            } else {
                liveBadge.classList.replace('bg-primary-light', 'bg-amber-500');
                liveBadge.title = "Offline: Attempting Reconnect...";
            }
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const telemetryWS = new TelemetryWS();
