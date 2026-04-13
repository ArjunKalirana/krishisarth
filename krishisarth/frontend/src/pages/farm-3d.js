import { t }     from '../utils/i18n.js';
import { store } from '../state/store.js';
import { api }   from '../api/client.js';
import { showToast } from '../components/toast.js';

/**
 * Elite Digital Twin Interface (v2.0)
 * A high-fidelity, simulation-driven 3D agricultural core.
 */
export function renderFarm3D() {
    const container = document.createElement('div');
    container.className = 'w-full h-full relative bg-[#0a0f12] overflow-hidden animate-in fade-in duration-1000';

    // Premium UI Overlays (Elite HUD)
    container.innerHTML = `
        <div id="farm3d-canvas-container" class="w-full h-[calc(100vh-80px)] relative">
            
            <!-- Weather Command Orbit -->
            <div class="absolute top-6 left-6 flex flex-col gap-4 z-50">
                <div class="glass-panel p-2 flex flex-col gap-2 bg-slate-900/40 border-white/5">
                    <button id="btn-sun" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95" title="Sunny">
                        <i data-lucide="sun" class="w-5 h-5 text-amber-400"></i>
                    </button>
                    <button id="btn-rain" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95" title="Rain">
                        <i data-lucide="cloud-rain" class="w-5 h-5 text-blue-400"></i>
                    </button>
                </div>
                <div id="instruction-tag" class="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] pl-1">
                    Direct_Simulation_Link
                </div>
            </div>

            <!-- Global Telemetry HUD (Bottom) -->
            <div id="farm-status-bar" class="absolute bottom-6 left-6 right-6 lg:right-auto glass-panel p-6 flex flex-wrap gap-8 z-50 animate-in slide-in-from-bottom-6 duration-1000 delay-300">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <i data-lucide="activity" class="w-5 h-5 text-emerald-400"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Health</p>
                        <span id="global-health" class="text-xl font-black text-emerald-500 font-display">98%</span>
                    </div>
                </div>
                <div class="flex items-center gap-4 border-l border-white/5 pl-8">
                    <div>
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inference State</p>
                        <span id="sim-status" class="text-xl font-black text-white font-display uppercase italic">ACTIVE</span>
                    </div>
                </div>
                <div class="flex items-center gap-4 border-l border-white/5 pl-8">
                    <div>
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Runtime Index</p>
                        <span id="sim-time" class="text-xl font-black text-white font-mono">00:00:00</span>
                    </div>
                </div>
            </div>

            <!-- Detail Analysis Panel (Right) -->
            <div id="zone-side-panel" class="absolute top-6 right-6 w-[360px] max-w-[calc(100vw-3rem)] glass-panel p-8 z-[100] transform translate-x-[420px] transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h2 id="panel-zone-name" class="text-2xl font-black text-white font-display uppercase tracking-tight">Zone Alpha</h2>
                        <div class="badge-elite badge-success mt-2" id="panel-crop-type">WHEAT_NODE</div>
                    </div>
                    <button id="close-panel" class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white transition-all">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="space-y-8">
                    <div class="space-y-3">
                        <div class="flex justify-between items-end">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vegetative Growth</span>
                            <span id="val-growth" class="text-xs font-black text-emerald-400 font-mono">0%</span>
                        </div>
                        <div class="h-2 bg-slate-900 rounded-full border border-white/5">
                            <div id="bar-growth" class="h-full bg-emerald-500 rounded-full transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div class="flex justify-between items-end">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hydration Level</span>
                            <span id="val-water" class="text-xs font-black text-blue-400 font-mono">0%</span>
                        </div>
                        <div class="h-2 bg-slate-900 rounded-full border border-white/5">
                            <div id="bar-water" class="h-full bg-blue-400 rounded-full transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div class="flex justify-between items-end">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anomaly Risk</span>
                            <span id="val-health" class="text-xs font-black text-amber-400 font-mono">0%</span>
                        </div>
                        <div class="h-2 bg-slate-900 rounded-full border border-white/5">
                            <div id="bar-health" class="h-full bg-amber-500 rounded-full transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-6">
                        <button id="btn-irrigate" class="btn-elite flex items-center justify-center gap-2 py-4">
                            <i data-lucide="droplets" class="w-4 h-4"></i>
                            <span>IRRIGATE</span>
                        </button>
                        <button id="btn-change-crop" class="btn-elite secondary flex items-center justify-center gap-2 py-4">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                            <span>SWAP GEN</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Hover Label Placeholder -->
            <div id="hover-tag" class="hidden absolute pointer-events-none glass-panel px-3 py-1.5 text-[10px] font-black border-emerald-500/30 text-emerald-400 uppercase tracking-widest z-50"></div>
        </div>
        
        <style>
            .weather-btn-active { 
                background: rgba(16, 185, 129, 0.1) !important; 
                border-color: rgba(16, 185, 129, 0.3) !important;
                color: #10b981 !important;
            }
        </style>
    `;

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); _initEliteTwin(container); }, 100);
    return container;
}

