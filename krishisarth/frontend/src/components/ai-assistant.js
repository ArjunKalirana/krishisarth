import { t, getLanguage } from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api } from '../api/client.js';

const SPEECH_LANG_MAP = {
    en: 'en-IN',
    hi: 'hi-IN',
    mr: 'mr-IN',
};

let _isOpen = false;
let _messages = [];
let _widgetEl = null;

/**
 * KrishiSarth AI Assistant (Elite Edition)
 * A high-fidelity neural interface for real-time farm orchestration.
 */
export function initAIAssistant() {
    if (_widgetEl) return;
    _widgetEl = _buildWidget();
    document.body.appendChild(_widgetEl);
    if (window.lucide) window.lucide.createIcons();
}

function _buildWidget() {
    const el = document.createElement('div');
    el.id = 'ks-assistant';
    el.className = "fixed bottom-6 right-6 z-[9998] font-main antialiased";

    el.innerHTML = `
        <!-- Elite Toggle Button -->
        <button id="assistant-toggle" class="group relative w-16 h-16 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-all duration-500 active:scale-90 hover:rounded-2xl overflow-hidden border border-emerald-400/30">
            <div class="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-emerald-400 opacity-100"></div>
            <div class="absolute -inset-1 blur-2xl bg-emerald-500/40 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <i data-lucide="bot" class="w-7 h-7 text-white relative z-10"></i>
            <span id="assistant-badge" class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[9px] font-black hidden items-center justify-center border-2 border-[#0a0f12] z-20 animate-bounce">!</span>
        </button>

        <!-- Neural Chat Panel -->
        <div id="assistant-panel" class="hidden absolute bottom-20 right-0 w-[420px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-10rem)] glass-panel flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-500">
            <!-- Header HUD -->
            <div class="bg-white/5 border-b border-white/5 px-6 py-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <i data-lucide="sprout" class="w-5 h-5 text-emerald-400"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-white font-display tracking-tight" id="asst-title-text"></h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span class="text-[9px] text-slate-500 font-black uppercase tracking-widest" id="asst-subtitle-text"></span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button id="assistant-clear-btn" class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                    <button id="assistant-close-btn" class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Thread -->
            <div id="assistant-messages" class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scroll-smooth scrollbar-hide"></div>

            <!-- Suggestions Logic -->
            <div id="assistant-suggestions" class="px-6 pb-6 flex flex-wrap gap-2"></div>

            <!-- Neural Input Layer -->
            <div class="p-6 bg-slate-950/40 border-t border-white/5">
                <div class="glass-panel p-2 flex items-end gap-2 bg-slate-900/50 border-white/10 focus-within:border-emerald-500/50 transition-all duration-300">
                    <textarea id="assistant-input" rows="1" class="flex-1 bg-transparent border-none text-white text-sm py-3 px-4 resize-none outline-none max-h-32 placeholder:text-slate-600 font-medium leading-relaxed"></textarea>
                    
                    <div class="flex gap-2 pb-1.5 pr-2">
                        <button id="assistant-voice-btn" class="w-11 h-11 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                            <i data-lucide="mic" class="w-5 h-5"></i>
                        </button>
                        <button id="assistant-send-btn" class="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition-all">
                            <i data-lucide="send" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            #assistant-voice-btn.recording {
                background: rgba(239, 68, 68, 0.1) !important;
                border-color: rgba(239, 68, 68, 0.3) !important;
                animation: pulse-red 1.5s infinite;
            }
            #assistant-voice-btn.recording i { color: #f87171 !important; }
            
            @keyframes pulse-red {
                0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            
            #assistant-messages::-webkit-scrollbar { display: none; }
        </style>
    `;

    // Localized Selectors
    el.querySelector('#asst-title-text').innerText = t('assistant_title');
    el.querySelector('#asst-subtitle-text').innerText = t('assistant_subtitle');
    el.querySelector('#assistant-input').placeholder = t('assistant_placeholder');

    const panel = el.querySelector('#assistant-panel');
    const messages = el.querySelector('#assistant-messages');
    const input = el.querySelector('#assistant-input');
    const toggleBtn = el.querySelector('#assistant-toggle');
    const closeBtn = el.querySelector('#assistant-close-btn');

    toggleBtn.onclick = () => {
        _isOpen = !_isOpen;
        panel.classList.toggle('hidden');
        if (_isOpen) {
            if (_messages.length === 0) _showGreeting(messages, el.querySelector('#assistant-suggestions'));
            setTimeout(() => input.focus(), 200);
        }
    };

    closeBtn.onclick = () => { _isOpen = false; panel.classList.add('hidden'); };

    el.querySelector('#assistant-clear-btn').onclick = () => {
        _messages = [];
        messages.innerHTML = '';
        _showGreeting(messages, el.querySelector('#assistant-suggestions'));
    };

    el.querySelector('#assistant-send-btn').onclick = () => _handleSend(input, messages, el.querySelector('#assistant-suggestions'));

    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            _handleSend(input, messages, el.querySelector('#assistant-suggestions'));
        }
    };

    // Voice Engine Integration
    const voiceBtn = el.querySelector('#assistant-voice-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        let recognition = new SpeechRecognition();
        let recording = false;

        voiceBtn.onclick = () => {
            if (recording) { recognition.stop(); return; }
            recording = true;
            voiceBtn.classList.add('recording');
            recognition.lang = SPEECH_LANG_MAP[getLanguage()] || 'en-IN';
            recognition.start();
        };

        recognition.onresult = (e) => { input.value = e.results[0][0].transcript; };
        recognition.onend = () => { recording = false; voiceBtn.classList.remove('recording'); };
    } else { voiceBtn.style.display = 'none'; }

    return el;
}

