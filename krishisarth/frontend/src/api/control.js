import { api } from './client.js';

/**
 * Control API Service
 * Manages physical hardware overrides for pumps, valves, and injectors.
 */

export async function startIrrigation(zoneId, durationMin) {
    return await api(`/zones/${zoneId}/irrigate/`, {
        method: 'POST',
        body: JSON.stringify({ duration_minutes: durationMin })
    });
}

export async function stopIrrigation(zoneId) {
    return await api(`/zones/${zoneId}/stop/`, {
        method: 'POST'
    });
}

export async function injectFertigation(zoneId, nutrientType, concentrationMl) {
    return await api(`/zones/${zoneId}/fertigation/`, {
        method: 'POST',
        body: JSON.stringify({
            nutrient_type: nutrientType,
            concentration_ml_l: concentrationMl
        })
    });
}
export async function setZoneMode(zoneId, mode) {
    return await api(`/zones/${zoneId}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ mode })
    });
}
