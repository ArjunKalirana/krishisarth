import { t, getLanguage } from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api } from '../api/client.js';

// Maps app language codes to BCP-47 language tags for Web Speech API
const SPEECH_LANG_MAP = {
    en: 'en-IN',   // English (India) — understands Indian accent better
    hi: 'hi-IN',   // Hindi (India)
    mr: 'mr-IN',   // Marathi (India)
};

/**
 * KrishiSarth AI Assistant
 * Floating chat widget powered by Claude API.
 * Appears on all pages as a floating button bottom-right.
 */

let _isOpen      = false;
let _messages    = [];   // { role: 'user'|'assistant', content: string }
let _widgetEl    = null;

export function initAIAssistant() {
    if (_widgetEl) return;   // already mounted
    _widgetEl = _buildWidget();
    document.body.appendChild(_widgetEl);
    if (window.lucide) window.lucide.createIcons();
}

// ── Build the full widget DOM ─────────────────────────────────────────────────
function _buildWidget() {
    const el = document.createElement('div');
    el.id = 'ks-assistant';
    el.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9998;
        font-family: var(--font-main, 'DM Sans', sans-serif);
    `;

    el.innerHTML = `
        <!-- Floating toggle button -->
        <button id="assistant-toggle" style="
            width: 56px; height: 56px; border-radius: 50%;
            background: linear-gradient(135deg, #1a7a4a, #2ECC71);
            border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(26,122,74,0.4);
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s; color: white;
            position: relative;
        ">
            <i data-lucide="bot" style="width:24px;height:24px;"></i>
            <span id="assistant-badge" style="
                position:absolute; top:-4px; right:-4px;
                background:#ef4444; color:white; border-radius:50%;
                width:18px; height:18px; font-size:10px; font-weight:800;
                display:none; align-items:center; justify-content:center;
                border: 2px solid white;
            ">!</span>
        </button>

        <!-- Chat panel -->
        <div id="assistant-panel" style="
            display: none;
            position: absolute;
            bottom: 68px;
            right: 0;
            width: 360px;
            max-height: 540px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(26,122,74,0.1);
            border: 1px solid rgba(26,122,74,0.1);
            flex-direction: column;
            overflow: hidden;
        ">
            <!-- Header -->
            <div style="
                background: linear-gradient(135deg, #1a7a4a, #0f5232);
                padding: 16px 18px;
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="
                        width:36px; height:36px; border-radius:50%;
                        background:rgba(255,255,255,0.2);
                        display:flex; align-items:center; justify-content:center;
                    ">
                        <i data-lucide="sprout" style="width:18px;height:18px;color:white;"></i>
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:14px;" id="asst-title-text"></div>
                        <div style="font-size:10px; opacity:0.7; font-weight:600;" id="asst-subtitle-text"></div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="assistant-clear-btn" title="Clear chat" style="
                        background:rgba(255,255,255,0.15); border:none; cursor:pointer;
                        width:28px; height:28px; border-radius:8px; color:white;
                        display:flex; align-items:center; justify-content:center;
                    ">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                    </button>
                    <button id="assistant-close-btn" style="
                        background:rgba(255,255,255,0.15); border:none; cursor:pointer;
                        width:28px; height:28px; border-radius:8px; color:white;
                        display:flex; align-items:center; justify-content:center;
                    ">
                        <i data-lucide="x" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </div>

            <!-- Messages -->
            <div id="assistant-messages" style="
                flex:1; overflow-y:auto; padding:16px;
                display:flex; flex-direction:column; gap:12px;
                max-height: 340px; min-height: 200px;
                scroll-behavior: smooth;
            "></div>

            <!-- Suggestions (shown when empty) -->
            <div id="assistant-suggestions" style="
                padding: 0 16px 12px;
                display: flex; flex-wrap: wrap; gap: 6px;
            "></div>

            <!-- Input -->
            <div style="
                padding: 12px 16px;
                border-top: 1px solid rgba(26,122,74,0.08);
                display: flex; gap: 8px; align-items: flex-end;
                background: #f9fafb;
            ">
                <textarea
                    id="assistant-input"
                    rows="1"
                    style="
                        flex:1; border:1px solid rgba(26,122,74,0.2); border-radius:12px;
                        padding:10px 14px; font-size:13px; font-family:inherit;
                        resize:none; outline:none; background:white;
                        max-height:80px; overflow-y:auto; line-height:1.4;
                        transition: border-color 0.2s;
                    "
                ></textarea>

                <!-- Voice button -->
                <button id="assistant-voice-btn" title="Voice input" style="
                    width:40px; height:40px; border-radius:12px;
                    background:#f0fdf4; border:1px solid #bbf7d0;
                    cursor:pointer; flex-shrink:0;
                    display:flex; align-items:center; justify-content:center;
                    transition: all 0.2s;
                ">
                    <i data-lucide="mic" style="width:16px;height:16px;color:#1a7a4a;"></i>
                </button>

                <!-- Send button -->
                <button id="assistant-send-btn" style="
                    width:40px; height:40px; border-radius:12px;
                    background:#1a7a4a; border:none; cursor:pointer;
                    display:flex; align-items:center; justify-content:center;
                    flex-shrink:0; transition: background 0.2s, transform 0.1s;
                ">
                    <i data-lucide="send" style="width:16px;height:16px;color:white;"></i>
                </button>
            </div>
        </div>

        <style>
            #assistant-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(26,122,74,0.5); }
            #assistant-toggle:active { transform: scale(0.95); }
            #assistant-send-btn:hover { background: #0f5232 !important; }
            #assistant-send-btn:active { transform: scale(0.95); }
            #assistant-input:focus { border-color: #1a7a4a !important; box-shadow: 0 0 0 3px rgba(26,122,74,0.1); }
            #assistant-messages::-webkit-scrollbar { width: 4px; }
            #assistant-messages::-webkit-scrollbar-thumb { background: #d1fae5; border-radius: 2px; }

            #assistant-voice-btn:hover { background:#dcfce7 !important; border-color:#86efac !important; }
            #assistant-voice-btn.recording {
                background:#fef2f2 !important;
                border-color:#fca5a5 !important;
                animation: pulse-record 1s ease infinite;
            }
            #assistant-voice-btn.recording i { color:#ef4444 !important; }
            @keyframes pulse-record {
                0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
            }
        </style>
    `;

    el.querySelector('#asst-title-text').setAttribute('data-i18n', 'assistant_title');
    el.querySelector('#asst-subtitle-text').setAttribute('data-i18n', 'assistant_subtitle');
    el.querySelector('#assistant-input').setAttribute('data-i18n', 'assistant_placeholder');
    el.querySelector('#assistant-input').setAttribute('data-i18n-attr', 'placeholder');

    const panel    = el.querySelector('#assistant-panel');
    const messages = el.querySelector('#assistant-messages');
    const input    = el.querySelector('#assistant-input');
    const sendBtn  = el.querySelector('#assistant-send-btn');
    const voiceBtn = el.querySelector('#assistant-voice-btn');
    const toggleBtn = el.querySelector('#assistant-toggle');
    const closeBtn = el.querySelector('#assistant-close-btn');
    const clearBtn = el.querySelector('#assistant-clear-btn');
    const suggestEl = el.querySelector('#assistant-suggestions');

    // Toggle open/close
    toggleBtn.addEventListener('click', () => {
        _isOpen = !_isOpen;
        panel.style.display = _isOpen ? 'flex' : 'none';
        panel.style.flexDirection = 'column';
        if (_isOpen) {
            if (_messages.length === 0) _showGreeting(messages, suggestEl);
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => input.focus(), 100);
        }
    });

    closeBtn.addEventListener('click', () => {
        _isOpen = false;
        panel.style.display = 'none';
    });

    clearBtn.addEventListener('click', () => {
        _messages = [];
        messages.innerHTML = '';
        _showGreeting(messages, suggestEl);
    });

    // Send on button click
    sendBtn.addEventListener('click', () => _handleSend(input, messages, suggestEl));

    // Send on Enter (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            _handleSend(input, messages, suggestEl);
        }
    });

    // ── Voice input ───────────────────────────────────────────────────────────
    let _recognition = null;
    let _isRecording = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        // Browser does not support Web Speech API — hide the button
        voiceBtn.style.display = 'none';
    } else {
        voiceBtn.addEventListener('click', () => {
            if (_isRecording) {
                // Stop recording
                _recognition?.stop();
            } else {
                // Start recording
                _startVoiceRecognition(voiceBtn, input, messages);
            }
        });
    }

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    function _startVoiceRecognition(btn, inputEl, messagesEl) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        _recognition = new SpeechRecognition();

        // Set language based on current app language
        const lang = getLanguage();
        _recognition.lang = SPEECH_LANG_MAP[lang] || 'en-IN';

        _recognition.continuous     = false;  // stop after first pause
        _recognition.interimResults = true;   // show partial results while speaking
        _recognition.maxAlternatives = 1;

        _isRecording = true;
        btn.classList.add('recording');

        // Change mic icon to stop icon while recording
        const iconEl = btn.querySelector('i');
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'mic-off');
            if (window.lucide) window.lucide.createIcons();
        }

        // Show recording status in input placeholder
        const originalPlaceholder = inputEl.placeholder;
        inputEl.placeholder = lang === 'hi' ? 'सुन रहा हूं...' :
                              lang === 'mr' ? 'ऐकत आहे...' :
                              'Listening...';
        inputEl.style.borderColor = '#fca5a5';

        _recognition.onresult = (event) => {
            let interimText  = '';
            let finalText    = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }

            // Show interim results in the input field as user speaks
            if (interimText) {
                inputEl.value = interimText;
            }
            if (finalText) {
                inputEl.value = finalText;
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
            }
        };

        _recognition.onerror = (event) => {
            _stopRecording(btn, inputEl, originalPlaceholder, iconEl);

            if (event.error === 'not-allowed') {
                // Microphone permission denied
                _appendMessage(
                    messagesEl,
                    'error',
                    lang === 'hi' ? 'माइक्रोफ़ोन की अनुमति दें और फिर कोशिश करें।' :
                    lang === 'mr' ? 'मायक्रोफोन परवानगी द्या आणि पुन्हा प्रयत्न करा.' :
                    'Microphone permission denied. Please allow microphone access and try again.'
                );
            } else if (event.error === 'no-speech') {
                inputEl.value = '';
            } else if (event.error !== 'aborted') {
                _appendMessage(
                    messagesEl,
                    'error',
                    lang === 'hi' ? 'आवाज़ नहीं पहचान पाए। फिर कोशिश करें।' :
                    lang === 'mr' ? 'आवाज ओळखता आली नाही. पुन्हा प्रयत्न करा.' :
                    'Could not recognize speech. Please try again.'
                );
            }
        };

        _recognition.onend = () => {
            _stopRecording(btn, inputEl, originalPlaceholder, iconEl);

            // If there is text in the input after recording, focus it
            // so the farmer can review before sending
            if (inputEl.value.trim()) {
                inputEl.focus();
                inputEl.setSelectionRange(
                    inputEl.value.length,
                    inputEl.value.length
                );
            }
        };

        _recognition.start();
    }

    function _stopRecording(btn, inputEl, originalPlaceholder, iconEl) {
        _isRecording = false;
        btn.classList.remove('recording');
        inputEl.placeholder    = originalPlaceholder;
        inputEl.style.borderColor = '';

        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'mic');
            if (window.lucide) window.lucide.createIcons();
        }

        try { _recognition?.stop(); } catch { /* already stopped */ }
        _recognition = null;
    }

    return el;
}

// ── Show greeting and suggestions ─────────────────────────────────────────────
function _showGreeting(messagesEl, suggestEl) {
    _appendMessage(messagesEl, 'assistant', t('assistant_greeting'));

    suggestEl.innerHTML = `
        <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                   letter-spacing:0.05em;width:100%;margin-bottom:2px;" data-i18n="assistant_suggestions_label">
            ${t('assistant_suggestions_label')}
        </p>
        ${[
            {k:'assistant_s1', v:t('assistant_s1')},
            {k:'assistant_s2', v:t('assistant_s2')},
            {k:'assistant_s3', v:t('assistant_s3')},
            {k:'assistant_s4', v:t('assistant_s4')},
        ].map(q => `
            <button class="suggestion-chip" style="
                font-size:11px; font-weight:600; color:#1a7a4a;
                background:#f0fdf4; border:1px solid #bbf7d0; border-radius:99px;
                padding:4px 12px; cursor:pointer; transition:all 0.15s; white-space:nowrap;
            "><span data-i18n="${q.k}">${q.v}</span></button>
        `).join('')}
    `;

    suggestEl.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const input = document.querySelector('#assistant-input');
            if (input) {
                input.value = chip.textContent;
                _handleSend(input, messagesEl, suggestEl);
            }
        });
    });
}

// ── Handle send ───────────────────────────────────────────────────────────────
async function _handleSend(input, messagesEl, suggestEl) {
    const text = input.value.trim();
    if (!text) return;

    // Hide suggestions after first message
    if (suggestEl) suggestEl.innerHTML = '';

    input.value = '';
    input.style.height = 'auto';

    // Add user message to UI
    _appendMessage(messagesEl, 'user', text);
    _messages.push({ role: 'user', content: text });

    // Show thinking indicator
    const thinkingId = 'thinking-' + Date.now();
    _appendThinking(messagesEl, thinkingId);

    try {
        const reply = await _callGroq(_messages);
        document.getElementById(thinkingId)?.remove();
        _appendMessage(messagesEl, 'assistant', reply);
        _messages.push({ role: 'assistant', content: reply });
    } catch (err) {
        document.getElementById(thinkingId)?.remove();
        _appendMessage(messagesEl, 'error', t('assistant_error'));
        console.error('[AI Assistant]', err);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Call Groq API ─────────────────────────────────────────────────────────────
async function _callGroq(conversationHistory) {
    // Build context with farm data
    const farm   = store.getState('currentFarm');
    const farmer = store.getState('currentFarmer');
    const lang   = getLanguage();

    const langInstruction = lang === 'hi'
        ? 'Always respond in Hindi.'
        : lang === 'mr'
        ? 'Always respond in Marathi.'
        : 'Respond in English.';

    let farmContext = '';
    if (farm) {
        farmContext = `\nCurrent farm: "${farm.name}". `;
    }
    if (farmer) {
        farmContext += `Farmer name: ${farmer.name}. `;
    }

    const systemPrompt = `${t('assistant_context')}${farmContext}${langInstruction} Keep responses concise and practical — under 150 words unless asked for detail. Format with line breaks for readability. Use simple language suitable for farmers.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ];

    const data = await api('/zones/chat', {
        method: 'POST',
        body: JSON.stringify({
            messages: messages
        }),
    });

    return data?.data?.reply || t('assistant_error');
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function _appendMessage(container, role, text) {
    const isUser      = role === 'user';
    const isError     = role === 'error';
    const bubble      = document.createElement('div');
    bubble.style.cssText = `
        display: flex;
        justify-content: ${isUser ? 'flex-end' : 'flex-start'};
        animation: fadeInUp 0.2s ease;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
        max-width: 82%;
        padding: 10px 14px;
        border-radius: ${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
        font-size: 13px;
        line-height: 1.6;
        font-weight: 500;
        white-space: pre-wrap;
        word-break: break-word;
        ${isUser  ? 'background:#1a7a4a; color:white;' : ''}
        ${isError ? 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;' : ''}
        ${!isUser && !isError ? 'background:#f0fdf4; color:#1a2e1e; border:1px solid #bbf7d0;' : ''}
    `;
    inner.textContent = text;
    bubble.appendChild(inner);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;

    // Inject animation style once
    if (!document.getElementById('asst-anim-style')) {
        const style = document.createElement('style');
        style.id = 'asst-anim-style';
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity:0; transform:translateY(8px); }
                to   { opacity:1; transform:translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

function _appendThinking(container, id) {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'display:flex; justify-content:flex-start;';
    el.innerHTML = `
        <div style="
            background:#f0fdf4; border:1px solid #bbf7d0;
            border-radius:18px 18px 18px 4px;
            padding:10px 16px; display:flex; align-items:center; gap:6px;
        ">
            <div style="display:flex;gap:4px;align-items:center;">
                ${[0, 150, 300].map(d => `
                    <div style="
                        width:7px;height:7px;border-radius:50%;background:#1a7a4a;
                        animation:bounce 0.8s ${d}ms infinite alternate;
                    "></div>
                `).join('')}
            </div>
            <span style="font-size:12px;color:#6b7280;font-weight:600;" data-i18n="assistant_thinking">${t('assistant_thinking')}</span>
        </div>
        <style>
            @keyframes bounce {
                from { transform:translateY(0); opacity:0.4; }
                to   { transform:translateY(-5px); opacity:1; }
            }
        </style>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}
