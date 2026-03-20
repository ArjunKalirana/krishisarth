import { api } from './client.js';

/**
 * Historical Analytics API Service
 * Metrics aggregation and raw data export.
 */

export async function getAnalytics(farmId, from, to, zoneId = null) {
    let url = `/farms/${farmId}/analytics/`;
    const params = new URLSearchParams({ from_date: from, to_date: to });
    if (zoneId) params.append('zone_id', zoneId);
    
    return await api(`${url}?${params.toString()}`);
}

export function exportCSV(farmId, from, to) {
    const url = `http://localhost:8000/v1/farms/${farmId}/analytics/export/?from_date=${from}&to_date=${to}`;
    window.open(url, '_blank');
}
