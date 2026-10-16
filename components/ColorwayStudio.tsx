import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Colorway, YarnDefinition, WeavePattern } from '../types';
import { renderFabricToCanvas } from '../services/fabricRenderer';
import { PlusIcon, TrashIcon, CheckIcon, ShuffleIcon, GridIcon, PencilIcon, LayersIcon, ChevronDownIcon } from './icons';
import { PANTONE_PALETTE } from '../services/pantoneColors';
import { ColorPickerModal } from './ColorPickerModal';

interface ColorwayStudioProps {
    initialWarpYarns: { [key: string]: YarnDefinition };
    initialWeftYarns: { [key: string]: YarnDefinition };
    warpPatternString: string;
    weftPatternString: string;
    dentingPlan: number[];
    epi: number;
    ppi: number;
    weavePattern: WeavePattern;
    colorways: Colorway[];
    onColorwaysChange: (colorways: Colorway[]) => void;
    onApplyColorway: (warp: { [key: string]: YarnDefinition }, weft: { [key: string]: YarnDefinition }) => void;
    expandPatternString: (s: string) => string[];
}

const MAX_COLORWAYS = 8;
const DPI_OPTIONS = [72, 96, 144, 192, 300];

const PaletteButton: React.FC<{ 
    id: string, 
    color: string, 
    onClick: () => void, 
    onDropColor: (hex: string) => void,
    borderColor: string 
}> = ({ id, color, onClick, onDropColor, borderColor }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    return (
        <button
            onClick={onClick}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const hex = e.dataTransfer.getData('color-hex'); if(hex) onDropColor(hex); }}
            className={`w-12 h-12 rounded-xl border-2 transition-all shadow-xl relative group overflow-hidden ${isDragOver ? 'scale-110 ring-4 ring-blue-500 z-10' : borderColor}`}
            style={{ backgroundColor: color }}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-white opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">{id}</span>
        </button>
    );
};

