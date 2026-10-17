import React, { useState, useEffect, useMemo } from 'react';
import { OFFICIAL_PANTONE_TPX } from '../services/pantoneColors';
import { StorageService } from '../services/io/storage';
import { ShadeCard, ShadeColor } from '../types';
import { askText } from '../services/ui/dialogs';
import { PlusIcon, TrashIcon, PaletteIcon, ListIcon, MagicWandIcon } from './icons';

interface ColorPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (color: string) => void;
    currentColor: string;
    title?: string;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
    isOpen, onClose, onSelect, currentColor, title = "Color Library"
}) => {
    const [allCards, setAllCards] = useState<ShadeCard[]>([]);
    const [activeCardId, setActiveCardId] = useState<string>(OFFICIAL_PANTONE_TPX.id);
    const [searchQuery, setSearchQuery] = useState('');
    const [customColor, setCustomColor] = useState(currentColor);
    const [viewMode, setViewMode] = useState<'chart' | 'custom'>('chart');

    useEffect(() => {
        if (isOpen) {
            loadLibraries();
            setCustomColor(currentColor);
        }
    }, [isOpen, currentColor]);

    const loadLibraries = async () => {
        const userCards = await StorageService.getAllPalettes();
        setAllCards([OFFICIAL_PANTONE_TPX, ...userCards]);
    };

    const activeCard = useMemo(() => 
        allCards.find(c => c.id === activeCardId) || OFFICIAL_PANTONE_TPX,
    [allCards, activeCardId]);

    const filteredColors = useMemo(() => {
        if (!searchQuery.trim()) return activeCard.colors;
        const q = searchQuery.toLowerCase();
        return activeCard.colors.filter(c => 
            c.code.toLowerCase().includes(q) || 
            (c.name && c.name.toLowerCase().includes(q)) ||
            c.hex.toLowerCase().includes(q)
        );
    }, [activeCard, searchQuery]);

    const handleCreatePalette = async () => {
        const name = await askText("New shade card", "", { label: "Shade card name", confirmLabel: "Create" });
        if (!name) return;
        const newCard: ShadeCard = {
            id: `user-card-${Date.now()}`,
            name,
            colors: [],
            isLocked: false
        };
        await StorageService.savePalette(newCard);
        loadLibraries();
        setActiveCardId(newCard.id);
    };

    const handleAddColorToActive = async () => {
        if (activeCard.isLocked) return;
        const nextCard = { ...activeCard, colors: [...activeCard.colors, { hex: customColor, code: 'NEW', name: 'User Swatch' }] };
        await StorageService.savePalette(nextCard);
        loadLibraries();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden font-sans text-gray-900" onClick={e => e.stopPropagation()}>
                
                {/* SIDEBAR: LIBRARY SELECTOR */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Your Libraries</h3>
                        <button 
                            onClick={handleCreatePalette}
                            className="w-full py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4" /> New Shade Card
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {allCards.map(card => (
                            <button
                                key={card.id}
                                onClick={() => setActiveCardId(card.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 border ${activeCardId === card.id ? 'bg-white border-blue-200 shadow-sm ring-2 ring-blue-500/10' : 'border-transparent hover:bg-white hover:border-gray-200'}`}
                            >
                                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: card.colors[0]?.hex || '#ddd' }}></div>
                                <div className="min-w-0">
                                    <div className={`text-xs font-bold truncate ${activeCardId === card.id ? 'text-blue-600' : 'text-gray-700'}`}>{card.name}</div>
                                    <div className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">{card.colors.length} Swatches</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="p-4 border-t border-gray-200 text-center">
                         <button onClick={() => setViewMode(viewMode === 'chart' ? 'custom' : 'chart')} className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest flex items-center justify-center gap-2 w-full">
                            <PaletteIcon className="w-3.5 h-3.5" /> {viewMode === 'chart' ? 'Open Mixer' : 'Back to Library'}
                         </button>
                    </div>
                </div>

                {/* MAIN AREA */}
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10 shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 tracking-tight">{activeCard.name}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{activeCard.brand || 'WonderWeaves'} Catalog</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search code or name..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-xs w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50">
                        {viewMode === 'chart' ? (
                            filteredColors.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                    {filteredColors.map((color, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { onSelect(color.hex); onClose(); }}
                                            className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-xl transition-all transform hover:scale-[1.02] relative"
                                        >
                                            <div className="h-20 w-full relative" style={{ backgroundColor: color.hex }}>
                                                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
                                                {currentColor.toLowerCase() === color.hex.toLowerCase() && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                                                        <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-2 text-left">
                                                <div className="text-[10px] font-black font-mono text-gray-800 leading-tight uppercase truncate">{color.code}</div>
                                                <div className="text-[9px] text-gray-400 font-medium truncate mt-0.5">{color.name || 'Untitled'}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><ListIcon className="w-8 h-8"/></div>
                                    <p className="font-bold text-sm">No swatches found matching your query.</p>
                                </div>
                            )
                        ) : (
                            <div className="max-w-2xl mx-auto py-10 space-y-12 animate-in slide-in-from-bottom-4 duration-300">
                                <div className="flex flex-col md:flex-row gap-10 items-center">
                                    <div className="w-48 h-48 rounded-3xl shadow-2xl ring-8 ring-white shrink-0 border border-gray-100 overflow-hidden relative group">
                                        <div className="w-full h-full transition-transform duration-500 group-hover:scale-110" style={{backgroundColor: customColor}}></div>
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-3 text-center">
                                            <span className="text-white font-mono font-bold text-sm tracking-widest">{customColor.toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-6 w-full">
                                        <div>
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2">Visual Mixer</label>
                                            <input 
                                                type="color" 
                                                value={customColor} 
                                                onChange={e => setCustomColor(e.target.value)}
                                                className="w-full h-12 rounded-xl border-4 border-gray-100 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2">Hexadecimal Reference</label>
                                            <input 
                                                type="text" 
                                                value={customColor} 
                                                onChange={e => setCustomColor(e.target.value)}
                                                className="w-full bg-gray-100 border border-gray-200 p-4 rounded-xl font-mono font-bold text-lg text-center tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all uppercase shadow-inner"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 pt-6 border-t border-gray-100">
                                    <button 
                                        onClick={() => { onSelect(customColor); onClose(); }}
                                        className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold tracking-wide hover:bg-black shadow-xl transition-all active:scale-95"
                                    >
                                        Apply Current Color
                                    </button>
                                    {!activeCard.isLocked && (
                                        <button 
                                            onClick={handleAddColorToActive}
                                            className="px-6 py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-3 whitespace-nowrap"
                                        >
                                            <PlusIcon className="w-5 h-5" /> Add to {activeCard.name}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};