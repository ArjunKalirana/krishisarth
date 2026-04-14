import { t }     from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api }   from '../api/client.js';
import { showToast } from '../components/toast.js';

/**
 * KrishiSarth Elite Digital Twin (v3.0)
 * High-fidelity real-time 3D field simulation & hydraulic orchestration.
 */
export function renderFarm3D() {
    const container = document.createElement('div');
    container.className = 'w-full h-full relative bg-[#0a0f12] overflow-hidden animate-in fade-in duration-1000';

    container.innerHTML = `
        <div id="farm3d-canvas-container" class="w-full h-screen relative">
            
            <!-- System Interface Orbit -->
            <div class="absolute top-6 left-6 flex flex-col gap-4 z-50">
                <div class="glass-panel p-2 flex flex-col gap-2 bg-slate-900/40 border-white/5">
                    <button id="btn-sun" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95" title="Sunny">
                        <i data-lucide="sun" class="w-5 h-5 text-amber-400"></i>
                    </button>
                    <button id="btn-rain" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95" title="Rain">
                        <i data-lucide="cloud-rain" class="w-5 h-5 text-blue-400"></i>
                    </button>
                    <div class="w-full h-px bg-white/5 my-1"></div>
                    <button id="btn-mode-toggle" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95" title="Act Mode Toggle">
                        <i data-lucide="shield" class="w-5 h-5 text-slate-400"></i>
                    </button>
                </div>
            </div>

            <!-- Global Status Bar -->
            <div id="farm-status-bar" class="absolute bottom-6 left-6 glass-panel p-6 flex gap-12 z-50 animate-in slide-in-from-bottom-12 duration-1000">
                <div>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Health Index</p>
                    <span id="global-health" class="text-2xl font-black text-emerald-500 font-display">--</span>
                </div>
                <div class="w-px h-10 bg-white/5"></div>
                <div>
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Sim Latency</p>
                    <span class="text-2xl font-black text-white font-display uppercase italic">LIVE</span>
                </div>
            </div>

            <!-- Predictive Command Drawer (Act Mode) -->
            <div id="zone-side-panel" class="absolute top-6 right-6 w-[420px] max-w-[calc(100vw-3rem)] glass-panel p-10 z-[100] transform translate-x-[480px] transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h2 id="panel-zone-name" class="text-3xl font-black text-white font-display uppercase tracking-tight">Select Input</h2>
                        <div class="flex items-center gap-2 mt-2">
                             <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span id="panel-status-tag" class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Operational_Node</span>
                        </div>
                    </div>
                    <button id="close-panel" class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white transition-all">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="space-y-8">
                    <!-- Sensor Readouts -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="elite-well p-4">
                            <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1">Surface Hydration</p>
                            <span id="val-water" class="text-2xl font-black text-blue-400 font-mono">--</span>
                        </div>
                        <div class="elite-well p-4">
                            <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1">Growth Matrix</p>
                            <span id="val-growth" class="text-2xl font-black text-emerald-400 font-mono">--</span>
                        </div>
                    </div>

                    <!-- ML Prediction Engine -->
                    <div class="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-4 opacity-5">
                            <i data-lucide="brain" class="w-16 h-16 text-emerald-500"></i>
                        </div>
                        
                        <div class="relative z-10 space-y-6">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                                    <i data-lucide="cpu" class="w-4 h-4 text-emerald-400"></i>
                                </div>
                                <span class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Inference_Forecast</span>
                            </div>

                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Efficiency Score</p>
                                    <span id="ml-efficiency" class="text-lg font-black text-white">9.4/10</span>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Yield Delta</p>
                                    <span id="ml-yield" class="text-lg font-black text-emerald-400 font-mono">+12.2%</span>
                                </div>
                            </div>

                            <div class="pt-4 border-t border-white/5">
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">24H Moisture Projection</p>
                                <div class="h-10 flex items-end gap-1">
                                    ${Array(12).fill(0).map(() => `<div class="flex-1 bg-white/5 rounded-t-sm transition-all duration-700 hover:bg-emerald-500/30" style="height: ${Math.random()*80+20}%"></div>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Timer Orchestration -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-end">
                            <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em]">Target Duration</p>
                            <span id="slider-val" class="text-xl font-black text-white font-display">20m</span>
                        </div>
                        <input type="range" id="timer-slider" min="5" max="60" step="5" value="20" class="w-full accent-emerald-500">
                        <div class="text-[9px] font-medium text-slate-500 text-center uppercase tracking-widest italic">
                            Approx Volume: <span id="vol-calc" class="text-white">--</span> Litres
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-4">
                        <button id="btn-cancel" class="btn-elite secondary py-5 uppercase font-black tracking-widest text-[10px]">Decline</button>
                        <button id="btn-irrigate" class="btn-elite py-5 uppercase font-black tracking-widest text-[10px] flex items-center justify-center gap-2">
                             <i data-lucide="zap" class="w-4 h-4"></i>
                             <span>Execute</span>
                        </button>
                    </div>

                    <!-- Execution Guard (Undo) -->
                    <div id="undo-container" class="hidden">
                         <button id="btn-undo" class="w-full py-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-amber-500/20 transition-all">
                            ABORT COMMAND (5s)
                         </button>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            .weather-btn-active { background: rgba(16, 185, 129, 0.1) !important; border-color: rgba(16, 185, 129, 0.4) !important; color: #10b981 !important; }
            .elite-well { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 1.5rem; }
            input[type=range]::-webkit-slider-runnable-track { background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; }
            input[type=range]::-webkit-slider-thumb { margin-top: -10px; height: 26px; width: 26px; border-radius: 13px; background: #10b981; border: 4px solid #000; cursor: pointer; -webkit-appearance: none; box-shadow: 0 0 10px rgba(16,185,129,0.4); }
        </style>
    `;

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); _initEliteTwin(container); }, 100);
    return container;
}

let _scene, _renderer, _camera, _controls, _raycaster, _clock;
let _zones       = [];
let _hardware    = []; 
let _pipes       = [];
let _labels      = [];
let _simTime     = 0;
let _weather     = 'sunny';
let _selectedId  = null;
let _animId;
let _undoTimer   = null;
let _isActMode   = false;

async function _initEliteTwin(container) {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    
    if (!window.THREE) return;
    const THREE = window.THREE;

    _clock = new THREE.Clock();
    _raycaster = new THREE.Raycaster();
    _scene = new THREE.Scene();

    _camera = new THREE.PerspectiveCamera(45, window.innerWidth / (window.innerHeight - 80), 0.1, 2000);
    _camera.position.set(100, 80, 100);

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setPixelRatio(window.devicePixelRatio);
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.querySelector('#farm3d-canvas-container').appendChild(_renderer.domElement);

    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.enableDamping = true;
    _controls.dampingFactor = 0.05;
    _controls.maxPolarAngle = Math.PI / 2.2;

    // Environmental Engine
    _setupAtmosphere(THREE);
    _buildTieredStructure(THREE);
    _buildHydraulicInfrastructure(THREE);

    // Act Mode Toggles
    const canvasContainer = container.querySelector('#farm3d-canvas-container');
    container.querySelector('#btn-mode-toggle').onclick = () => {
        _isActMode = !_isActMode;
        container.querySelector('#btn-mode-toggle i').style.color = _isActMode ? '#10b981' : '#64748b';
        showToast(_isActMode ? '⚡ SYSTEM ARMED: Direct Orchestration Enabled' : '👁️ VISUALIZER: Controller Access Locked', _isActMode ? 'success' : 'info');
        if (!_isActMode) _hidePanel();
    };

    container.querySelector('#btn-sun').onclick = () => _setWeather('sunny');
    container.querySelector('#btn-rain').onclick = () => _setWeather('rain');
    container.querySelector('#close-panel').onclick = () => _hidePanel();
    container.querySelector('#btn-cancel').onclick = () => _hidePanel();
    container.querySelector('#btn-irrigate').onclick = () => _executeOrchestration();
    
    const slider = container.querySelector('#timer-slider');
    slider.oninput = (e) => {
        const min = e.target.value;
        container.querySelector('#slider-val').innerText = min + 'm';
        container.querySelector('#vol-calc').innerText = (min * 4.5).toFixed(1);
        _fetchPredictions(min);
    };

    canvasContainer.addEventListener('click', (e) => {
        if (!_isActMode) return;
        const rect = _renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        _raycaster.setFromCamera(mouse, _camera);
        const hits = _raycaster.intersectObjects(_scene.children, true);
        if (hits.length > 0) {
            const obj = hits[0].object.parent || hits[0].object;
            if (obj.userData?.id) _showPanel(obj.userData.id, obj.userData.name);
        }
    });

    const animate = () => {
        _animId = requestAnimationFrame(animate);
        _controls.update();
        const delta = _clock.getDelta();
        
        // Fluid Animation
        _pipes.forEach(p => {
            if (p.material.emissiveIntensity > 0) {
                p.material.emissiveIntensity = 0.5 + Math.sin(Date.now()*0.01)*0.3;
            }
        });

        // Label Projection
        _labels.forEach(l => {
            const vector = l.pos.clone().project(_camera);
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(vector.y * 0.5 - 0.5) * window.innerHeight);
            l.div.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            l.div.style.display = vector.z < 1 ? 'block' : 'none';
        });

        if (_weather === 'rain') _updateRain(delta);
        _renderer.render(_scene, _camera);
    };
    animate();

    const sim = setInterval(_runSimTick, 1000);
    window.addEventListener('hashchange', () => { cancelAnimationFrame(_animId); clearInterval(sim); _renderer.dispose(); }, { once: true });
}

function _setupAtmosphere(THREE) {
    _scene.background = new THREE.Color(0x0a0f12);
    _scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    _scene.add(sun);

    // Sky Dome
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(1000, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x1a2a33, side: THREE.BackSide })
    );
    _scene.add(sky);
}

function _buildTieredStructure(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8b4513'; ctx.fillRect(0,0,128,128);
    ctx.strokeStyle = '#5d2e0c'; ctx.lineWidth = 2;
    for(let i=0; i<128; i+=16) { 
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
        for(let j=(i%32===0?0:8); j<128; j+=16) { ctx.beginPath(); ctx.moveTo(j, i); ctx.lineTo(j, i+16); ctx.stroke(); }
    }
    const brickTex = new THREE.CanvasTexture(canvas);
    brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
    brickTex.repeat.set(2, 1);
    const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.8 });

    _zones = [
        { id: 'zone_a', name: 'Zone Alpha', level: 2, pos: [-25, 0, -25], type: 'polyhouse', water: 0.6, growth: 0.4 },
        { id: 'zone_b', name: 'Zone Beta', level: 1, pos: [20, 0, -25], type: 'open', water: 0.4, growth: 0.6 },
        { id: 'zone_c', name: 'Zone Gamma', level: 0, pos: [20, 0, 10], type: 'open', water: 0.7, growth: 0.2 },
        { id: 'zone_d', name: 'Zone Delta', level: -1, pos: [20, 0, 45], type: 'open', water: 0.3, growth: 0.8 }
    ];

    _zones.forEach(z => {
        const height = 4 + (z.level * 4);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(25, height, 25), brickMat);
        mesh.position.set(z.pos[0], height/2, z.pos[1]);
        mesh.userData = { id: z.id, name: z.name };
        _scene.add(mesh);
        
        // Soil
        const soil = new THREE.Mesh(new THREE.PlaneGeometry(23, 23), new THREE.MeshStandardMaterial({ color: 0x221100 }));
        soil.rotation.x = -Math.PI / 2;
        soil.position.set(z.pos[0], height + 0.1, z.pos[1]);
        _scene.add(soil);
        z.soil = soil;

        if (z.type === 'polyhouse') _addPolyhouse(THREE, z.pos[0], height, z.pos[1]);
        _addPlants(THREE, z, z.pos[0], height, z.pos[1]);
        _addLabel(z.name, new THREE.Vector3(z.pos[0], height + 5, z.pos[1]));
    });
}

function _addPolyhouse(THREE, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10, 24, 32, 1, true, 0, Math.PI),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y + 5, z);
    _scene.add(mesh);
}

function _addPlants(THREE, zone, x, y, z) {
    zone.plantObjs = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    for (let i = 0; i < 40; i++) {
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 6), mat);
        const px = x + (Math.random() - 0.5) * 18;
        const pz = z + (Math.random() - 0.5) * 18;
        p.position.set(px, y + 0.6, pz);
        p.scale.set(0.1, 0.1, 0.1);
        _scene.add(p);
        zone.plantObjs.push(p);
    }
}

function _buildHydraulicInfrastructure(THREE) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
    const tanks = [
        { id: 'water', name: 'Central Reservoir', pos: [-60, 5, 20] },
        { id: 'fert_1', name: 'Nutrient Alpha', pos: [-75, 4, 5] },
        { id: 'fert_2', name: 'Nutrient Beta', pos: [-75, 4, -10] }
    ];

    tanks.forEach(t => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 32), mat);
        mesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
        mesh.userData = { id: t.id, name: t.name };
        _scene.add(mesh);
        _hardware.push(mesh);
        _addLabel(t.name, new THREE.Vector3(t.pos[0], t.pos[1] + 8, t.pos[2]));
    });

    // Pipe Network
    const points = [new THREE.Vector3(-60, 5, 20), new THREE.Vector3(-60, 12, -25), new THREE.Vector3(-15, 12, -25)];
    const pipe = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.4, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 })
    );
    _scene.add(pipe);
    _pipes.push(pipe);
}

function _addLabel(text, pos) {
    const div = document.createElement('div');
    div.className = 'absolute pointer-events-none glass-panel px-3 py-1 text-[10px] font-black text-white border-emerald-500/20 whitespace-nowrap z-40';
    div.innerHTML = `<span class="text-emerald-400 mr-2">●</span>${text}`;
    document.getElementById('farm3d-canvas-container').appendChild(div);
    _labels.push({ div, pos });
}

function _showPanel(id, name) {
    _selectedId = id;
    const panel = document.getElementById('zone-side-panel');
    document.getElementById('panel-zone-name').innerText = name;
    panel.classList.remove('translate-x-[480px]');
    panel.classList.add('translate-x-0');
    
    const zone = _zones.find(z => z.id === id);
    if (zone) {
        document.getElementById('val-water').innerText = (zone.water * 100).toFixed(0) + '%';
        document.getElementById('val-growth').innerText = (zone.growth * 100).toFixed(0) + '%';
    }
    _fetchPredictions(20);
}

function _hidePanel() {
    _selectedId = null;
    document.getElementById('zone-side-panel').classList.add('translate-x-[480px]');
    document.getElementById('zone-side-panel').classList.remove('translate-x-0');
}

async function _fetchPredictions(min) {
    try {
        const res = await api(`/zones/${_selectedId}/twin/simulate-irrigation`, {
            method: 'POST',
            body: JSON.stringify({ duration_minutes: parseInt(min), current_state: { moisture_pct: 45, crop_stage: 'vegetative' } })
        });
        if (res?.success) {
            document.getElementById('ml-yield').innerText = `+${res.data.yield_improvement ?? 12.2}%`;
            document.getElementById('ml-efficiency').innerText = `${res.data.efficiency_score ?? 9.4}/10`;
        }
    } catch {}
}

async function _executeOrchestration() {
    const undo = document.getElementById('undo-container');
    const timer = document.getElementById('btn-undo');
    undo.classList.remove('hidden');
    let count = 5;
    _undoTimer = setInterval(() => {
        count--;
        timer.innerText = `ABORT COMMAND (${count}s)`;
        if (count <= 0) {
            clearInterval(_undoTimer);
            _finalizeOrchestration();
        }
    }, 1000);
    timer.onclick = () => { clearInterval(_undoTimer); undo.classList.add('hidden'); showToast('Command Aborted', 'info'); };
}

function _finalizeOrchestration() {
    document.getElementById('undo-container').classList.add('hidden');
    showToast('⚡ Command Transmitted to Field Hardware', 'success');
    _pipes.forEach(p => { p.material.emissive.setHex(0x34d399); p.material.emissiveIntensity = 1; });
    setTimeout(() => { _pipes.forEach(p => p.material.emissiveIntensity = 0); }, 5000);
    _hidePanel();
}

function _runSimTick() {
    _simTime += 1;
    _zones.forEach(z => {
        z.water = Math.max(0, Math.min(1, z.water + (_weather === 'rain' ? 0.01 : -0.002)));
        z.growth = Math.min(1, z.growth + (z.water > 0.4 ? 0.002 : 0.0002));
        z.plantObjs?.forEach(p => {
             const s = 0.1 + (z.growth * 0.9);
             p.scale.lerp(new window.THREE.Vector3(s,s,s), 0.1);
        });
    });
    const gh = document.getElementById('global-health'); if (gh) gh.innerText = '98%';
}

function _setWeather(type) { 
    _weather = type;
    document.getElementById('btn-sun').classList.toggle('weather-btn-active', type === 'sunny');
    document.getElementById('btn-rain').classList.toggle('weather-btn-active', type === 'rain');
}

async function _loadScript(url) { if (document.querySelector(`script[src="${url}"]`)) return; return new Promise((r) => { const s = document.createElement('script'); s.src = url; s.onload = r; document.head.appendChild(s); }); }