export const ColorwayStudio: React.FC<ColorwayStudioProps> = ({
    initialWarpYarns, initialWeftYarns,
    warpPatternString, weftPatternString, dentingPlan,
    epi, ppi, weavePattern,
    colorways, onColorwaysChange, onApplyColorway,
    expandPatternString
}) => {
    const [viewMode, setViewMode] = useState<'editor' | 'together'>('together');
    const [currentWarp, setCurrentWarp] = useState(initialWarpYarns);
    const [currentWeft, setCurrentWeft] = useState(initialWeftYarns);
    const [activeColorwayId, setactiveColorwayId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [renderingDpi, setRenderingDpi] = useState(96);
    
    // Color Picker State
    const [pickerState, setPickerState] = useState<{type: 'warp'|'weft', id: string, color: string} | null>(null);

    // Initial Load
    useEffect(() => {
        if (colorways.length === 0) {
            const original: Colorway = {
                id: 'original',
                name: 'Colorway 1',
                warpYarns: { ...initialWarpYarns },
                weftYarns: { ...initialWeftYarns }
            };
            original.thumbnail = generateThumbnail(original.warpYarns, original.weftYarns, renderingDpi);
            onColorwaysChange([original]);
            setactiveColorwayId('original');
        }
    }, []);

    // Helper to generate a thumbnail
    const generateThumbnail = (warp: Record<string, YarnDefinition>, weft: Record<string, YarnDefinition>, dpi: number) => {
        const canvas = renderFabricToCanvas({
            weavePattern: weavePattern.pattern,
            structure: weavePattern.structure,
            epi, ppi, dentingPlan,
            warpYarns: warp,
            weftYarns: weft,
            warpYarnSequence: expandPatternString(warpPatternString),
            weftYarnSequence: expandPatternString(weftPatternString),
            viewSide: 'face',
            dpi: dpi, 
            width: 800,
            height: 600
        });
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    // When DPI changes, refresh all colorway thumbnails
    useEffect(() => {
        if (colorways.length > 0) {
            const updated = colorways.map(cw => ({
                ...cw,
                thumbnail: generateThumbnail(cw.warpYarns, cw.weftYarns, renderingDpi)
            }));
            onColorwaysChange(updated);
        }
    }, [renderingDpi]);

    // Main Edit Preview
    useEffect(() => {
        const render = () => {
            const url = generateThumbnail(currentWarp, currentWeft, renderingDpi);
            setPreviewUrl(url);
        };
        const t = setTimeout(render, 100);
        return () => clearTimeout(t);
    }, [currentWarp, currentWeft, weavePattern, epi, ppi, dentingPlan, warpPatternString, weftPatternString, renderingDpi]);

    const handleColorChange = (type: 'warp' | 'weft', id: string, color: string) => {
        const nextWarp = type === 'warp' ? { ...currentWarp, [id]: { ...currentWarp[id], color } } : currentWarp;
        const nextWeft = type === 'weft' ? { ...currentWeft, [id]: { ...currentWeft[id], color } } : currentWeft;
        
        setCurrentWarp(nextWarp);
        setCurrentWeft(nextWeft);

        if (activeColorwayId) {
            const updated = colorways.map(cw => {
                if (cw.id === activeColorwayId) {
                    return { 
                        ...cw, 
                        warpYarns: nextWarp, 
                        weftYarns: nextWeft, 
                        thumbnail: generateThumbnail(nextWarp, nextWeft, renderingDpi) 
                    };
                }
                return cw;
            });
            onColorwaysChange(updated);
        }
    };

    const updateColorway = (id: string, updates: Partial<Colorway>) => {
        const updated = colorways.map(cw => (cw.id === id ? { ...cw, ...updates } : cw));
        onColorwaysChange(updated);
    };

    const handleSaveAsNew = () => {
        if (colorways.length >= MAX_COLORWAYS) {
            alert(`Maximum of ${MAX_COLORWAYS} colorways reached.`);
            return;
        }
        const id = `cw-${Date.now()}`;
        const newWay: Colorway = {
            id,
            name: `Colorway ${colorways.length + 1}`,
            warpYarns: { ...currentWarp },
            weftYarns: { ...currentWeft },
            thumbnail: previewUrl
        };
        onColorwaysChange([...colorways, newWay]);
        setactiveColorwayId(id);
    };

    const handleLoadColorway = (cw: Colorway) => {
        setCurrentWarp(cw.warpYarns);
        setCurrentWeft(cw.weftYarns);
        setactiveColorwayId(cw.id);
        setViewMode('editor');
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (colorways.length <= 1) return;
        const newWays = colorways.filter(c => c.id !== id);
        onColorwaysChange(newWays);
        if (activeColorwayId === id) {
            handleLoadColorway(newWays[0]);
            setViewMode('together');
        }
    };

    const handleShuffle = () => {
        const shuffleYarns = (yarns: { [key: string]: YarnDefinition }) => {
            const newYarns = { ...yarns };
            Object.keys(newYarns).forEach(k => {
                newYarns[k] = { 
                    ...newYarns[k], 
                    color: PANTONE_PALETTE[Math.floor(Math.random() * PANTONE_PALETTE.length)] 
                };
            });
            return newYarns;
        };
        const sWarp = shuffleYarns(currentWarp);
        const sWeft = shuffleYarns(currentWeft);
        setCurrentWarp(sWarp);
        setCurrentWeft(sWeft);
        if (activeColorwayId) {
            const updated = colorways.map(cw => cw.id === activeColorwayId ? { ...cw, warpYarns: sWarp, weftYarns: sWeft, thumbnail: generateThumbnail(sWarp, sWeft, renderingDpi) } : cw);
            onColorwaysChange(updated);
        }
    };

    // Grid Layout Calculation
    const gridConfig = useMemo(() => {
        const count = colorways.length;
        if (count <= 1) return 'grid-cols-1 grid-rows-1';
        if (count === 2) return 'grid-cols-2 grid-rows-1';
        if (count === 3) return 'grid-cols-3 grid-rows-1';
        if (count === 4) return 'grid-cols-2 grid-rows-2';
        if (count <= 6) return 'grid-cols-3 grid-rows-2';
        return 'grid-cols-4 grid-rows-2';
    }, [colorways.length]);

    return (
        <div className="flex flex-col h-full bg-black text-white overflow-hidden font-sans">
            {/* STUDIO HEADER */}
            <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-50 shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] leading-none mb-1">Textile Lab</span>
                        <h2 className="text-sm font-bold text-white uppercase tracking-tight">Colorway Collection</h2>
                    </div>
                    
                    <div className="h-8 w-px bg-gray-800"></div>

                    <div className="flex bg-black/40 rounded-xl p-1 border border-gray-800">
                        <button 
                            onClick={() => setViewMode('together')} 
                            className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center gap-2 transition-all ${viewMode === 'together' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <GridIcon className="w-3.5 h-3.5" /> Together
                        </button>
                        <button 
                            onClick={() => setViewMode('editor')} 
                            className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center gap-2 transition-all ${viewMode === 'editor' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <PencilIcon className="w-3.5 h-3.5" /> Focus Edit
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-gray-800 ml-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Resolution</span>
                        <div className="relative">
                            <select 
                                value={renderingDpi}
                                onChange={(e) => setRenderingDpi(parseInt(e.target.value))}
                                className="bg-gray-800 border-none rounded text-[10px] font-bold py-1 px-2 pr-6 appearance-none focus:ring-0 outline-none cursor-pointer"
                            >
                                {DPI_OPTIONS.map(dpi => (
                                    <option key={dpi} value={dpi}>{dpi} DPI</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-500 mr-2">{colorways.length} / {MAX_COLORWAYS} Slots</span>
                    <button 
                        onClick={handleSaveAsNew}
                        disabled={colorways.length >= MAX_COLORWAYS}
                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-[10px] font-black uppercase py-2 px-5 rounded-full border border-gray-700 transition-all flex items-center gap-2"
                    >
                        <PlusIcon className="w-3.5 h-3.5" /> New Colorway
                    </button>
                    <button 
                        onClick={() => onApplyColorway(currentWarp, currentWeft)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black uppercase py-2 px-6 rounded-full shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <CheckIcon className="w-3.5 h-3.5" /> Commit
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'editor' ? (
                    <div className="flex flex-col h-full bg-gray-950">
                        {/* EDITOR STAGE */}
                        <div className="flex-1 relative flex items-center justify-center p-6 min-h-0">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent opacity-40"></div>
                            {previewUrl ? (
                                <div className="relative group max-w-full h-full flex items-center justify-center">
                                    <img src={previewUrl} className="max-w-full max-h-full shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-xl border border-white/5 object-contain" />
                                    <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-white/20 pointer-events-none"></div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-gray-600 font-bold uppercase tracking-widest animate-pulse">Rendering...</div>
                            )}
                            
                            <div className="absolute top-6 left-6 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Editing Colorway</span>
                                <input 
                                    type="text" 
                                    value={colorways.find(c => c.id === activeColorwayId)?.name || 'Custom'}
                                    onChange={(e) => activeColorwayId && updateColorway(activeColorwayId, { name: e.target.value })}
                                    className="bg-transparent border-none text-2xl font-black tracking-tight text-white focus:outline-none focus:text-blue-400 w-64"
                                />
                            </div>

                            <button onClick={handleShuffle} className="absolute bottom-6 right-6 p-4 bg-gray-800/80 backdrop-blur hover:bg-blue-600 rounded-full transition-all text-white shadow-2xl" title="Shuffle Lab Colors">
                                <ShuffleIcon className="w-6 h-6"/>
                            </button>
                        </div>

                        {/* EDITOR PALETTES - Compacted and constrained to prevent overflow */}
                        <div className="h-32 bg-gray-900/50 backdrop-blur-xl border-t border-white/5 flex items-center px-12 gap-16 shrink-0 overflow-hidden">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Warp Registry</span>
                                <div className="flex gap-2">
                                    {Object.keys(currentWarp).sort().map(id => (
                                        <PaletteButton
                                            key={id}
                                            id={id}
                                            color={currentWarp[id].color}
                                            onClick={() => setPickerState({ type: 'warp', id, color: currentWarp[id].color })}
                                            onDropColor={(hex) => handleColorChange('warp', id, hex)}
                                            borderColor="border-white/10 hover:border-blue-500"
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="w-px h-12 bg-white/10"></div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Weft Registry</span>
                                <div className="flex gap-2">
                                    {Object.keys(currentWeft).sort().map(id => (
                                        <PaletteButton
                                            key={id}
                                            id={id}
                                            color={currentWeft[id].color}
                                            onClick={() => setPickerState({ type: 'weft', id, color: currentWeft[id].color })}
                                            onDropColor={(hex) => handleColorChange('weft', id, hex)}
                                            borderColor="border-white/10 hover:border-orange-500"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* DYNAMIC TOGETHER COMPARISON VIEW */
                    <div className={`h-full w-full grid ${gridConfig} bg-black`}>
                        {colorways.map((cw, idx) => {
                            const isActive = cw.id === activeColorwayId;
                            return (
                                <div 
                                    key={cw.id} 
                                    onClick={() => handleLoadColorway(cw)}
                                    className={`relative group cursor-pointer border-r border-b border-white/5 overflow-hidden flex items-center justify-center transition-all ${isActive ? 'ring-inset ring-2 ring-blue-500 z-10' : 'hover:bg-white/5'}`}
                                >
                                    {cw.thumbnail ? (
                                        <img src={cw.thumbnail} className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110" />
                                    ) : (
                                        <div className="flex items-center gap-3 text-white/20 font-bold uppercase tracking-widest text-[10px]">Generating...</div>
                                    )}
                                    
                                    {/* Swatch Label Overlay */}
                                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                                        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-2xl">
                                            <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">#{idx + 1}</div>
                                            <div className="text-xs font-bold text-white tracking-tight">{cw.name}</div>
                                        </div>
                                        <div className="flex gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
                                            {Object.keys(cw.warpYarns).slice(0, 3).map(id => (
                                                <div key={id} className="w-3 h-3 rounded-full border border-white/20" style={{backgroundColor: cw.warpYarns[id].color}}></div>
                                            ))}
                                            <div className="w-px h-3 bg-white/20 mx-0.5"></div>
                                            {Object.keys(cw.weftYarns).slice(0, 3).map(id => (
                                                <div key={id} className="w-3 h-3 rounded-full border border-white/20" style={{backgroundColor: cw.weftYarns[id].color}}></div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions Overlay */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button 
                                            onClick={(e) => handleDelete(e, cw.id)}
                                            className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors pointer-events-auto"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    {isActive && (
                                        <div className="absolute top-4 left-4 bg-blue-600 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-lg ring-1 ring-white/20">
                                            Selected
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {/* Empty Slots */}
                        {Array.from({ length: Math.max(0, (colorways.length < 4 ? colorways.length : (colorways.length <= 6 ? 6 : 8)) - colorways.length) }).map((_, i) => (
                            <button 
                                key={`empty-${i}`}
                                onClick={handleSaveAsNew}
                                className="group relative border-r border-b border-white/5 flex flex-col items-center justify-center gap-3 text-white/10 hover:text-white/30 transition-colors"
                            >
                                <PlusIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Available Slot</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ColorPickerModal 
                isOpen={!!pickerState}
                onClose={() => setPickerState(null)}
                currentColor={pickerState?.color || '#000000'}
                onSelect={(color) => {
                    if (pickerState) handleColorChange(pickerState.type, pickerState.id, color);
                }}
                title={`Edit ${pickerState?.type === 'warp' ? 'Warp' : 'Weft'} : ${pickerState?.id}`}
            />
        </div>
    );
};