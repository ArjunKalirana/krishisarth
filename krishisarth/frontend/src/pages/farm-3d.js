import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { showToast } from '../components/toast.js';

/**
 * KrishiSarth Digital Twin v5.0 — Vanilla Three.js (Production)
 * 
 * Eliminated React Three Fiber entirely.  R3F's react-reconciler
 * requires a shared React Scheduler instance that cannot be satisfied
 * through browser import-maps / esm.sh.  Vanilla Three.js is a single
 * self-contained library — zero dependency chain issues.
 *
 * Features retained:
 *   • GLB model loading with shadow casting
 *   • Device mapping & interactive raycasting (Act Mode)
 *   • Emissive selection / hover pulse
 *   • Orchestration panel with 5-sec undo gate
 *   • ML inference preview stub
 */

const DEVICE_MAP = {
    'pump_RC385':        { name: 'RC385 Main Pump',   type: 'pump'  },
    'valve_B':           { name: 'Valve B (Leafy)',    type: 'valve' },
    'valve_C':           { name: 'Valve C (Root)',     type: 'valve' },
    'valve_D':           { name: 'Valve D (Herbs)',    type: 'valve' },
    'valve_greenhouse':  { name: 'Greenhouse Valve',   type: 'valve' },
    'zone_A_polyhouse':  { name: 'Greenhouse Zone',    type: 'zone'  },
    'zone_B':            { name: 'Leafy Greens Zone',  type: 'zone'  },
    'zone_C':            { name: 'Root Vegetable Zone', type: 'zone'  },
    'zone_D':            { name: 'Herbs Zone',         type: 'zone'  },
    'fertilizer_mixer':  { name: 'Nutrient Mixer',     type: 'mixer' },
    'water_tank':        { name: 'Main Reservoir',     type: 'tank'  },
};

