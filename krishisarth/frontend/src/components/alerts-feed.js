import { t } from '../utils/i18n.js';
import { api } from '../api/client.js';
import { store } from '../state/store.js';

export function renderAlertsFeed() {
    let panel = document.getElementById('alerts-feed-panel');
    if (!panel) {
        panel = document.createElement('aside');
        panel.id = 'alerts-feed-panel';
        panel.className = 'fixed top-0 right-0 h-screen bg-white shadow-2xl z-[100] transition-transform duration-300 ease-out flex flex-col translate-x-full';
        panel.style.width = '380px';
        panel.style.maxWidth = '100vw';
        panel.style.borderLeft = '3px solid var(--ks-green)';
        
        let overlay = document.createElement('div');
        overlay.id = 'alerts-feed-overlay';
        overlay.className = 'fixed inset-0 bg-black/20 z-[99] hidden transition-opacity opacity-0 backdrop-blur-sm cursor-pointer';
        
        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        overlay.addEventListener('click', closeAlertsFeed);
        
        // Define fallback data
        const fallbackAlerts = [
            { id: 'f1', type: 'critical', title: 'Zone A: Moisture 15%', message: 'Below wilting point', timestamp: new Date(Date.now() - 2*60000).toISOString(), read: false },
            { id: 'f2', type: 'warning', title: 'Zone C: EC rising', message: '2.8 dS/m detected', timestamp: new Date(Date.now() - 15*60000).toISOString(), read: false },
            { id: 'f3', type: 'info', title: 'AI Decision', message: 'Zone B irrigation scheduled for 06:00', timestamp: new Date(Date.now() - 60*60000).toISOString(), read: true }
        ];

        let alerts = fallbackAlerts;

        const updateContent = () => {
            const unreadCount = alerts.filter(a => !a.read).length;
            store.setState('unreadAlertCount', unreadCount);

            panel.innerHTML = `
                <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 class="font-bold text-gray-900 flex items-center gap-2" style="font-family: var(--font-display);">
                        <i data-lucide="bell-ring" class="w-5 h-5 text-[var(--ks-green)]"></i>
                        <span data-i18n="alerts_title">${t('alerts_title')}</span>
                    </h2>
                    <div class="flex items-center gap-3">
                        <button id="mark-all-read" class="text-xs font-bold text-[var(--ks-green)] hover:text-[var(--ks-green-light)] uppercase tracking-wider" data-i18n="alerts_mark_all_read">${t('alerts_mark_all_read')}</button>
                        <button id="close-alerts-btn" class="text-gray-400 hover:text-gray-700 transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                </div>
                <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                    ${alerts.length === 0 ? `
                        <div class="text-center py-10 opacity-50">
                            <i data-lucide="check-circle-2" class="w-10 h-10 mx-auto mb-3 text-gray-400"></i>
                            <p class="text-sm font-bold text-gray-500" data-i18n="alerts_empty">${t('alerts_empty')}</p>
                        </div>
                    ` : alerts.map(a => {
                        let borderColor, icon, iconColor;
                        if (a.type === 'critical') { borderColor = 'border-red-500'; icon = '🔴'; iconColor = 'text-red-500'; }
                        else if (a.type === 'warning') { borderColor = 'border-amber-500'; icon = '🟡'; iconColor = 'text-amber-500'; }
                        else { borderColor = 'border-green-500'; icon = '🟢'; iconColor = 'text-green-500'; }

                        const minsAgo = Math.max(1, Math.floor((new Date() - new Date(a.timestamp)) / 60000));
                        const timeStr = minsAgo < 60 ? `${minsAgo}${t('mins')} ${t('zone_ago')}` : `${Math.floor(minsAgo/60)}h ${t('zone_ago')}`;

                        return `
                        <div class="alert-card relative bg-white border border-gray-100 rounded-xl p-4 shadow-sm cursor-pointer transition-colors border-l-4 ${borderColor} ${!a.read ? 'bg-blue-50/40' : ''}" data-id="${a.id}">
                            ${!a.read ? `<div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 shadow-xl"></div>` : ''}
                            <div class="flex items-start gap-3">
                                <div class="mt-0.5 text-sm">${icon}</div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-gray-900 text-sm truncate" style="font-family: var(--font-display);">${a.title}</h4>
                                    <p class="text-gray-600 text-xs mt-1 leading-snug">${a.message}</p>
                                    <p class="text-gray-400 text-[10px] font-bold mt-2 uppercase tracking-wide">${timeStr}</p>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();

            panel.querySelector('#close-alerts-btn').addEventListener('click', closeAlertsFeed);
            
            panel.querySelector('#mark-all-read').addEventListener('click', async () => {
                const farm = store.getState('currentFarm');
                if (!farm?.id) return;
                
                alerts.forEach(a => a.read = true);
                updateContent();
                
                try {
                    await api(`/farms/${farm.id}/alerts/read-all`, { method: 'PATCH' });
                } catch (e) {
                    console.error("Failed to mark all read", e);
                }
            });

            panel.querySelectorAll('.alert-card').forEach(card => {
                card.addEventListener('click', async () => {
                    const alert = alerts.find(a => a.id === card.dataset.id);
                    if (alert && !alert.read) {
                        alert.read = true;
                        updateContent();
                        try {
                            await api(`/alerts/${alert.id}/read`, { method: 'PATCH' });
                        } catch (e) { }
                    }
                });
            });
        };

        const fetchAlerts = async () => {
            const farm = store.getState('currentFarm');
            if (farm?.id) {
                try {
                    const res = await api(`/farms/${farm.id}/alerts`);
                    if (res?.data && res.data.length > 0) {
                        alerts = res.data;
                    }
                } catch(e) { }
            }
            updateContent();
        };

        panel._update = updateContent;
        panel._fetch = fetchAlerts;
        
        panel._fetch();
    }
}

export function toggleAlertsFeed() {
    let panel = document.getElementById('alerts-feed-panel');
    let overlay = document.getElementById('alerts-feed-overlay');
    if (!panel) {
        renderAlertsFeed();
        panel = document.getElementById('alerts-feed-panel');
        overlay = document.getElementById('alerts-feed-overlay');
    }
    
    if (panel.classList.contains('translate-x-full')) {
        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.replace('opacity-0', 'opacity-100');
        panel.classList.remove('translate-x-full');
        panel._fetch();
    } else {
        closeAlertsFeed();
    }
}

export function closeAlertsFeed() {
    const panel = document.getElementById('alerts-feed-panel');
    const overlay = document.getElementById('alerts-feed-overlay');
    if (panel && overlay) {
        overlay.classList.replace('opacity-100', 'opacity-0');
        panel.classList.add('translate-x-full');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}
