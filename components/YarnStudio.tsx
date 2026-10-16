import React, { useState, useEffect, useRef, useMemo } from 'react';
import { YarnDefinition, YarnModel, YarnConstruction, FiberType } from '../types';
import { generateYarnTexture } from '../services/yarnRenderer';
import { RulerIcon, CopyIcon, ZoomInIcon, ZoomOutIcon, ResetZoomIcon, ShuffleIcon, PencilIcon, PlusIcon, TrashIcon } from './icons';

interface YarnStudioProps {
    yarn: YarnDefinition;
    onChange: (def: YarnDefinition) => void;
    onApply: () => void;
}

// Pre-defined "Global Library" presets
const GLOBAL_LIBRARY: { name: string, def: YarnDefinition }[] = [
    { name: "Bouclé Loop", def: { color: '#e5e7eb', loopColor: '#3b82f6', coreColor: '#9ca3af', model: 'simple', construction: 'boucle', fiberType: 'Wool', countSystem: 'Nm', count: 12, ply: 1, thickness: 1.5, twist: 'Z', tpi: 8, sheen: 0.3, roughness: 0.7, loopSize: 1.2, loopInterval: 0.5, overfeedRatio: 1.8, twistAmount: 250, binderColor: '#1e3a8a', loopRounding: 0.7, extraOverlap: 0.2 } },
    { name: "Fine Mohair", def: { color: '#fdfcf0', model: 'simple', construction: 'standard', fiberType: 'Wool', countSystem: 'Nm', count: 40, ply: 1, thickness: 0.8, twist: 'Z', tpi: 12, sheen: 0.4, roughness: 0.6, hairiness: 0.7, hairLength: 0.9, hairThickness: 2.5, extraOverlap: 0.8 } },
    { name: "Cotton 2/30", def: { color: '#e5e7eb', model: 'simple', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 30, ply: 2, thickness: 1.0, twist: 'Z', tpi: 15, sheen: 0.1, roughness: 0.4 } },
    { name: "Siro Grindle (Grey)", def: { color: '#333333', colorB: '#999999', model: 'grindle', construction: 'standard', fiberType: 'Poly-Cotton', countSystem: 'Ne', count: 20, ply: 2, thickness: 1.2, twist: 'Z', tpi: 22, sheen: 0.2, roughness: 0.3, strength: 18.5, elongation: 6.2, ipi: 45 } },
    { name: "Silk Crepe", def: { color: '#fca5a5', model: 'simple', construction: 'standard', fiberType: 'Silk', countSystem: 'Denier', count: 50, ply: 1, thickness: 0.6, twist: 'S', tpi: 35, sheen: 0.9, roughness: 0.1, shadowStrength: 0.6 } },
    { name: "Wool Roving", def: { color: '#d1d5db', model: 'simple', construction: 'standard', fiberType: 'Wool', countSystem: 'Nm', count: 4, ply: 1, thickness: 2.2, twist: 'Z', tpi: 1.5, sheen: 0.2, roughness: 0.8, hairiness: 0.5, hairLength: 0.4 } },
    { name: "Chenille Velvet", def: { color: '#9333ea', model: 'simple', construction: 'chenille', fiberType: 'Synthetic', countSystem: 'Nm', count: 6, ply: 1, thickness: 2.0, twist: 'Z', tpi: 4, sheen: 0.6, roughness: 0.5, hairiness: 0.8, hairLength: 0.1 } },
    { name: "Linen Slub", def: { color: '#d6d3d1', model: 'simple', construction: 'slub', fiberType: 'Linen', countSystem: 'Lea', count: 20, ply: 1, thickness: 1.1, twist: 'S', tpi: 12, sheen: 0.4, roughness: 0.6, slubLength: 2.5, slubDistance: 8.0, slubAmplitude: 150, slubMode: 'random' } },
    { name: "Mouline Twist", def: { color: '#ef4444', colorB: '#1e3a8a', model: 'mouline', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 20, ply: 2, thickness: 1.2, twist: 'Z', tpi: 18, sheen: 0.2, roughness: 0.3 } },
    { name: "Space Dye Ocean", def: { color: '#0ea5e9', colorB: '#1e3a8a', model: 'space-dyed', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 16, ply: 1, thickness: 1.3, twist: 'Z', tpi: 10, sheen: 0.2, roughness: 0.3, spaceDyeLength: 12 } },
    { name: "Donegal Tweed", def: { color: '#78716c', colorC: '#f59e0b', model: 'simple', construction: 'tweed', fiberType: 'Wool', countSystem: 'Nm', count: 8, ply: 1, thickness: 1.8, twist: 'Z', tpi: 6, sheen: 0.1, roughness: 0.9, hairiness: 0.4 } },
    { name: "Gold Lurex", def: { color: '#fbbf24', model: 'simple', construction: 'standard', fiberType: 'Lurex', countSystem: 'Denier', count: 100, ply: 1, thickness: 0.8, twist: 'S', tpi: 0, sheen: 1.0, roughness: 0.1, shadowStrength: 0.9 } },
];

