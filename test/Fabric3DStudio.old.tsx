
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { YarnDefinition } from '../types';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, LayersIcon, GridIcon } from '../components/icons';

interface Fabric3DStudioProps {
    weavePattern: string[][];
    structure: boolean[][];
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    warpYarnSequence: string[];
    weftYarnSequence: string[];
    textureUrl: string; 
    epi: number;
    ppi: number;
}

/**
 * Procedural texture for yarn twist fibers
 */
const createTwistTexture = (yarn: YarnDefinition): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Base grey for bump mapping (neutral)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);
    
    const twistDir = yarn.twist === 'S' ? 1 : -1;
    const tpi = Math.max(5, yarn.tpi || 15);
    const numFibers = Math.floor(tpi * 3);
    
    // Draw fine fiber lines
    ctx.lineWidth = 1.5;
    for (let i = -numFibers; i < numFibers * 2; i++) {
        const offset = (i / numFibers) * 512;
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.2})`;
        ctx.beginPath();
        if (twistDir === 1) {
            ctx.moveTo(offset, 0);
            ctx.lineTo(offset + 512, 512);
        } else {
            ctx.moveTo(offset, 512);
            ctx.lineTo(offset + 512, 0);
        }
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 10); // Multiple wraps around the tube
    return texture;
};

export const Fabric3DStudio: React.FC<Fabric3DStudioProps> = ({
    weavePattern, structure, warpYarns, weftYarns, warpYarnSequence, weftYarnSequence, textureUrl, epi, ppi
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<'drape' | 'structure'>('structure');
    const [drapeObject, setDrapeObject] = useState<'curtain' | 'sofa'>('curtain');
    
    // Range state
    const [viewRange, setViewRange] = useState({ w: 16, h: 16 });
    
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const frameIdRef = useRef<number>(0);

    const yarnMaterialCache = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

    const technicalRepeat = useMemo(() => ({
        w: structure[0]?.length || 4,
        h: structure.length || 4
    }), [structure]);

    const handleSetFullRepeat = () => {
        setViewRange({
            w: Math.min(64, technicalRepeat.w),
            h: Math.min(64, technicalRepeat.h)
        });
    };

    const handleZoom = (delta: number) => {
        if (!cameraRef.current || !controlsRef.current) return;
        const cam = cameraRef.current;
        const controls = controlsRef.current;
        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);
        cam.position.addScaledVector(direction, delta);
        controls.update();
    };

    // --- INITIAL SETUP ---
    useEffect(() => {
        if (!containerRef.current) return;

        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020617); // Deeper slate
        scene.fog = new THREE.Fog(0x020617, 40, 180);

        const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
        camera.position.set(18, 12, 18);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.6;
        controls.zoomSpeed = 0.8; // More precise zoom
        controls.minDistance = 5;
        controls.maxDistance = 120;

        // --- ENHANCED LIGHTING RIG ---
        // 1. Natural Volume
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.6);
        scene.add(hemiLight);

        // 2. Key Light (Sun)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(20, 30, 10);
        keyLight.castShadow = true;
        keyLight.shadow.camera.left = -40;
        keyLight.shadow.camera.right = 40;
        keyLight.shadow.camera.top = 40;
        keyLight.shadow.camera.bottom = -40;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.bias = -0.0005;
        scene.add(keyLight);

        // 3. Rim Light (Backlight for thread separation)
        const rimLight = new THREE.SpotLight(0x3b82f6, 4);
        rimLight.position.set(-20, 10, -20);
        rimLight.angle = Math.PI / 4;
        rimLight.penumbra = 0.5;
        scene.add(rimLight);

        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        controlsRef.current = controls;

        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
            if (containerRef.current && renderer.domElement.parentNode) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    // --- SCENE CONTENT UPDATE ---
    useEffect(() => {
        if (!sceneRef.current || !rendererRef.current) return;
        const scene = sceneRef.current;

        for (let i = scene.children.length - 1; i >= 0; i--) {
            const obj = scene.children[i];
            if (obj.type === 'Mesh' || obj.type === 'Group') {
                scene.remove(obj);
            }
        }

        if (mode === 'drape') {
            const textureLoader = new THREE.TextureLoader();
            const tex = textureLoader.load(textureUrl);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy();

            if (drapeObject === 'curtain') {
                tex.repeat.set(4, 4); 
                const geometry = new THREE.PlaneGeometry(25, 25, 100, 100);
                const pos = geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const z = Math.sin(x * 1.2) * 2.2 + Math.cos(x * 3) * 0.4;
                    pos.setZ(i, z);
                }
                geometry.computeVertexNormals();
                const material = new THREE.MeshStandardMaterial({ 
                    map: tex, side: THREE.DoubleSide, roughness: 0.8, bumpMap: tex, bumpScale: 0.03 
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 10;
                mesh.castShadow = true;
                scene.add(mesh);
                controlsRef.current?.target.set(0, 10, 0);
            } else {
                tex.repeat.set(3, 3);
                const fabricMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
                const sofa = new THREE.Group();
                const base = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 10), fabricMat);
                base.position.y = 2.5; base.castShadow = true; sofa.add(base);
                const back = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 3), fabricMat);
                back.position.set(0, 7.5, -3.5); back.castShadow = true; sofa.add(back);
                scene.add(sofa);
                controlsRef.current?.target.set(0, 5, 0);
            }
        } else {
            // --- HIGH FIDELITY STRUCTURE MODE ---
            const spacing = 1.0;
            const group = new THREE.Group();
            
            const getColor = (hex: string) => parseInt(hex.replace('#', '0x'), 16);

            yarnMaterialCache.current.forEach(m => { m.dispose(); m.bumpMap?.dispose(); });
            yarnMaterialCache.current.clear();

            const getMaterial = (id: string, type: 'warp' | 'weft') => {
                const key = `${type}-${id}`;
                if (yarnMaterialCache.current.has(key)) return yarnMaterialCache.current.get(key)!;
                
                const def = (type === 'warp' ? warpYarns[id] : weftYarns[id]) || { color: '#ffffff', twist: 'Z', tpi: 15 } as any;
                const twistMap = createTwistTexture(def);
                const mat = new THREE.MeshStandardMaterial({
                    color: getColor(def.color),
                    roughness: def.roughness || 0.4,
                    metalness: def.fiberType === 'Lurex' ? 0.4 : 0.02,
                    bumpMap: twistMap,
                    bumpScale: 0.15 // High scale for visible twist
                });
                yarnMaterialCache.current.set(key, mat);
                return mat;
            };

            // WARP THREADS
            for (let i = 0; i < viewRange.w; i++) {
                const char = warpYarnSequence[i % warpYarnSequence.length] || 'A';
                const mat = getMaterial(char, 'warp');
                const thickness = (warpYarns[char]?.thickness || 1) * 0.38;

                const points = [];
                for (let j = 0; j <= viewRange.h; j++) {
                    const isOver = structure[j % structure.length] ? structure[j % structure.length][i % structure[0].length] : false;
                    points.push(new THREE.Vector3(i * spacing, isOver ? thickness : -thickness, j * spacing));
                }
                const curve = new THREE.CatmullRomCurve3(points);
                const geo = new THREE.TubeGeometry(curve, viewRange.h * 8, thickness, 8, false);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.castShadow = mesh.receiveShadow = true;
                group.add(mesh);
            }

            // WEFT THREADS
            for (let j = 0; j < viewRange.h; j++) {
                const char = weftYarnSequence[j % weftYarnSequence.length] || 'A';
                const mat = getMaterial(char, 'weft');
                const thickness = (weftYarns[char]?.thickness || 1) * 0.38;

                const points = [];
                for (let i = 0; i <= viewRange.w; i++) {
                    const isWarpOver = structure[j % structure.length] ? structure[j % structure.length][i % structure[0].length] : false;
                    points.push(new THREE.Vector3(i * spacing, isWarpOver ? -thickness : thickness, j * spacing));
                }
                const curve = new THREE.CatmullRomCurve3(points);
                const geo = new THREE.TubeGeometry(curve, viewRange.w * 8, thickness, 8, false);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.castShadow = mesh.receiveShadow = true;
                group.add(mesh);
            }

            const centerX = (viewRange.w * spacing) / 2;
            const centerZ = (viewRange.h * spacing) / 2;
            group.position.set(-centerX, 0, -centerZ);
            scene.add(group);
            
            controlsRef.current?.target.set(0, 0, 0);
        }

    }, [mode, drapeObject, structure, warpYarns, weftYarns, textureUrl, viewRange]);

    return (
        <div className="relative w-full h-full bg-slate-950 group font-sans">
            <div ref={containerRef} className="w-full h-full" />
            
            {/* 3D Navigation Overlay */}
            <div className="absolute top-4 right-4 flex flex-col gap-4">
                {mode === 'structure' && (
                    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col gap-4 w-60">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Interlace Grid</span>
                            <button onClick={handleSetFullRepeat} className="px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded uppercase hover:bg-blue-500 transition-colors">Technical Repeat</button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1.5 uppercase">Width (Ends): <span className="text-white">{viewRange.w}</span></div>
                                <input type="range" min="4" max="64" value={viewRange.w} onChange={e => setViewRange(v => ({...v, w: parseInt(e.target.value)}))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1.5 uppercase">Height (Picks): <span className="text-white">{viewRange.h}</span></div>
                                <input type="range" min="4" max="64" value={viewRange.h} onChange={e => setViewRange(v => ({...v, h: parseInt(e.target.value)}))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-blue-500" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Precision Zoom Tools */}
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-1 shadow-2xl flex flex-col items-center gap-1 self-end">
                    <button onClick={() => handleZoom(3)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors" title="Zoom In"><ZoomInIcon className="w-4 h-4"/></button>
                    <button onClick={() => handleZoom(-3)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors" title="Zoom Out"><ZoomOutIcon className="w-4 h-4"/></button>
                    <div className="w-6 h-px bg-slate-800 my-1"></div>
                    <button onClick={() => { controlsRef.current?.reset(); setViewRange({w:16, h:16}); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors" title="Reset Camera"><ResetZoomIcon className="w-4 h-4"/></button>
                </div>
            </div>

            {/* Mode & Object Toggle */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl flex flex-col gap-2 shadow-2xl items-center ring-1 ring-white/10">
                <div className="flex gap-1 p-0.5 bg-black/40 rounded-xl">
                    <button 
                        onClick={() => setMode('structure')}
                        className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${mode === 'structure' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        <LayersIcon className="w-3.5 h-3.5" /> Interlacement
                    </button>
                    <button 
                        onClick={() => setMode('drape')}
                        className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${mode === 'drape' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        <GridIcon className="w-3.5 h-3.5" /> Drape Simulator
                    </button>
                </div>

                {mode === 'drape' && (
                    <div className="flex gap-1 w-full px-1">
                        <button 
                            onClick={() => setDrapeObject('curtain')}
                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all border ${drapeObject === 'curtain' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            Curtain
                        </button>
                        <button 
                            onClick={() => setDrapeObject('sofa')}
                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all border ${drapeObject === 'sofa' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            Sofa
                        </button>
                    </div>
                )}
            </div>

            {/* Version Badge */}
            <div className="absolute top-4 left-4">
                <div className="bg-blue-600/20 backdrop-blur border border-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">3D PBR INTERLACE ENGINE v3.0</span>
                </div>
            </div>
        </div>
    );
};
