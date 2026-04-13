import { api } from '../api/client.js';
import { store } from '../state/store.js';
import { showToast } from '../components/toast.js';

export function renderSupport() {
    const container = document.createElement('div');
    container.className = 'space-y-8 animate-in fade-in duration-500';
    
    let activeTab = 'enquire';
    
    const tabs = [
        {id: 'enquire', label: 'Enquire', icon: 'message-circle'},
        {id: 'problem', label: 'Report Problem', icon: 'alert-triangle'},
        {id: 'visit', label: 'Schedule Visit', icon: 'calendar'},
        {id: 'contact', label: 'Contact Us', icon: 'phone'},
    ];
    
    const render = () => {
        container.innerHTML = `
            <div class="space-y-1 mb-8">
                <h1 class="text-3xl font-black text-white" style="font-family:var(--font-display)">
                    Customer <span class="text-emerald-500">Support</span>
                </h1>
                <p class="text-slate-400">We're here to help you grow better</p>
            </div>
            
            <!-- Tabs -->
            <div class="flex flex-wrap gap-2 mb-8">
                ${tabs.map(tab => `
                    <button class="tab-btn flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}"
                            data-tab="${tab.id}">
                        <i data-lucide="${tab.icon}" class="w-4 h-4"></i>
                        ${tab.label}
                    </button>
                `).join('')}
            </div>
            
            <!-- Content -->
            <div id="support-content"></div>
        `;
        
        if (window.lucide) window.lucide.createIcons();
        
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
        });
        
        const content = container.querySelector('#support-content');
        
        if (activeTab === 'enquire') {
            content.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="space-y-6">
                        <div class="ks-card glass-panel p-6">
                            <h3 class="text-white font-black mb-4 flex items-center gap-2">
                                <i data-lucide="help-circle" class="w-5 h-5 text-emerald-400"></i> FAQs
                            </h3>
                            ${[
                                ['How does the AI decide when to irrigate?', 'Our AI monitors real-time soil moisture from your ESP32 sensors. When moisture drops below crop-specific thresholds, it schedules irrigation automatically.'],
                                ['What is Act Mode?', 'Act Mode gives you manual control over your irrigation system. In View Mode, only sensors and AI can trigger commands — preventing conflicts.'],
                                ['How many sensors do I need?', 'One sensor node covers up to 2000 sq meters. Our auto-zone calculator tells you the exact count for your farm.'],
                                ['How do I read a soil report?', 'Upload a photo of your soil test report and our OCR engine will extract pH, NPK values and suggest suitable crops.'],
                            ].map(([q, a]) => `
                                <div class="faq-item border border-white/5 rounded-xl overflow-hidden mb-3">
                                    <button class="faq-q w-full text-left p-4 flex justify-between items-center text-sm text-white font-bold hover:bg-white/5 transition-colors">
                                        ${q}
                                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 shrink-0 ml-3 transition-transform"></i>
                                    </button>
                                    <div class="faq-a hidden px-4 pb-4 text-sm text-slate-400">${a}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="ks-card glass-panel p-6">
                        <h3 class="text-white font-black mb-4 flex items-center gap-2">
                            <i data-lucide="send" class="w-5 h-5 text-emerald-400"></i> Send Enquiry
                        </h3>
                        <div class="space-y-4">
                            <input id="enq-name" type="text" placeholder="Your Name" value="${store.getState('currentFarmer')?.name || ''}"
                                   class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm">
                            <input id="enq-phone" type="tel" placeholder="Phone Number (+91 XXXXX XXXXX)"
                                   class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm">
                            <select id="enq-topic" class="w-full px-4 py-3 bg-[#0f1a13] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 text-sm">
                                <option>Sensor Installation</option>
                                <option>Software Issue</option>
                                <option>AI / Irrigation Query</option>
                                <option>Pricing & Plans</option>
                                <option>General Enquiry</option>
                            </select>
                            <textarea id="enq-msg" rows="4" placeholder="Describe your enquiry..."
                                      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm resize-none"></textarea>
                            <button id="submit-enq" class="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all text-sm uppercase tracking-wider">
                                Submit Enquiry
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // FAQ accordion
            content.querySelectorAll('.faq-q').forEach(btn => {
                btn.onclick = () => {
                    const ans = btn.nextElementSibling;
                    const icon = btn.querySelector('[data-lucide="chevron-down"]');
                    ans.classList.toggle('hidden');
                    icon.style.transform = ans.classList.contains('hidden') ? '' : 'rotate(180deg)';
                };
            });
            
            content.querySelector('#submit-enq').onclick = () => {
                showToast('✅ Enquiry submitted! We\'ll contact you within 24 hours.', 'success');
            };
            
            if (window.lucide) window.lucide.createIcons();
        }
        
        else if (activeTab === 'problem') {
            content.innerHTML = `
                <div class="ks-card glass-panel p-8 max-w-2xl">
                    <h3 class="text-white font-black text-xl mb-6 flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-400"></i> Report a Problem
                    </h3>
                    <div class="space-y-5">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Problem Type</label>
                            <div class="grid grid-cols-2 gap-3">
                                ${['Sensor Offline','Pump Not Working','App Bug','AI Wrong Decision','Data Missing','Other'].map(p => `
                                    <button class="prob-type px-4 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-bold hover:border-amber-500 hover:text-amber-400 transition-all text-left">
                                        ${p}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Affected Zone (optional)</label>
                            <input id="prob-zone" type="text" placeholder="e.g. Zone A, Grape Vineyard"
                                   class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</label>
                            <textarea rows="4" placeholder="Describe the problem in detail..."
                                      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm resize-none"></textarea>
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Priority</label>
                            <div class="flex gap-3">
                                ${[['low','Low','text-slate-400 border-white/10'], ['medium','Medium','text-amber-400 border-amber-500/30'], ['high','High','text-red-400 border-red-500/30']].map(([v,l,c]) => `
                                    <button class="priority-btn flex-1 py-2 rounded-xl border font-black text-xs uppercase ${c} hover:bg-white/5 transition-all" data-priority="${v}">${l}</button>
                                `).join('')}
                            </div>
                        </div>
                        <button class="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-all text-sm uppercase tracking-wider" 
                                onclick="showToast('🎫 Ticket #KS-' + Math.floor(Math.random()*9999) + ' created. Expected resolution: 24h', 'success')">
                            Submit Problem Report
                        </button>
                    </div>
                </div>
            `;
            content.querySelectorAll('.prob-type').forEach(btn => {
                btn.onclick = () => {
                    content.querySelectorAll('.prob-type').forEach(b => b.classList.remove('border-amber-500','text-amber-400'));
                    btn.classList.add('border-amber-500','text-amber-400');
                };
            });
            if (window.lucide) window.lucide.createIcons();
        }
        
        else if (activeTab === 'visit') {
            const today = new Date().toISOString().split('T')[0];
            content.innerHTML = `
                <div class="ks-card glass-panel p-8 max-w-2xl">
                    <h3 class="text-white font-black text-xl mb-6 flex items-center gap-2">
                        <i data-lucide="calendar" class="w-5 h-5 text-blue-400"></i> Schedule a Field Visit
                    </h3>
                    <p class="text-slate-400 text-sm mb-6">Our agriculture expert will visit your farm for installation, calibration, or troubleshooting.</p>
                    <div class="space-y-5">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Preferred Date</label>
                                <input type="date" min="${today}" 
                                       class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 text-sm">
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Time Slot</label>
                                <select class="w-full px-4 py-3 bg-[#0f1a13] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 text-sm">
                                    <option>Morning (9AM–12PM)</option>
                                    <option>Afternoon (12PM–4PM)</option>
                                    <option>Evening (4PM–7PM)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Visit Purpose</label>
                            <div class="grid grid-cols-2 gap-3">
                                ${['Sensor Installation','System Calibration','Troubleshooting','Training & Demo','Soil Testing','General Inspection'].map(p=>`
                                    <button class="visit-type px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold hover:border-emerald-500 hover:text-emerald-400 transition-all text-left">${p}</button>
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Farm Address</label>
                            <input type="text" placeholder="Village, Taluka, District, Pin"
                                   class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm">
                        </div>
                        <div class="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Service Coverage</p>
                            <p class="text-slate-400 text-xs">Pune, Nashik, Ahmednagar, Satara, Solapur districts. Free within 50km of Pune.</p>
                        </div>
                        <button class="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all text-sm uppercase tracking-wider"
                                onclick="showToast('📅 Visit scheduled! Confirmation sent to your registered number.', 'success')">
                            Confirm Visit Request
                        </button>
                    </div>
                </div>
            `;
            content.querySelectorAll('.visit-type').forEach(btn => {
                btn.onclick = () => {
                    content.querySelectorAll('.visit-type').forEach(b => b.classList.remove('border-emerald-500','text-emerald-400'));
                    btn.classList.add('border-emerald-500','text-emerald-400');
                };
            });
            if (window.lucide) window.lucide.createIcons();
        }
        
        else if (activeTab === 'contact') {
            content.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${[
                        {icon:'phone', color:'emerald', title:'Call Us', val:'+91 98765 43210', sub:'Mon–Sat, 8AM–8PM'},
                        {icon:'mail', color:'blue', title:'Email', val:'support@krishisarth.com', sub:'Reply within 24h'},
                        {icon:'message-square', color:'green', title:'WhatsApp', val:'+91 98765 43210', sub:'Instant support'},
                    ].map(c => `
                        <div class="ks-card glass-panel p-6 flex flex-col items-center text-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-${c.color}-500/10 border border-${c.color}-500/20 flex items-center justify-center">
                                <i data-lucide="${c.icon}" class="w-7 h-7 text-${c.color}-400"></i>
                            </div>
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.title}</p>
                                <p class="text-white font-black mt-1">${c.val}</p>
                                <p class="text-slate-500 text-xs mt-1">${c.sub}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="ks-card glass-panel p-8 mt-6">
                    <h3 class="text-white font-black mb-6">Office Location</h3>
                    <div class="bg-white/5 rounded-2xl h-48 flex items-center justify-center border border-white/10">
                        <div class="text-center">
                            <div class="text-4xl mb-2">📍</div>
                            <p class="text-white font-bold">KrishiSarth Technologies</p>
                            <p class="text-slate-400 text-sm">College of Engineering Pune (COEP), Pune — 411005</p>
                            <p class="text-slate-500 text-xs mt-1">Maharashtra, India</p>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    };
    
    render();
    return container;
}