export function renderFarm3D() {
    // ─── Container ──────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'farm3d-root';
    container.style.cssText = 'position:relative;width:100%;height:100vh;background:#0a0f12;overflow:hidden;';

    // ─── State ──────────────────────────────────────────────────
    let mode = 'view';          // 'view' | 'act'
    let selectedId = null;
    let hoveredId = null;
    let pumpActive = false;
    let undoTimer = null;
    let countdown = 0;
    const interactives = [];    // meshes with device mapping

    // ─── Three.js Core ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x0a0f12);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f12, 0.008);
    
    // Create a high-fidelity environment map
    const gen = new THREE.PMREMGenerator(renderer);
    scene.environment = gen.fromScene(new THREE.Scene()).texture;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    camera.position.set(40, 40, 40);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);

    // ─── Lighting Rig ───────────────────────────────────────────
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.5);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(10, 15, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -25;
    key.shadow.camera.right = 25;
    key.shadow.camera.top = 25;
    key.shadow.camera.bottom = -25;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8eb4d4, 0.3);
    fill.position.set(-5, 5, -5);
    scene.add(fill);

    const point = new THREE.PointLight(0xfff4e6, 0.4, 100);
    point.position.set(0, 10, 0);
    scene.add(point);

    // Ground plane for shadow reception
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.ShadowMaterial({ opacity: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── Raycaster ──────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // ─── Load GLB Model ─────────────────────────────────────────
    const loader = new GLTFLoader();
    
    // RENAMED for maximum reliability: farm_model.glb -> model.glb
    const MODEL_PATH = '/assets/model.glb';
    
    loader.load(
        MODEL_PATH,
        (gltf) => {
            const model = gltf.scene;
            model.scale.setScalar(1.5);
            model.position.set(0, -5, 0);

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Clone material so emissive changes don't bleed between meshes
                    if (child.material) {
                        child.material = child.material.clone();
                    }

                    const match = Object.keys(DEVICE_MAP).find(key =>
                        child.name.toLowerCase().includes(key.toLowerCase()) ||
                        (child.parent && child.parent.name.toLowerCase().includes(key.toLowerCase()))
                    );
                    if (match) {
                        child.userData.deviceId = match;
                        interactives.push(child);
                    }
                }
            });

            scene.add(model);
            
            // Hide loading indicator with transition
            const loadingEl = container.querySelector('#twin-loading');
            if (loadingEl) {
                loadingEl.style.transition = 'opacity 0.8s ease-out';
                loadingEl.style.opacity = '0';
                setTimeout(() => loadingEl.style.display = 'none', 800);
            }
            
            showToast('Neural Twin Synchronized', 'success');
        },
        (progress) => {
            const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
            const loadingPctEl = container.querySelector('#twin-loading-pct');
            const loadingBarEl = container.querySelector('#twin-loading-bar-fill');
            if (loadingPctEl) loadingPctEl.textContent = `${pct}%`;
            if (loadingBarEl) loadingBarEl.style.width = `${pct}%`;
        },
        (err) => {
            console.error('[DigitalTwin] GLB load error:', err);
            const loadingEl = container.querySelector('#twin-loading');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="glass-hud p-10 rounded-[3rem] border-red-500/20 text-center space-y-4 animate-in zoom-in">
                        <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i data-lucide="unplug" class="w-10 h-10 text-red-500"></i>
                        </div>
                        <h3 class="text-3xl font-black text-white font-display uppercase tracking-tight">Signal Lost</h3>
                        <p class="text-slate-400 text-xs font-medium max-w-[240px] leading-relaxed mx-auto">
                            The neural asset <span class="text-red-400 font-mono">${MODEL_PATH}</span> could not be resolved.
                        </p>
                        <button onclick="window.location.reload()" class="mt-8 btn-emerald bg-red-500 hover:bg-red-400 text-black px-10 py-4">
                            RE-INITIALIZE LINK
                        </button>
                    </div>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    );

    // ─── Render Loop ────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId = null;

    function animate() {
        animId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();
        controls.update();

        // Per-frame interactive mesh updates
        for (const mesh of interactives) {
            // Mixer rotation animation
            if (mesh.userData.deviceId === 'fertilizer_mixer' && pumpActive) {
                mesh.rotation.y += delta * 2;
            }

            const isSelected = mesh.userData.deviceId === selectedId;
            const isHovered = mesh.userData.deviceId === hoveredId;

            if (mesh.material) {
                if (isSelected) {
                    mesh.material.emissive.set(0x10b981);
                    mesh.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 6) * 0.3;
                } else if (isHovered && mode === 'act') {
                    mesh.material.emissive.set(0x34d399);
                    mesh.material.emissiveIntensity = 0.4;
                } else {
                    mesh.material.emissive.set(0x000000);
                    mesh.material.emissiveIntensity = 0;
                }
            }
        }

        renderer.render(scene, camera);
    }

    // ─── Resize ─────────────────────────────────────────────────
    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    // ─── Pointer Events ─────────────────────────────────────────
    function onPointerMove(e) {
        if (mode !== 'act') { hoveredId = null; renderer.domElement.style.cursor = 'grab'; return; }
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactives, false);
        if (hits.length > 0) {
            hoveredId = hits[0].object.userData.deviceId;
            renderer.domElement.style.cursor = 'pointer';
        } else {
            hoveredId = null;
            renderer.domElement.style.cursor = 'grab';
        }
    }

    function onClick(e) {
        if (mode !== 'act') return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(interactives, false);
        if (hits.length > 0) {
            selectedId = hits[0].object.userData.deviceId;
            updatePanel();
        }
    }

    // ─── Orchestration Panel ────────────────────────────────────
    function updatePanel() {
        const panel = container.querySelector('#twin-panel');
        if (!panel) return;

        if (!selectedId || !DEVICE_MAP[selectedId]) {
            panel.style.transform = 'translateX(460px)';
            return;
        }

        const dev = DEVICE_MAP[selectedId];
        panel.style.transform = 'translateX(0)';
        panel.innerHTML = `
            <div class="space-y-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-black text-white font-display uppercase tracking-tight">${dev.name}</h2>
                        <div class="mt-2" style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:8px;font-weight:800;letter-spacing:0.1em;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.05);color:#10b981;">LINK_ACTIVE</div>
                    </div>
                    <button id="twin-close" class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <div class="p-6 rounded-2xl bg-white/5 border border-white/5" style="box-shadow:inset 0 0 40px rgba(0,0,0,0.5)">
                    <div class="flex items-center gap-3 mb-4">
                        <i data-lucide="cpu" class="w-4 h-4 text-emerald-400"></i>
                        <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ML_Inference</span>
                    </div>
                    <div class="space-y-4">
                        <div class="flex justify-between">
                            <span class="text-xs text-slate-400 font-bold uppercase">Predicted Efficiency</span>
                            <span class="text-xs text-white font-mono">94%</span>
                        </div>
                        <div class="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500" style="width:94%"></div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-4">
                    <button id="twin-execute" class="w-full py-5 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50">
                        <i data-lucide="zap" class="w-4 h-4"></i>
                        EXECUTE ORCHESTRATION
                    </button>
                    <div id="twin-undo-slot"></div>
                </div>
            </div>`;
        
        // Event bindings
        panel.querySelector('#twin-close').addEventListener('click', () => {
            selectedId = null;
            updatePanel();
        });
        panel.querySelector('#twin-execute').addEventListener('click', handleExecute);

        if (window.lucide) window.lucide.createIcons();
    }

    function handleExecute() {
        if (undoTimer) return;
        countdown = 5;
        showToast('Command Primed: Synchronizing hardware...', 'info');

        const slot = container.querySelector('#twin-undo-slot');
        const execBtn = container.querySelector('#twin-execute');
        if (execBtn) execBtn.disabled = true;

        function tick() {
            if (countdown <= 0) {
                clearInterval(undoTimer);
                undoTimer = null;
                pumpActive = true;
                if (slot) slot.innerHTML = '';
                if (execBtn) execBtn.disabled = false;
                showToast('Orchestration Finalized: Transmitting via MQTT', 'success');
                return;
            }
            if (slot) slot.innerHTML = `
                <button id="twin-abort" class="w-full py-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-amber-500/20 transition-all">
                    ABORT COMMAND (${countdown}S)
                </button>`;
            const abortBtn = slot?.querySelector('#twin-abort');
            if (abortBtn) abortBtn.addEventListener('click', () => {
                clearInterval(undoTimer);
                undoTimer = null;
                if (slot) slot.innerHTML = '';
                if (execBtn) execBtn.disabled = false;
                showToast('Orchestration Aborted', 'info');
            });
            countdown--;
        }

        tick();
        undoTimer = setInterval(tick, 1000);
    }

    // ─── HUD (Mode Toggle + Loading) ────────────────────────────
    container.innerHTML += `
        <!-- Loading Indicator -->
        <div id="twin-loading" class="absolute inset-0 flex flex-col items-center justify-center gap-8 z-40 bg-[#0a0f12]">
            <div class="relative">
                <div class="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i data-lucide="box" class="w-8 h-8 text-emerald-500/40"></i>
                </div>
            </div>
            <div class="flex flex-col items-center gap-2">
                <div class="text-emerald-500 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">
                    Streaming Neural Asset... <span id="twin-loading-pct">0%</span>
                </div>
                <div class="w-48 h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                    <div id="twin-loading-bar-fill" class="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-300" style="width:0%"></div>
                </div>
            </div>
        </div>

        <!-- Mode Toggle -->
        <div class="absolute top-6 left-6 flex flex-col gap-4 z-50">
            <div style="background:rgba(10,15,20,0.7);backdrop-filter:blur(20px)" class="p-2 flex flex-col gap-2 border border-white/5 rounded-2xl">
                <button id="twin-mode-view" title="View Mode" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <i data-lucide="eye" class="w-5 h-5"></i>
                </button>
                <button id="twin-mode-act" title="Act Mode" class="w-12 h-12 rounded-xl flex items-center justify-center transition-all text-slate-400 hover:text-white">
                    <i data-lucide="shield" class="w-5 h-5"></i>
                </button>
            </div>
        </div>

        <!-- Side Panel -->
        <div id="twin-panel" class="absolute top-6 right-6 w-full max-w-[400px] p-8 z-[100] border border-white/5 rounded-3xl transition-transform duration-700" style="background:rgba(10,15,20,0.7);backdrop-filter:blur(20px);transform:translateX(460px)">
        </div>`;

    // ─── Mode Buttons ───────────────────────────────────────────
    function setMode(newMode) {
        mode = newMode;
        const viewBtn = container.querySelector('#twin-mode-view');
        const actBtn = container.querySelector('#twin-mode-act');
        if (viewBtn && actBtn) {
            viewBtn.className = `w-12 h-12 rounded-xl flex items-center justify-center transition-all ${mode === 'view' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white'}`;
            actBtn.className = `w-12 h-12 rounded-xl flex items-center justify-center transition-all ${mode === 'act' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white'}`;
        }
        if (mode === 'view') {
            selectedId = null;
            hoveredId = null;
            updatePanel();
        }
    }

    // ─── Boot ───────────────────────────────────────────────────
    // Use setTimeout to ensure the container is in the DOM before sizing
    setTimeout(() => {
        onResize();
        animate();

        // Bind events
        window.addEventListener('resize', onResize);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('click', onClick);

        const viewBtn = container.querySelector('#twin-mode-view');
        const actBtn = container.querySelector('#twin-mode-act');
        viewBtn?.addEventListener('click', () => setMode('view'));
        actBtn?.addEventListener('click', () => setMode('act'));

        if (window.lucide) window.lucide.createIcons();
    }, 0);

    // ─── Cleanup (when container is removed from the DOM) ───────
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            controls.dispose();
            if (undoTimer) clearInterval(undoTimer);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return container;
}