let _scene, _renderer, _camera, _controls, _raycaster, _clock;
let _zones = [];
let _simTime = 0;
let _weather = 'sunny';
let _selectedZoneId = null;
let _animId;

async function _initEliteTwin(container) {
    // Prevent duplicate script loading and ensure order
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

    if (!window.THREE) {
        console.error('[Farm3D] THREE Engine failed to load');
        showToast('Engine initialization failure', 'error');
        return;
    }

    const THREE = window.THREE;
    _clock = new THREE.Clock();
    _raycaster = new THREE.Raycaster();

    // Lighting HQ
    _scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    _scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0f12, 0.4));
    const sun = new THREE.DirectionalLight(0xfff1e0, 1.4);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    _scene.add(sun);

    // Environment
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ color: 0x0d141a, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    _scene.add(ground);

    _zones = [
        { id: 'A', name: 'Zone Alpha', type: 'greenhouse', crop: 'LYCOPENE_GEN', growth: 0.45, water: 0.6, health: 0.95, mesh: null, plants: [] },
        { id: 'B', name: 'Zone Beta', type: 'bed', crop: 'STARCH_V3', growth: 0.72, water: 0.4, health: 0.88, mesh: null, plants: [] },
        { id: 'C', name: 'Zone Gamma', type: 'bed', crop: 'FOLIAGE_NX', growth: 0.2, water: 0.8, health: 0.99, mesh: null, plants: [] },
        { id: 'D', name: 'Zone Delta', type: 'bed', crop: 'NUTRI_PODS', growth: 0.88, water: 0.3, health: 0.65, mesh: null, plants: [] },
    ];

    _buildModularFarm();

    // UI Orchestration
    container.querySelector('#btn-sun').onclick = () => _setWeather('sunny');
    container.querySelector('#btn-rain').onclick = () => _setWeather('rain');
    container.querySelector('#close-panel').onclick = () => _hidePanel();
    container.querySelector('#btn-irrigate').onclick = () => _irrigateSelected();
    container.querySelector('#btn-change-crop').onclick = () => _changeCropSelected();
    
    _setWeather('sunny');

    const animate = () => {
        _animId = requestAnimationFrame(animate);
        _controls.update();
        const delta = _clock.getDelta();

        _zones.forEach((zone, idx) => {
            const wind = Math.sin(Date.now() * 0.0015 + idx) * 0.025;
            zone.plants.forEach(p => {
                p.rotation.z = wind;
                const ts = 0.5 + zone.growth * 1.5;
                p.scale.lerp(new THREE.Vector3(ts, ts, ts), 0.05);
            });
            if (zone.soilMesh) {
                const dry = new THREE.Color(0x2d2420);
                const wet = new THREE.Color(0x0a0808);
                zone.soilMesh.material.color.lerp(zone.water > 0.5 ? wet : dry, 0.05);
            }
        });

        if (_weather === 'rain') _animateRain(delta);
        _renderer.render(_scene, _camera);
    };
    animate();

    const sim = setInterval(() => { _runSimulationStep(); _updateUI(container); }, 1000);
    window.addEventListener('hashchange', () => { cancelAnimationFrame(_animId); clearInterval(sim); _renderer.dispose(); }, { once: true });
}

function _buildModularFarm() {
    const THREE = window.THREE;
    const bedGeo = new THREE.BoxGeometry(16, 1, 16);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x161e24 });

    _zones.forEach((zone, i) => {
        const x = (i % 2 === 0) ? -12 : 12;
        const z = (i < 2) ? -12 : 12;

        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.set(x, 0.5, z);
        bed.castShadow = true;
        bed.receiveShadow = true;
        bed.userData = { zoneId: zone.id };
        _scene.add(bed);
        zone.mesh = bed;

        const soil = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshStandardMaterial({ color: 0x2d2420 }));
        soil.rotation.x = -Math.PI / 2;
        soil.position.set(x, 1.01, z);
        soil.receiveShadow = true;
        _scene.add(soil);
        zone.soilMesh = soil;

        if (zone.type === 'greenhouse') _addGreenhouse(x, z);
        _populatePlants(zone, x, z);
    });
}

function _addGreenhouse(x, z) {
    const THREE = window.THREE;
    const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(8.5, 8.5, 16, 32, 1, true, 0, Math.PI),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    glass.rotation.z = Math.PI / 2;
    glass.position.set(x, 9.5, z);
    _scene.add(glass);
}

