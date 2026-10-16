import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShadeCard, ShadeColor } from '../types';
import { OFFICIAL_PANTONE_TPX } from '../services/pantoneColors';
import { StorageService } from '../services/io/storage';
import { PlusIcon, TrashIcon, GridIcon, ListIcon, UploadIcon, CheckIcon } from './icons';

interface ColorLibraryTabProps {
    onSelectColor: (hex: string) => void;
    activeHex: string;
}

export const ColorLibraryTab: React.FC<ColorLibraryTabProps> = ({ onSelectColor, activeHex }) => {
    const [libraries, setLibraries] = useState<ShadeCard[]>([]);
    const [activeLibId, setActiveLibId] = useState<string>(OFFICIAL_PANTONE_TPX.id);
    const [viewMode, setViewMode] = useState<'swatch' | 'list'>('swatch');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadLibraries();
    }, []);

    const loadLibraries = async () => {
        const stored = await StorageService.getAllPalettes();
        setLibraries([OFFICIAL_PANTONE_TPX, ...stored]);
    };

    const activeLib = useMemo(() => 
        libraries.find(l => l.id === activeLibId) || OFFICIAL_PANTONE_TPX, 
    [libraries, activeLibId]);

    const filteredColors = useMemo(() => {
        if (!searchQuery.trim()) return activeLib.colors;
        const q = searchQuery.toLowerCase();
        return activeLib.colors.filter(c => 
            c.code.toLowerCase().includes(q) || 
            (c.name && c.name.toLowerCase().includes(q)) ||
            c.hex.toLowerCase().includes(q)
        );
    }, [activeLib, searchQuery]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const rows = text.split(/\r?\n/).filter(row => row.trim());
            const newColors: ShadeColor[] = [];

            // Skip header if it looks like one
            const startIdx = rows[0].toLowerCase().includes('serial') ? 1 : 0;

            for (let i = startIdx; i < rows.length; i++) {
                const parts = rows[i].split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    newColors.push({
                        serial: parts[0],
                        name: parts[1],
                        code: parts[2],
                        hex: parts[2].startsWith('#') ? parts[2] : `#${parts[2]}`, // Basic fixup
                        rgb: parts[3] || '',
                        cmyk: parts[4] || ''
                    });
                }
            }

            if (newColors.length > 0) {
                const paletteName = file.name.replace(/\.[^/.]+$/, "");
                const newCard: ShadeCard = {
                    id: `upload-${Date.now()}`,
                    name: paletteName,
                    colors: newColors
                };
                await StorageService.savePalette(newCard);
                loadLibraries();
                setActiveLibId(newCard.id);
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteLibrary = async (id: string) => {
        if (id === OFFICIAL_PANTONE_TPX.id) return;
        if (confirm("Delete this palette library?")) {
            await StorageService.deletePalette(id);
            loadLibraries();
            setActiveLibId(OFFICIAL_PANTONE_TPX.id);
        }
    };

    const handleDragStart = (e: React.DragEvent, color: ShadeColor) => {
        e.dataTransfer.setData('color-hex', color.hex);
        e.dataTransfer.setData('color-code', color.code);
        e.dataTransfer.setData('color-name', color.name || '');
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">Color Libraries</h2>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                        <button 
                            onClick={() => setViewMode('swatch')} 
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'swatch' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                            title="Grid View"
                        >
                            <GridIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                            title="List View"
                        >
                            <ListIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <select 
                        value={activeLibId} 
                        onChange={e => setActiveLibId(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                    >
                        {libraries.map(lib => (
                            <option key={lib.id} value={lib.id}>{lib.name}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                        title="Upload CSV Palette (Serial, Name, Code, RGB, CMYK)"
                    >
                        <UploadIcon className="w-4 h-4" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                    {activeLibId !== OFFICIAL_PANTONE_TPX.id && (
                        <button 
                            onClick={() => handleDeleteLibrary(activeLibId)}
                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <input 
                    type="text" 
                    placeholder="Search colors..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {viewMode === 'swatch' ? (
                    <div className="grid grid-cols-6 gap-2">
                        {filteredColors.map((c, i) => (
                            <div 
                                key={`${activeLibId}-${i}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, c)}
                                onClick={() => onSelectColor(c.hex)}
                                className={`aspect-square rounded-md cursor-grab active:cursor-grabbing border-2 transition-all relative group shadow-sm ${activeHex === c.hex ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100 hover:border-blue-300'}`}
                                style={{ backgroundColor: c.hex }}
                                title={`${c.code}: ${c.name || 'Unnamed'}`}
                            >
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"></div>
                                {activeHex === c.hex && <div className="absolute inset-0 flex items-center justify-center"><CheckIcon className="w-3 h-3 text-white drop-shadow-md" /></div>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-[30px_1fr_60px] gap-2 px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 rounded mb-1">
                            <span>S#</span>
                            <span>Color</span>
                            <span className="text-right">Hex</span>
                        </div>
                        {filteredColors.map((c, i) => (
                            <div 
                                key={`${activeLibId}-${i}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, c)}
                                onClick={() => onSelectColor(c.hex)}
                                className={`grid grid-cols-[30px_1fr_60px] gap-2 items-center p-2 rounded-lg cursor-grab active:cursor-grabbing border transition-all ${activeHex === c.hex ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                            >
                                <span className="text-[10px] font-mono text-gray-400">{c.serial || i + 1}</span>
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 h-4 rounded-sm shadow-inner shrink-0 border border-black/5" style={{ backgroundColor: c.hex }}></div>
                                    <div className="min-w-0 flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-800 truncate leading-tight">{c.name || 'Unnamed'}</span>
                                        <span className="text-[9px] text-gray-500 font-mono tracking-tighter">{c.code}</span>
                                    </div>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400 text-right uppercase">{c.hex}</span>
                                
                                {c.rgb && (
                                    <div className="col-span-3 mt-1 flex gap-4 text-[8px] font-mono text-gray-400 border-t border-gray-100 pt-1">
                                        <span>RGB: {c.rgb}</span>
                                        {c.cmyk && <span>CMYK: {c.cmyk}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {filteredColors.length === 0 && (
                    <div className="py-20 text-center text-gray-300 text-xs font-bold uppercase tracking-widest italic opacity-50">No Matches</div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 shrink-0">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Industrial Workflow</p>
                    <p className="text-[9px] text-blue-400 leading-relaxed italic">Drag colors from this library directly onto Warp/Weft chips or the Colorway Studio palette to remap yarns.</p>
                </div>
            </div>
        </div>
    );
};