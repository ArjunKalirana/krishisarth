import { store } from '../state/store.js';
import { showToast } from '../components/toast.js';

export function renderSupport() {
    const container = document.createElement('div');
    container.className = 'space-y-12 animate-in fade-in duration-700';
    
    let activeTab = 'enquire';
    
    const tabs = [
        {id: 'enquire', label: 'Enquiry', icon: 'message-square'},
        {id: 'problem', label: 'Fault Report', icon: 'shield-alert'},
        {id: 'visit', label: 'Calibration Visit', icon: 'navigation'},
        {id: 'contact', label: 'Direct Sync', icon: 'zap'},
    ];
    
    const render = () => {
        container.innerHTML = `
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-10 stagger-in">
                <div class="space-y-3">
                    <h1 class="text-5xl font-black tracking-tighter text-white font-display uppercase">
                        SUPPORT <span class="text-emerald-500">TERMINAL</span>
                    </h1>
                    <p class="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
                        Neural Assistance & Hardware Maintenance
                    </p>
                </div>
            </div>
            
            <!-- Tabs -->
            <div class="flex flex-wrap gap-4 mb-12 stagger-in" style="animation-delay: 100ms">
                ${tabs.map(tab => `
                    <button class="tab-btn flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 ${activeTab === tab.id ? 'bg-emerald-500 text-black shadow-2xl shadow-emerald-500/20' : 'bg-white/[0.03] text-slate-500 hover:text-white border border-white/5'}"
                            data-tab="${tab.id}">
                        <i data-lucide="${tab.icon}" class="w-4 h-4"></i>
                        ${tab.label}
                    </button>
                `).join('')}
            </div>
            
            <!-- Content -->
            <div id="support-content" class="stagger-in" style="animation-delay: 200ms"></div>
        `;
        
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
        });
        
        const content = container.querySelector('#support-content');
        
        if (activeTab === 'enquire') {
            content.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div class="lg:col-span-7 space-y-8">
                        <div class="elite-card p-10 bg-white/[0.01]">
                            <h3 class="text-white font-black mb-10 flex items-center gap-4 text-xl font-display tracking-tight uppercase">
                                <span class="text-emerald-500">Neural</span> FAQ Index
                            </h3>
                            <div class="space-y-4">
                                ${[
                                    ['How does the AI optimize irrigation?', 'Our real-time engine analyzes soil moisture gradients and weather flux to ensure zero-waste hydration cycles.'],
                                    ['Authorization Protocols (Act Mode)', 'Act Mode authorizes manual valve ignition, bypassing neural safety locks for total operator control.'],
                                    ['Sensor Fleet Scalability', 'One quantum sensor node covers 2,000sqm. Automated mesh networks expand coverage effortlessly.'],
                                    ['Report Interpretation', 'Upload soil spectrometry results; our AI extracts NPK/pH values and provides biological suggestions.'],
                                ].map(([q, a]) => `
                                    <div class="faq-item border border-white/5 rounded-[1.5rem] overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 bg-white/[0.01]">
                                        <button class="faq-q w-full text-left p-6 flex justify-between items-center text-sm text-white font-black tracking-tight hover:bg-white/[0.02]">
                                            ${q}
                                            <i data-lucide="plus" class="w-4 h-4 text-emerald-500 transition-transform duration-500 rotate-icon"></i>
                                        </button>
                                        <div class="faq-a hidden px-6 pb-6 text-sm text-slate-500 leading-relaxed font-medium opacity-70">${a}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="lg:col-span-5">
                        <div class="elite-card p-10 bg-white/[0.01] sticky top-8">
                            <h3 class="text-white font-black mb-10 flex items-center gap-4 text-xl font-display tracking-tight uppercase">
                                <span class="text-emerald-500">Initiate</span> Query
                            </h3>
                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Operator Identity</label>
                                    <input id="enq-name" type="text" placeholder="Full Name" value="${store.getState('currentFarmer')?.name || ''}"
                                           class="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-emerald-500">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Communication Link</label>
                                    <input id="enq-phone" type="tel" placeholder="+91 XXXXX XXXXX"
                                           class="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-emerald-500">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Session Topic</label>
                                    <select id="enq-topic" class="w-full px-6 py-4 bg-[#0a0f0d] border border-white/5 rounded-2xl text-slate-300 font-bold focus:outline-none focus:border-emerald-500">
                                        <option>Hardware Installation</option>
                                        <option>Software Telemetry</option>
                                        <option>AI Logic Query</option>
                                        <option>Fleet Optimization</option>
                                    </select>
                                </div>
                                <button id="submit-enq" class="btn-emerald w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(16,185,129,0.2)]">
                                    Send Transmission
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            content.querySelectorAll('.faq-q').forEach(btn => {
                btn.onclick = () => {
                    const ans = btn.nextElementSibling;
                    const icon = btn.querySelector('.rotate-icon');
                    ans.classList.toggle('hidden');
                    icon.style.transform = ans.classList.contains('hidden') ? '' : 'rotate(45deg)';
                };
            });
            
            content.querySelector('#submit-enq').onclick = () => {
                showToast('✅ Transmission Sent: Response expected within 01 temporal hour', 'success');
            };
        }
        
        else if (activeTab === 'problem') {
            content.innerHTML = `
                <div class="elite-card p-12 max-w-3xl mx-auto bg-white/[0.01]">
                    <h3 class="text-white font-black text-3xl mb-10 flex items-center gap-6 font-display tracking-tight uppercase">
                        <span class="text-red-500">Hardware</span> Fault Report
                    </h3>
                    <div class="space-y-10">
                        <div class="grid grid-cols-2 gap-4">
                            ${['Sensor Offline','Pump Failure','App Latency','AI Logic Error','Data Gaps','Other Fault'].map(p => `
                                <button class="prob-type px-8 py-5 rounded-2xl border border-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-red-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-500 text-left">
                                    ${p}
                                </button>
                            `).join('')}
                        </div>
                        <div class="space-y-2">
                             <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Affected Hub ID</label>
                             <input type="text" placeholder="e.g. Zone Sector Prime" class="w-full px-8 py-5 bg-black/40 border border-white/5 rounded-[2rem] text-white font-bold focus:outline-none focus:border-red-500">
                        </div>
                        <button class="btn-emerald w-full py-6 text-[10px] font-black uppercase tracking-[0.3em] bg-red-500 text-white border-red-500 transition-all hover:bg-black hover:text-red-500" 
                                onclick="showToast('🎫 Fault Ticket Generated: KS-F' + Math.floor(Math.random()*9999), 'success')">
                            Broadcast Emergency Alert
                        </button>
                    </div>
                </div>
            `;
        }
        
        else if (activeTab === 'visit') {
            const today = new Date().toISOString().split('T')[0];
            content.innerHTML = `
                <div class="elite-card p-12 max-w-3xl mx-auto bg-white/[0.01]">
                    <h3 class="text-white font-black text-3xl mb-10 flex items-center gap-6 font-display tracking-tight uppercase">
                         <span class="text-blue-500">Field</span> Calibration Sync
                    </h3>
                    <div class="space-y-10">
                        <div class="grid grid-cols-2 gap-8">
                            <input type="date" min="${today}" class="w-full px-8 py-5 bg-black/40 border border-white/5 rounded-[2rem] text-white font-bold focus:outline-none focus:border-blue-500">
                            <select class="w-full px-8 py-5 bg-[#0a0f0d] border border-white/5 rounded-[2rem] text-slate-300 font-bold focus:outline-none focus:border-blue-500">
                                <option>T-Sector Morning (9AM–12PM)</option>
                                <option>T-Sector Noon (12PM–4PM)</option>
                                <option>T-Sector Evening (4PM–7PM)</option>
                            </select>
                        </div>
                        <div class="bg-blue-500/[0.03] border border-blue-500/10 p-8 rounded-[2rem]">
                            <p class="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-3">Service Grid Coverage</p>
                            <p class="text-slate-500 text-sm font-medium leading-relaxed opacity-70">Expert calibration available in Pune, Nashik, and Satara sectors. Priority response enabled for Elite Subscribers.</p>
                        </div>
                        <button class="btn-emerald w-full py-6 text-[10px] font-black uppercase tracking-[0.3em] bg-blue-500 text-white border-blue-500 transition-all hover:bg-black hover:text-blue-500"
                                onclick="showToast('📅 Synchronization Scheduled: Check your terminal notification', 'success')">
                            Confirm Calibration Sync
                        </button>
                    </div>
                </div>
            `;
        }
        
        else if (activeTab === 'contact') {
            content.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    ${[
                        {icon:'phone', color:'emerald', title:'Voice Uplink', val:'+91 98765 43210', sub:'Active 08:00 - 20:00'},
                        {icon:'mail', color:'blue', title:'Encrypted Mail', val:'ops@krishisarth.com', sub:'Target Response: 24h'},
                        {icon:'message-square', color:'purple', title:'Instant Data Sync', val:'+91 98765 43210', sub:'24/7 Priority Channel'},
                    ].map(c => `
                        <div class="elite-card p-10 flex flex-col items-center text-center gap-6 hover:scale-105 transition-all duration-500 bg-white/[0.01]">
                            <div class="w-20 h-20 rounded-[2rem] bg-${c.color}-500/10 border border-${c.color}-500/20 flex items-center justify-center shadow-inner">
                                <i data-lucide="${c.icon}" class="w-10 h-10 text-${c.color}-400"></i>
                            </div>
                            <div>
                                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">${c.title}</p>
                                <p class="text-white font-black text-xl tracking-tight font-display">${c.val}</p>
                                <p class="text-[9px] text-slate-600 font-bold uppercase mt-2 tracking-widest">${c.sub}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        if (window.lucide) window.lucide.createIcons();
    };
    
    render();
    return container;
}