const calculateTechSpecs = (yarn: YarnDefinition) => {
    let nm = 0;
    const safeCount = Math.max(0.1, yarn.count);
    const ply = Math.max(1, yarn.ply);

    switch (yarn.countSystem) {
        case 'Nm': nm = safeCount / ply; break;
        case 'Ne': nm = (safeCount * 1.6934) / ply; break;
        case 'Lea': nm = (safeCount * 0.6048) / ply; break;
        case 'Denier': nm = 9000 / (safeCount * ply); break;
        case 'Tex': nm = 1000 / (safeCount * ply); break;
        default: nm = safeCount / ply;
    }

    const tex = 1000 / nm;
    const denier = 9000 / nm;
    
    let diamCoeff = 0.037;
    if (['Silk', 'Synthetic', 'Lurex'].includes(yarn.fiberType)) {
        diamCoeff = 0.032;
    }

    const diameterMm = diamCoeff * Math.sqrt(tex);

    return { nm, tex, denier, diameterMm };
};

export const YarnStudio: React.FC<YarnStudioProps> = ({
    yarn, onChange, onApply
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [viewScale, setViewScale] = useState(0.2);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [customLibrary, setCustomLibrary] = useState<{ name: string, def: YarnDefinition, id: number }[]>(() => {
        try {
            const saved = localStorage.getItem('wonderweaves_custom_yarns');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { 
            console.error("Failed to load yarn library", e);
            return []; 
        }
    });

    const displayLibrary = useMemo(() => {
        const allItems = [
            ...customLibrary.map(item => ({ ...item, isCustom: true, key: `custom-${item.id}` })),
            ...GLOBAL_LIBRARY.map((item, i) => ({ ...item, isCustom: false, id: -1, key: `global-${i}` }))
        ];
        
        if (!searchTerm.trim()) return allItems;
        
        const lowerTerm = searchTerm.toLowerCase();
        return allItems.filter(item => 
            item.name.toLowerCase().includes(lowerTerm) || 
            item.def.fiberType.toLowerCase().includes(lowerTerm)
        );
    }, [customLibrary, searchTerm]);

    const specs = useMemo(() => calculateTechSpecs(yarn), [yarn]);

    const handleParamChange = (key: keyof YarnDefinition, value: any) => {
        onChange({ ...yarn, [key]: value });
    };

    const loadFromLibrary = (def: YarnDefinition) => {
        onChange({ ...def });
    };

    const handleSaveToLibrary = () => {
        const defaultName = yarn.code || `My ${yarn.fiberType} Yarn`;
        const name = prompt("Name your yarn preset:", defaultName);
        if (!name) return;

        try {
            const newItem = { name, def: { ...yarn }, id: Date.now() };
            
            setCustomLibrary(prev => {
                const updated = [newItem, ...prev];
                try {
                    localStorage.setItem('wonderweaves_custom_yarns', JSON.stringify(updated));
                } catch(e) {
                    alert("Could not save to local storage (Quota exceeded?)");
                }
                return updated;
            });
            setSearchTerm('');
        } catch (e) {
            console.error("Error saving yarn:", e);
        }
    };

    const handleDeleteFromLibrary = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if(window.confirm('Delete this preset from your library?')) {
            setCustomLibrary(prev => {
                const updated = prev.filter(item => item.id !== id);
                localStorage.setItem('wonderweaves_custom_yarns', JSON.stringify(updated));
                return updated;
            });
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !yarn) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = container.offsetWidth;
        const h = container.offsetHeight;
        canvas.width = w;
        canvas.height = h;

        const isRandom = yarn.slubMode === 'random';
        const variants = isRandom ? 3 : 1;
        const textures: HTMLCanvasElement[] = [];
        
        for(let i=0; i<variants; i++) {
            textures.push(generateYarnTexture(yarn, 144));
        }
        
        ctx.clearRect(0,0,w,h);
        
        const bgGrad = ctx.createLinearGradient(0,0,w,0);
        bgGrad.addColorStop(0, '#111827');
        bgGrad.addColorStop(0.5, '#1f2937');
        bgGrad.addColorStop(1, '#111827');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0,0,w,h);

        const spreadFactor = 1.0 + (yarn.extraOverlap || 0);
        const targetCoreWidth = (w / 18) * yarn.thickness * spreadFactor * viewScale;
        const drawWidth = targetCoreWidth * 4.0; 
        const spacingMod = yarn.spacing || 0;
        const threadStep = targetCoreWidth * (0.95 + spacingMod); 
        const threadsNeeded = Math.ceil(w / threadStep) + 2;
        
        const threadIndices = Array.from({length: threadsNeeded}, (_, i) => i);
        
        ctx.save();
        
        threadIndices.forEach(i => {
            const cx = Math.round((i * threadStep) - (threadStep/2));
            ctx.save();
            ctx.translate(cx, 0);
            
            const noise = (Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1; 
            const texIndex = Math.floor(Math.abs(noise * 100)) % textures.length;
            const texture = textures[texIndex];
            const yOffset = Math.floor(Math.abs(noise) * texture.width);
            
            const tilesNeeded = Math.ceil(h / (texture.width * (drawWidth/texture.height))) + 1;
            const lengthScale = drawWidth / texture.height;
            
            for(let j=0; j<tilesNeeded; j++) {
                const dy = (j * texture.width * lengthScale) - (yOffset * lengthScale);
                ctx.save();
                ctx.translate(0, dy); 
                ctx.rotate(Math.PI/2); 
                ctx.drawImage(texture, 0, -drawWidth/2, texture.width * lengthScale, drawWidth);
                ctx.restore();
            }
            ctx.restore();
        });

        ctx.restore();

        const vignette = ctx.createRadialGradient(w/2, h/2, w/3, w/2, h/2, w);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0,0,w,h);

    }, [yarn, viewScale]);

    const ControlGroup: React.FC<{title: string, children: React.ReactNode, color?: string}> = ({title, children, color="text-gray-500"}) => (
        <div className="mb-6 border-b border-gray-100 pb-4">
            <h3 className={`text-xs font-bold ${color} uppercase tracking-widest mb-3`}>{title}</h3>
            <div className="space-y-4">{children}</div>
        </div>
    );

    const Slider = ({label, value, min, max, step, onChange, subLabel=""}: any) => (
        <div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                <span>{label}</span>
                <span className="text-gray-900">{typeof value === 'number' ? value.toFixed(2) : value} {subLabel}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value || 0} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
        </div>
    );

    return (
        <div className="flex h-full w-full bg-white text-gray-900 font-sans">
            {/* LEFT: GLOBAL LIBRARY */}
            <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50 flex-shrink-0">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Yarn Library</h2>
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search fibers..." 
                        className="w-full bg-gray-100 border border-gray-200 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none focus:bg-white transition-colors" 
                    />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {displayLibrary.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400">No yarns found.</div>
                    )}
                    {displayLibrary.map((item) => (
                        <div key={item.key} onClick={() => loadFromLibrary(item.def)} className="group p-2 rounded-md hover:bg-white hover:shadow-sm cursor-pointer border border-transparent hover:border-gray-200 transition-all flex items-center gap-3 relative">
                            <div className="w-8 h-8 rounded-full bg-gray-200 relative overflow-hidden shadow-inner shrink-0 border border-gray-300">
                                <div className="absolute inset-0 opacity-90" style={{backgroundColor: item.def.color}}></div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-center">
                                    <div className="text-xs font-bold text-gray-700 group-hover:text-blue-600 truncate">{item.name}</div>
                                    {item.isCustom && (
                                        <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded-sm uppercase font-bold tracking-wider">My</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-400">{item.def.fiberType} • {item.def.construction}</div>
                            </div>
                            {item.isCustom && (
                                <button 
                                    onClick={(e) => handleDeleteFromLibrary(item.id, e)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    title="Delete Preset"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* CENTER: STUDIO STAGE */}
            <div className="flex-1 relative bg-gray-900 flex flex-col min-w-0">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                    <div className="bg-white/90 backdrop-blur shadow-sm rounded-md px-3 py-1.5 border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2">Preview</span>
                        <div className="inline-flex items-center gap-2 font-bold text-gray-800">
                            <span className="w-3 h-3 rounded-full shadow-sm ring-1 ring-black/10" style={{background: yarn.color}}></span>
                            <span className="text-sm">{yarn.fiberType}</span>
                        </div>
                    </div>
                </div>
                
                <div className="absolute top-4 right-4 z-10">
                    <button 
                        onClick={onApply}
                        className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-full px-6 py-2 text-sm font-bold transition-all flex items-center gap-2"
                    >
                        Apply Yarn
                    </button>
                </div>

                <div className="flex-1 relative overflow-hidden cursor-move active:cursor-grabbing" ref={containerRef}>
                    <canvas ref={canvasRef} className="w-full h-full block" />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 backdrop-blur shadow-lg rounded-full p-1.5 border border-gray-200">
                    <button onClick={() => setViewScale(s => Math.max(0.2, s - 0.2))} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100"><ZoomOutIcon className="w-4 h-4"/></button>
                    <span className="text-[10px] font-mono w-10 text-center font-bold text-gray-600">{Math.round(viewScale*100)}%</span>
                    <button onClick={() => setViewScale(s => Math.min(4.0, s + 0.2))} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100"><ZoomInIcon className="w-4 h-4"/></button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button onClick={() => setViewScale(0.2)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100" title="Reset View"><ResetZoomIcon className="w-4 h-4"/></button>
                </div>
            </div>

            {/* RIGHT: THE LABORATORY */}
            <div className="w-80 border-l border-gray-200 flex flex-col bg-white overflow-y-auto custom-scrollbar flex-shrink-0">
                <div className="p-5 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <RulerIcon className="w-4 h-4" /> Technical Specs
                    </h3>
                    
                    <div className="space-y-4 mb-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Yarn Code / Name</label>
                            <input 
                                type="text" 
                                value={yarn.code || ''} 
                                onChange={(e) => handleParamChange('code', e.target.value)}
                                placeholder="e.g. 2/30 Cotton"
                                className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">System</label>
                                <select 
                                    value={yarn.countSystem} 
                                    onChange={(e) => handleParamChange('countSystem', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="Nm">Nm</option>
                                    <option value="Ne">Ne</option>
                                    <option value="Denier">Denier</option>
                                    <option value="Tex">Tex</option>
                                    <option value="Lea">Lea</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Twist</label>
                                <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                                    <button 
                                        onClick={() => handleParamChange('twist', 'S')}
                                        className={`flex-1 py-1 text-xs font-bold ${yarn.twist === 'S' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                    >S</button>
                                    <div className="w-px bg-gray-300"></div>
                                    <button 
                                        onClick={() => handleParamChange('twist', 'Z')}
                                        className={`flex-1 py-1 text-xs font-bold ${yarn.twist === 'Z' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                    >Z</button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Count</label>
                                <input 
                                    type="number" min="1" step="0.1"
                                    value={yarn.count} 
                                    onChange={(e) => handleParamChange('count', parseFloat(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Ply</label>
                                <input 
                                    type="number" min="1" step="1"
                                    value={yarn.ply} 
                                    onChange={(e) => handleParamChange('ply', parseInt(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs pt-3 border-t border-gray-200">
                        <div><span className="text-gray-400 block text-[10px] uppercase">Diameter</span><span className="font-mono font-bold text-gray-500">{specs.diameterMm.toFixed(3)} mm</span></div>
                        <div><span className="text-gray-400 block text-[10px] uppercase">Tex Eq.</span><span className="font-mono font-bold text-gray-500">{specs.tex.toFixed(1)}</span></div>
                    </div>
                </div>

                <div className="p-5">
                    <ControlGroup title="Base Definition" color="text-blue-600">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200">
                                <input type="color" value={yarn.color} onChange={e => handleParamChange('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0" />
                                <div className="flex-1"><span className="text-[10px] font-bold text-gray-400 uppercase block">Main Color</span><span className="text-xs font-mono text-gray-700">{yarn.color}</span></div>
                            </div>

                            {['mouline', 'melange', 'space-dyed', 'grindle'].includes(yarn.model) && (
                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200">
                                    <input type="color" value={yarn.colorB || '#ffffff'} onChange={e => handleParamChange('colorB', e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0" />
                                    <div className="flex-1"><span className="text-[10px] font-bold text-gray-400 uppercase block">Second Color (B)</span><span className="text-xs font-mono text-gray-700">{yarn.colorB}</span></div>
                                </div>
                            )}

                            {yarn.construction === 'tweed' && (
                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200">
                                    <input type="color" value={yarn.colorC || '#000000'} onChange={e => handleParamChange('colorC', e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0" />
                                    <div className="flex-1"><span className="text-[10px] font-bold text-gray-400 uppercase block">Tweed Neps (C)</span><span className="text-xs font-mono text-gray-700">{yarn.colorC}</span></div>
                                </div>
                            )}

                            {(yarn.construction === 'chenille' || yarn.construction === 'boucle') && (
                                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded border border-gray-200">
                                    <input type="color" value={yarn.coreColor || '#888888'} onChange={e => handleParamChange('coreColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0" />
                                    <div className="flex-1"><span className="text-[10px] font-bold text-gray-400 uppercase block">Core Color</span><span className="text-xs font-mono text-gray-700">{yarn.coreColor || '#888888'}</span></div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Model</label>
                                <select 
                                    value={yarn.model} 
                                    onChange={e => handleParamChange('model', e.target.value as YarnModel)}
                                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="simple">Solid</option>
                                    <option value="mouline">Mouline (Twist)</option>
                                    <option value="grindle">Grindle (2-Tone)</option>
                                    <option value="melange">Melange (Mix)</option>
                                    <option value="space-dyed">Space Dyed (Gradient)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Effect</label>
                                <select 
                                    value={yarn.construction} 
                                    onChange={e => handleParamChange('construction', e.target.value as YarnConstruction)}
                                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="standard">Smooth</option>
                                    <option value="slub">Slub</option>
                                    <option value="tweed">Tweed / Nep</option>
                                    <option value="chenille">Chenille</option>
                                    <option value="boucle">Bouclé</option>
                                </select>
                            </div>
                        </div>
                    </ControlGroup>

                    {yarn.construction === 'chenille' && (
                        <ControlGroup title="Chenille Architecture" color="text-blue-400">
                            <Slider label="Core Yarn Thickness" value={yarn.coreThickness ?? 0.4} min={0.1} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('coreThickness', v)} />
                            <Slider label="Pile Length" value={yarn.pileLength ?? 1.0} min={0.5} max={4.0} step={0.1} onChange={(v: number) => handleParamChange('pileLength', v)} subLabel="mm" />
                            <Slider label="Pile Density" value={yarn.pileDensity ?? 0.6} min={0.1} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('pileDensity', v)} />
                            <Slider label="Pile Yarn Thickness" value={yarn.pileThickness ?? 1.0} min={0.5} max={3.0} step={0.1} onChange={(v: number) => handleParamChange('pileThickness', v)} />
                            <Slider label="Directional Uniformity" value={yarn.directionalUniformity ?? 0.2} min={0.0} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('directionalUniformity', v)} />
                        </ControlGroup>
                    )}

                    {yarn.construction === 'boucle' && (
                        <ControlGroup title="Bouclé Architecture" color="text-pink-600">
                            <Slider label="Loop Overfeed Ratio" value={yarn.overfeedRatio ?? 1.5} min={1.0} max={3.0} step={0.1} onChange={(v: number) => handleParamChange('overfeedRatio', v)} subLabel="x core" />
                            <Slider label="Loop Rounding" value={yarn.loopRounding ?? 0.5} min={0.0} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('loopRounding', v)} subLabel="(bulb)" />
                            <Slider label="Loop Scale" value={yarn.loopSize ?? 1.0} min={0.5} max={2.5} step={0.1} onChange={(v: number) => handleParamChange('loopSize', v)} />
                            <Slider label="Loop Frequency" value={yarn.loopInterval ?? 0.5} min={0.1} max={2.0} step={0.1} onChange={(v: number) => handleParamChange('loopInterval', v)} />
                            <Slider label="Twist Amount" value={yarn.twistAmount ?? 200} min={50} max={1000} step={10} onChange={(v: number) => handleParamChange('twistAmount', v)} subLabel="t/m" />
                            <Slider label="Effect Yarn Thickness" value={yarn.pileThickness ?? 0.4} min={0.1} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('pileThickness', v)} />
                            
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                                    <input type="color" value={yarn.loopColor || yarn.color} onChange={e => handleParamChange('loopColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0" />
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">Loop Color</span>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                                    <input type="color" value={yarn.binderColor || '#888888'} onChange={e => handleParamChange('binderColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0" />
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">Binder Color</span>
                                </div>
                            </div>
                        </ControlGroup>
                    )}

                    <ControlGroup title="Spinning & Performance" color="text-emerald-600">
                         <div className="mb-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Fiber Content</label>
                            <select 
                                value={yarn.fiberType}
                                onChange={(e) => handleParamChange('fiberType', e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                            >
                                <option value="Cotton">100% Cotton</option>
                                <option value="Poly-Cotton">Poly-Cotton Blend</option>
                                <option value="Acrylic">100% Acrylic</option>
                                <option value="Silk">100% Silk</option>
                                <option value="Wool">100% Wool</option>
                                <option value="Linen">100% Linen</option>
                                <option value="Synthetic">Synthetic Filament</option>
                                <option value="Lurex">Lurex / Metallic</option>
                            </select>
                        </div>
                        <Slider label="Tensile Strength" value={yarn.strength || 15} min={5} max={50} step={0.5} onChange={(v: number) => handleParamChange('strength', v)} subLabel="cN/tex" />
                        <Slider label="Elongation" value={yarn.elongation || 5} min={1} max={30} step={0.1} onChange={(v: number) => handleParamChange('elongation', v)} subLabel="%" />
                        <Slider label="Imperfection (IPI)" value={yarn.ipi || 50} min={0} max={1000} step={10} onChange={(v: number) => handleParamChange('ipi', v)} />
                    </ControlGroup>

                    <ControlGroup title="Surface & Lighting" color="text-purple-600">
                        <Slider label="Visual Width" value={yarn.thickness} min={0.3} max={2.5} step={0.05} onChange={(v: number) => handleParamChange('thickness', v)} subLabel="(Cover)" />
                        <Slider label="Shadow Depth" value={yarn.shadowStrength ?? 0.20} min={0} max={1.0} step={0.1} onChange={(v: number) => handleParamChange('shadowStrength', v)} />
                        <Slider label="Overlap and Spread" value={yarn.extraOverlap ?? 0} min={0} max={1.0} step={0.05} onChange={(v: number) => handleParamChange('extraOverlap', v)} />
                        <Slider label="Unevenness" value={yarn.unevenness || 0} min={0} max={1} step={0.05} onChange={(v: number) => handleParamChange('unevenness', v)} />
                        <Slider label="Twist (TPI)" value={yarn.tpi} min={0} max={40} step={0.5} onChange={(v: number) => handleParamChange('tpi', v)} />
                        <Slider label="Sheen" value={yarn.sheen} min={0} max={1} step={0.1} onChange={(v: number) => handleParamChange('sheen', v)} />
                        <Slider label="Roughness (Micro)" value={yarn.roughness} min={0} max={1} step={0.1} onChange={(v: number) => handleParamChange('roughness', v)} />
                    </ControlGroup>

                    {yarn.model === 'space-dyed' && (
                        <ControlGroup title="Space Dye Gradient" color="text-teal-600">
                            <Slider label="Cycle Length" value={yarn.spaceDyeLength || 10} min={1} max={50} step={1} onChange={(v: number) => handleParamChange('spaceDyeLength', v)} subLabel="(cm)" />
                        </ControlGroup>
                    )}

                    <ControlGroup title="Fibers & Hairs" color="text-amber-600">
                        <Slider label="Hair Density" value={yarn.hairiness || 0} min={0} max={1.0} step={0.1} onChange={(v: number) => handleParamChange('hairiness', v)} />
                        <Slider label="Hair Length" value={yarn.hairLength || 0} min={0} max={1.0} step={0.1} onChange={(v: number) => handleParamChange('hairLength', v)} />
                        <Slider label="Hair Thickness" value={yarn.hairThickness || 1} min={1} max={5} step={0.5} onChange={(v: number) => handleParamChange('hairThickness', v)} subLabel="(px)" />
                    </ControlGroup>

                    <ControlGroup title="Digital Slub Engine" color="text-pink-600">
                        <div className="bg-pink-50 p-2 rounded border border-pink-100 mb-4">
                            <label className="text-[10px] font-bold text-pink-500 uppercase block mb-2">Periodicity</label>
                            <div className="flex bg-white rounded border border-pink-200 p-0.5">
                                <button 
                                    onClick={() => handleParamChange('slubMode', 'periodic')}
                                    className={`flex-1 py-1 text-[10px] font-bold uppercase rounded ${yarn.slubMode !== 'random' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'}`}
                                >
                                    Periodic
                                </button>
                                <button 
                                    onClick={() => handleParamChange('slubMode', 'random')}
                                    className={`flex-1 py-1 text-[10px] font-bold uppercase rounded flex items-center justify-center gap-1 ${yarn.slubMode === 'random' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'}`}
                                >
                                    <ShuffleIcon className="w-3 h-3" /> Random
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    <span>Slub Length (CM)</span>
                                    <span className="text-gray-900">{yarn.slubLength || 0} cm</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="range" min="0" max="20" step="0.1" value={yarn.slubLength || 0} onChange={e => handleParamChange('slubLength', parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600" />
                                    <input type="number" min="0" max="50" step="0.1" value={yarn.slubLength || 0} onChange={e => handleParamChange('slubLength', parseFloat(e.target.value))} className="w-12 border border-gray-300 rounded p-1 text-[10px] text-center" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    <span>Distance (CM)</span>
                                    <span className="text-gray-900">{yarn.slubDistance || 0} cm</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="range" min="0.5" max="100" step="0.5" value={yarn.slubDistance || 0} onChange={e => handleParamChange('slubDistance', parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600" />
                                    <input type="number" min="0" max="200" step="0.5" value={yarn.slubDistance || 0} onChange={e => handleParamChange('slubDistance', parseFloat(e.target.value))} className="w-12 border border-gray-300 rounded p-1 text-[10px] text-center" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    <span>Amplitude (%)</span>
                                    <span className="text-gray-900">{yarn.slubAmplitude || 0} %</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="range" min="0" max="300" step="10" value={yarn.slubAmplitude || 0} onChange={e => handleParamChange('slubAmplitude', parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600" />
                                    <input type="number" min="0" max="500" step="10" value={yarn.slubAmplitude || 0} onChange={e => handleParamChange('slubAmplitude', parseFloat(e.target.value))} className="w-12 border border-gray-300 rounded p-1 text-[10px] text-center" />
                                </div>
                            </div>
                        </div>
                        
                        {(yarn.slubAmplitude || 0) > 0 && (
                            <div className="flex items-center gap-3 mt-4 pt-2 border-t border-pink-50">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Slub Color</label>
                                <input type="color" value={yarn.slubColor || yarn.color} onChange={e => handleParamChange('slubColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0" />
                            </div>
                        )}
                    </ControlGroup>

                    <div className="pt-6 mt-6 border-t border-gray-100">
                        <button 
                            onClick={handleSaveToLibrary}
                            className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Save Yarn
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};