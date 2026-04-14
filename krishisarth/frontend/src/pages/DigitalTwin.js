import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment, ContactShadows, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import htm from 'htm';
import { api } from '../api/client.js';
import { showToast } from '../components/toast.js';

const html = htm.bind(React.createElement);

/**
 * KrishiSarth Elite Digital Twin (v4.1 - R3F + HTM)
 * Production-ready without build step.
 */

const DEVICE_MAP = {
  'pump_RC385': { name: 'RC385 Main Pump', type: 'pump' },
  'valve_B': { name: 'Valve B (Leafy Greens)', type: 'valve' },
  'valve_C': { name: 'Valve C (Root Veggies)', type: 'valve' },
  'valve_D': { name: 'Valve D (Herbs)', type: 'valve' },
  'valve_greenhouse': { name: 'Greenhouse Valve', type: 'valve' },
  'zone_A_polyhouse': { name: 'Greenhouse Zone', type: 'zone' },
  'zone_B': { name: 'Leafy Greens Zone', type: 'zone' },
  'zone_C': { name: 'Root Vegetables Zone', type: 'zone' },
  'zone_D': { name: 'Herbs Zone', type: 'zone' },
  'fertilizer_mixer': { name: 'Nutrient Mixer', type: 'mixer' },
  'water_tank': { name: 'Main Reservoir', type: 'tank' }
};

function Model({ mode, onSelect, selectedId, deviceStates }) {
  const { scene } = useGLTF('./assets/hydroponic greenhouse 3d model.glb');
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const deviceMatch = Object.keys(DEVICE_MAP).find(key => 
          child.name.includes(key) || (child.parent && child.parent.name.includes(key))
        );
        if (deviceMatch) {
          child.userData.deviceId = deviceMatch;
          child.userData.isInteractive = true;
        }
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    scene.traverse((child) => {
      if (child.userData.deviceId === 'fertilizer_mixer' && deviceStates.pump_active) {
          child.rotation.y += delta * 2;
      }
      if (child.isMesh && child.userData.isInteractive) {
        const isSelected = child.userData.deviceId === selectedId;
        const isHovered = child.userData.deviceId === hovered;
        if (isSelected) {
            child.material.emissive?.set('#10b981');
            child.material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
        } else if (isHovered && mode === 'act') {
            child.material.emissive?.set('#34d399');
            child.material.emissiveIntensity = 0.3;
        } else {
            child.material.emissive?.set('#000000');
            child.material.emissiveIntensity = 0;
        }
      }
    });
  });

  return html`
    <primitive 
       object=${scene} 
       scale=${1.5} 
       position=${[0, -5, 0]}
       onClick=${(e) => {
         if (mode !== 'act') return;
         e.stopPropagation();
         const devId = e.object.userData.deviceId;
         if (devId) onSelect(devId);
       }}
       onPointerOver=${(e) => {
         if (mode !== 'act') return;
         e.stopPropagation();
         setHovered(e.object.userData.deviceId);
       }}
       onPointerOut=${() => setHovered(null)}
    />
  `;
}

const DigitalTwin = () => {
  const [mode, setMode] = useState('view');
  const [selectedId, setSelectedId] = useState(null);
  const [deviceStates, setDeviceStates] = useState({ pump_active: false });
  const [undoTimer, setUndoTimer] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const selectedDevice = useMemo(() => DEVICE_MAP[selectedId], [selectedId]);

  const handleIrrigate = () => {
    setCountdown(5);
    setUndoTimer(true);
    showToast('Command Primed: Synchronizing hardware...', 'info');
  };

  useEffect(() => {
    let timer;
    if (undoTimer && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && undoTimer) {
       setUndoTimer(false);
       setDeviceStates(prev => ({ ...prev, pump_active: true }));
       showToast('Orchestration Finalized: Transmitting via MQTT', 'success');
    }
    return () => clearInterval(timer);
  }, [countdown, undoTimer]);

  return html`
    <div className="w-full h-screen relative bg-[#0a0f12]">
      <${Canvas} shadows camera=${{ position: [40, 40, 40], fov: 35 }}>
        <${Suspense} fallback=${html`<${Html} center><div className="text-emerald-500 font-mono uppercase tracking-widest animate-pulse">Neural Linking...</div><//>`}>
            <${Environment} preset="city" />
            <ambientLight intensity=${0.4} />
            <directionalLight position=${[10, 10, 5]} intensity=${1} castShadow shadow-mapSize=${[2048, 2048]} />
            
            <${Model} 
               mode=${mode} 
               selectedId=${selectedId} 
               onSelect=${setSelectedId} 
               deviceStates=${deviceStates} 
            />
            
            <${ContactShadows} position=${[0, -5, 0]} opacity=${0.4} scale=${100} blur=${2} far=${10} />
            <${OrbitControls} makeDefault dampingFactor=${0.05} maxPolarAngle=${Math.PI / 2.1} />
        <//>
      <//>

      <div className="absolute top-6 left-6 flex flex-col gap-4 z-50">
          <div className="glass-panel p-2 flex flex-col gap-2 bg-slate-900/40 border-white/5 border border-white/5 rounded-2xl">
              <button 
                onClick=${() => setMode('view')} 
                className=${`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${mode === 'view' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                title="View Mode"
              >
                  <i data-lucide="eye" className="w-5 h-5"></i>
              </button>
              <button 
                onClick=${() => setMode('act')} 
                className=${`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${mode === 'act' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Act Mode"
              >
                  <i data-lucide="shield" className="w-5 h-5"></i>
              </button>
          </div>
      </div>

      <div className=${`absolute top-6 right-6 w-[400px] glass-panel p-8 z-[100] transform transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) border-white/5 border rounded-3xl ${selectedId ? 'translate-x-0' : 'translate-x-[460px]'}`}>
          ${selectedDevice && html`
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white font-display uppercase tracking-tight">${selectedDevice.name}</h2>
                        <div className="badge-elite badge-success mt-2">LINK_ACTIVE</div>
                    </div>
                    <button onClick=${() => setSelectedId(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-slate-400 hover:text-white">
                        <i data-lucide="x" className="w-5 h-5"></i>
                    </button>
                </div>

                <div className="elite-well p-6 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <i data-lucide="cpu" className="w-4 h-4 text-emerald-400"></i>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ML_Inference</span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-400 font-bold uppercase">Predicted Efficiency</span>
                            <span className="text-xs text-white font-mono">94%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style=${{ width: '94%' }}></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <button 
                      onClick=${handleIrrigate}
                      disabled=${undoTimer}
                      className="w-full btn-elite py-5 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                        <i data-lucide="zap" className="w-4 h-4"></i>
                        EXECUTE ORCHESTRATION
                    </button>
                    
                    ${undoTimer && html`
                       <button 
                         onClick=${() => { setUndoTimer(false); showToast('Orchestration Aborted', 'info'); }}
                         className="w-full py-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-amber-500/20 transition-all"
                       >
                           ABORT COMMAND (${countdown}S)
                       </button>
                    `}
                </div>
            </div>
          `}
      </div>

      <style>${`
        .glass-panel { background: rgba(10, 15, 20, 0.7); backdrop-filter: blur(20px); }
        .badge-elite { padding: 4px 10px; border-radius: 6px; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; border: 1px solid rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); color: #10b981; }
      `}</style>
    </div>
  `;
};

export default DigitalTwin;