function _showGreeting(messagesEl, suggestEl) {
    _appendMessage(messagesEl, 'assistant', t('assistant_greeting'));
    suggestEl.innerHTML = `
        ${[1, 2, 3, 4].map(i => `
            <button class="chip flex-1 py-2 px-4 rounded-xl glass-panel bg-white/5 border-white/5 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 hover:border-emerald-500/20 tracking-widest transition-all">
                ${t('assistant_s' + i)}
            </button>
        `).join('')}
    `;

    suggestEl.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
            input.value = btn.innerText;
            _handleSend(document.querySelector('#assistant-input'), messagesEl, suggestEl);
        };
    });
}

function _appendMessage(container, role, text) {
    const isUser = role === 'user';
    const isError = role === 'error';
    const msg = document.createElement('div');
    msg.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-${isUser ? 'right' : 'left'}-4 duration-300`;

    msg.innerHTML = `
        <div class="max-w-[85%] px-5 py-4 rounded-3xl text-sm font-medium leading-relaxed tracking-tight ${
            isUser 
                ? 'bg-emerald-500 text-white rounded-tr-none shadow-xl shadow-emerald-500/20' 
                : isError 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 rounded-tl-none'
                    : 'glass-panel bg-white/5 border-white/5 text-slate-200 rounded-tl-none'
        }">
            ${text}
        </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

async function _handleSend(input, messagesEl, suggestEl) {
    const text = input.value.trim();
    if (!text) return;
    
    suggestEl.innerHTML = '';
    input.value = '';
    _appendMessage(messagesEl, 'user', text);
    _messages.push({ role: 'user', content: text });

    const tid = 'sync-' + Date.now();
    _appendThinking(messagesEl, tid);

    try {
        const farm = store.getState('currentFarm');
        const systemPrompt = `[MODE: ELITE_ASSISTANT] Current Farm: ${farm?.name || 'Unknown'}. Language: ${getLanguage()}. Protocol: Direct, high-tech, helpful. Limit: 120 words.`;
        
        const data = await api('/zones/chat', {
            method: 'POST',
            body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ..._messages] }),
        });

        document.getElementById(tid)?.remove();
        const reply = data?.data?.reply || t('assistant_error');
        _appendMessage(messagesEl, 'assistant', reply);
        _messages.push({ role: 'assistant', content: reply });
    } catch (err) {
        document.getElementById(tid)?.remove();
        _appendMessage(messagesEl, 'error', t('assistant_error'));
    }
}

function _appendThinking(container, id) {
    const el = document.createElement('div');
    el.id = id;
    el.className = "flex justify-start animate-in fade-in duration-300";
    el.innerHTML = `
        <div class="glass-panel bg-white/5 border-white/5 px-6 py-4 rounded-3xl rounded-tl-none flex items-center gap-4">
            <div class="flex gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></div>
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></div>
            </div>
            <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inference active...</span>
        </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}