function _populatePlants(zone, cx, cz) {
    const THREE = window.THREE;
    const count = 40;
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.1, 1, 6);
    const leafGeo = new THREE.SphereGeometry(0.4, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1d3d1a });

    for (let i = 0; i < count; i++) {
        const p = new THREE.Group();
        const jX = (Math.random() - 0.5) * 13;
        const jZ = (Math.random() - 0.5) * 13;
        
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.y = 0.5;
        p.add(stem);
        
        const leaf = new THREE.Mesh(leafGeo, mat);
        leaf.position.y = 0.9;
        leaf.scale.set(1.5, 0.4, 1.2);
        p.add(leaf);

        p.position.set(cx + jX, 1.01, cz + jZ);
        p.scale.set(0.1, 0.1, 0.1);
        _scene.add(p);
        zone.plants.push(p);
    }
}

function _setWeather(type) {
    _weather = type;
    document.getElementById('btn-sun').classList.toggle('weather-btn-active', type === 'sunny');
    document.getElementById('btn-rain').classList.toggle('weather-btn-active', type === 'rain');
    
    _scene.children.forEach(l => {
        if (l.type === 'DirectionalLight') {
            l.intensity = type === 'rain' ? 0.3 : 1.4;
            l.color.setHex(type === 'rain' ? 0x94a3b8 : 0xfff1e0);
        }
    });

    if (type === 'rain') _createRain();
    else _removeRain();
}

let _rainSystem = null;
function _createRain() {
    const THREE = window.THREE;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(1500 * 3);
    for(let i=0; i<pos.length; i+=3) { pos[i]=(Math.random()-0.5)*150; pos[i+1]=Math.random()*80; pos[i+2]=(Math.random()-0.5)*150; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    _rainSystem = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x475569, size: 0.1, transparent: true, opacity: 0.4 }));
    _scene.add(_rainSystem);
}

function _removeRain() { if(_rainSystem) { _scene.remove(_rainSystem); _rainSystem = null; } }
function _animateRain(dt) { if(!_rainSystem) return; const p = _rainSystem.geometry.attributes.position.array; for(let i=1; i<p.length; i+=3) { p[i]-=50*dt; if(p[i]<0) p[i]=80; } _rainSystem.geometry.attributes.position.needsUpdate = true; }

function _runSimulationStep() {
    _simTime += 1;
    _zones.forEach(z => {
        z.water = Math.max(0, Math.min(1, z.water + (_weather === 'rain' ? 0.02 : -0.004)));
        z.growth = Math.min(1, z.growth + (z.water > 0.4 ? 0.001 : 0.0002));
        z.health = Math.max(0, Math.min(1, z.health + (z.water < 0.2 ? -0.01 : 0.003)));
    });
}

function _irrigateSelected() {
    const z = _zones.find(zone => zone.id === _selectedZoneId);
    if(z) { z.water = Math.min(1, z.water + 0.2); showToast(`${z.name} Hydration Boost`, 'success'); }
}

function _changeCropSelected() {
    const z = _zones.find(zone => zone.id === _selectedZoneId);
    if(z) { z.crop = 'GEN_' + Math.floor(Math.random()*999); _updateUI(document); showToast('Gen-Swap Finalized', 'info'); }
}

function _hidePanel() {
    _selectedZoneId = null;
    document.getElementById('zone-side-panel').classList.remove('translate-x-0');
    document.getElementById('zone-side-panel').classList.add('translate-x-[420px]');
}

function _updateUI(container) {
    const avg = Math.round(_zones.reduce((s, z) => s + z.health, 0) / _zones.length * 100);
    const gh = container.querySelector('#global-health'); if(gh) gh.innerText = avg + '%';
    const st = container.querySelector('#sim-time'); if(st) {
        const h = Math.floor(_simTime / 3600).toString().padStart(2, '0');
        const m = Math.floor((_simTime % 3600) / 60).toString().padStart(2, '0');
        const s = (_simTime % 60).toString().padStart(2, '0');
        st.innerText = `${h}:${m}:${s}`;
    }
    if (_selectedZoneId) {
        const z = _zones.find(zone => zone.id === _selectedZoneId);
        container.querySelector('#val-growth').innerText = Math.round(z.growth * 100) + '%';
        container.querySelector('#val-water').innerText = Math.round(z.water * 100) + '%';
        container.querySelector('#val-health').innerText = Math.round(z.health * 100) + '%';
        container.querySelector('#bar-growth').style.width = (z.growth * 100) + '%';
        container.querySelector('#bar-water').style.width = (z.water * 100) + '%';
        container.querySelector('#bar-health').style.width = (z.health * 100) + '%';
    }
}

async function _loadScript(url) { if (document.querySelector(`script[src="${url}"]`)) return; return new Promise((r) => { const s = document.createElement('script'); s.src = url; s.onload = r; document.head.appendChild(s); }); }
