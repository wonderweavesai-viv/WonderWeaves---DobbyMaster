import React, { useState, useEffect } from 'react';
import { WeaveSettings, WeaveInput, YarnDefinition } from '../types';
import { LayersIcon, ListIcon, PaletteIcon, GridFillIcon, GridIcon, PencilIcon, TrashIcon, PlusIcon, FlipIcon, CopyIcon, ArrowDownIcon, TableIcon, CheckIcon, MagicWandIcon } from './icons';
import { WEAVE_LIBRARY, LibraryWeave } from '../services/weaveLibrary';
import { TextPatternEditor } from './TextPatternEditor';
import { AiControl } from './AiControl';
import { WeaveThumbnail } from './WeaveThumbnail';
import { YarnDesignerModal } from './YarnDesignerModal';
import { WeaveEditorModal } from './WeaveEditorModal';
import { getTotalThreads } from '../utils/patternParser';
import { ColorLibraryTab } from './ColorLibraryTab';

interface RightPanelProps {
    settings: WeaveSettings;
    onSettingsChange: (newSettings: WeaveSettings) => void;
    dentingPattern: string;
    onDentingChange: (val: string) => void;
    onSnapshot: () => void;
    onLoadWeave: (weave: LibraryWeave) => void;
    customWeaves: LibraryWeave[];
    onAddWeave: (weave: LibraryWeave) => void;
    onUpdateWeave: (weave: LibraryWeave) => void;
    onDeleteWeave: (id: string) => void;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    onUpdateWarpYarn: (char: string, def: YarnDefinition) => void;
    onUpdateWeftYarn: (char: string, def: YarnDefinition) => void;
    onUpdateAllYarns?: (type: 'warp' | 'weft', yarns: { [key: string]: YarnDefinition }) => void;
    paletteColors: string[];
    warpPatternString: string;
    setWarpPatternString: (val: string) => void;
    weftPatternString: string;
    setWeftPatternString: (val: string) => void;
    onOpenGridEditor: (type: 'warp' | 'weft') => void;
    onOpenPatternGenerator: (type: 'warp' | 'weft') => void;
    currentInput: WeaveInput;
    onApplyGenerated: (data: any) => void;
    onSimulate: () => void;
    selectedColorIndex?: number;
    onSelectColor?: (index: number) => void;
    onOpenDraftStudio: () => void;
    onOpenPegPlanStudio: () => void;
    activeYarnId?: string;
    selectedYarnType?: 'warp' | 'weft'; 
    onSelectYarn?: (id: string, type: 'warp' | 'weft') => void; 
    onActiveYarnChange?: (char: string) => void; 
    forcedTab?: TabType; 
    onSyncGridDimensions?: (warpLen: number, weftLen: number) => void; 
    isWeftScaled?: boolean;
    onToggleWeftScale?: () => void;
    isWarpScaled?: boolean;
    onToggleWarpScale?: () => void;
    onDropWeaveOnYarn?: (weaveId: string, yarnId: string, type: 'warp' | 'weft') => void;
    onDesignYarn?: (id: string, type: 'warp' | 'weft') => void;
}

type TabType = 'construction' | 'pattern' | 'weave' | 'yarns' | 'colors';

const TabButton: React.FC<{ id: TabType, activeTab: TabType, icon: React.ReactNode, label: string, onClick: (id: TabType) => void }> = ({ id, activeTab, icon, label, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'}`}
    >
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

const SliderInput: React.FC<{
    label: string; value: number; onChange?: (value: number) => void; min?: number; max?: number; step?: number; subLabel?: string; disabled?: boolean; onPointerDown?: () => void;
}> = ({ label, value, onChange, min, max, step, subLabel, disabled, onPointerDown }) => (
    <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {label} {subLabel && <span className="text-gray-400 normal-case ml-1">({subLabel})</span>}
            </label>
            <input 
                type="number"
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && onChange) onChange(v);
                }}
                className={`w-16 text-xs font-bold font-mono text-right bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 focus:border-blue-500 focus:outline-none transition-colors ${disabled ? 'text-gray-400' : 'text-blue-600'}`}
            />
        </div>
        {disabled ? (
            <div className="w-full h-1 bg-gray-200 rounded-lg opacity-50"></div>
        ) : (
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange && onChange(parseInt(e.target.value, 10))}
                onPointerDown={onPointerDown}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
            />
        )}
    </div>
);

const YarnList: React.FC<{ 
    yarns: {[key: string]: YarnDefinition}, 
    type: 'warp' | 'weft',
    activeId?: string,
    isSelectedType?: boolean,
    onSelect?: (id: string, type: 'warp' | 'weft') => void,
    onDesignYarn?: (id: string, type: 'warp' | 'weft') => void,
    onEdit: (char: string, def: YarnDefinition) => void,
    onAssignColor: (char: string) => void, 
    onDropYarn: (sourceId: string, sourceType: 'warp' | 'weft', targetId: string) => void,
    onDropWeaveOnYarn?: (weaveId: string, yarnId: string, type: 'warp' | 'weft') => void,
    label: string 
}> = ({ yarns, type, activeId, isSelectedType, onSelect, onDesignYarn, onEdit, onAssignColor, onDropYarn, onDropWeaveOnYarn, label }) => {
    const letters = ['A','B','C','D','E','F','G','H'];
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    return (
        <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2">{label}</h2>
            <div className="flex flex-col gap-2">
                {letters.map((char) => {
                    const yarn = yarns[char];
                    const isSelected = isSelectedType && activeId === char;
                    const isDragOver = dragOverId === char;
                    
                    if (!yarn) {
                        return (
                            <div 
                                key={char} 
                                className={`flex items-center gap-3 p-2 rounded-md border border-dashed hover:bg-blue-50 transition-all cursor-pointer opacity-60 hover:opacity-100 ${isSelected ? 'border-blue-500 bg-blue-50' : (isDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-300 hover:border-blue-400')}`}
                                onClick={() => {
                                    const defaultDef: YarnDefinition = { 
                                        color: '#CCCCCC', 
                                        model: 'simple', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 28, ply: 1, thickness: 1.0, twist: 'Z', tpi: 15, sheen: 0.5, roughness: 0.5, price: 0,
                                        bindingDepth: 0.05
                                    };
                                    onEdit(char, defaultDef);
                                    onSelect && onSelect(char, type);
                                }}
                                onDragOver={(e) => { e.preventDefault(); setDragOverId(char); }}
                                onDragLeave={() => setDragOverId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverId(null);
                                    const sourceYarnId = e.dataTransfer.getData('yarn-id');
                                    const sourceYarnType = e.dataTransfer.getData('yarn-type') as 'warp' | 'weft';
                                    const weaveId = e.dataTransfer.getData('weave-id');
                                    
                                    if (weaveId && onDropWeaveOnYarn) {
                                        onDropWeaveOnYarn(weaveId, char, type);
                                    } else if (sourceYarnId) {
                                        onDropYarn(sourceYarnId, sourceYarnType, char);
                                    }
                                }}
                                title={`Initialize Yarn ${char}`}
                            >
                                <div className="font-mono font-bold text-gray-400 w-4">{char}</div>
                                <div className="text-[10px] text-gray-400 font-medium">Empty Slot</div>
                                <PlusIcon className="w-4 h-4 text-gray-400 ml-auto" />
                            </div>
                        );
                    }

                    const code = yarn.code || (yarn.count ? `${yarn.ply||1}/${yarn.count} ${yarn.countSystem||'Nm'}` : `Type ${char}`);
                    
                    return (
                        <div 
                            key={char} 
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('yarn-id', char);
                                e.dataTransfer.setData('yarn-type', type);
                                e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverId(char); }}
                            onDragLeave={() => setDragOverId(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverId(null);
                                const sourceYarnId = e.dataTransfer.getData('yarn-id');
                                const sourceYarnType = e.dataTransfer.getData('yarn-type') as 'warp' | 'weft';
                                const weaveId = e.dataTransfer.getData('weave-id');
                                const droppedHex = e.dataTransfer.getData('color-hex');
                                
                                if (droppedHex) {
                                    onEdit(char, { ...yarn, color: droppedHex });
                                } else if (weaveId && onDropWeaveOnYarn) {
                                    onDropWeaveOnYarn(weaveId, char, type);
                                } else if (sourceYarnId) {
                                    onDropYarn(sourceYarnId, sourceYarnType, char);
                                }
                            }}
                            onClick={() => onSelect && onSelect(char, type)}
                            className={`flex items-center gap-3 p-2 rounded-md border transition-all group cursor-pointer ${isSelected ? 'bg-gray-200 border-gray-400 ring-1 ring-gray-300' : (isDragOver ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:bg-gray-50')}`}
                        >
                            <div className={`font-mono font-bold w-4 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{char}</div>
                            
                            <div className="flex-1 min-w-0">
                                <div 
                                    className="h-3 rounded-full relative overflow-hidden shadow-inner flex items-center hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all mb-1" 
                                    style={{ background: yarn.color }}
                                    onClick={(e) => { e.stopPropagation(); onAssignColor(char); }}
                                    title="Click to apply selected palette color"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20"></div>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                     <span className="text-[10px] text-gray-500 font-medium truncate">{code}</span>
                                     <span className="text-[9px] text-gray-400">{yarn.fiberType || 'Cotton'}</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDesignYarn ? onDesignYarn(char, type) : onEdit(char, yarn); }}
                                className={`w-7 h-7 flex items-center justify-center rounded-full border hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0 ${isSelected ? 'border-gray-300 bg-white text-gray-500' : 'border-gray-200 text-gray-400'}`}
                                title="Open Yarn Designer"
                            >
                                <MagicWandIcon className="w-3 h-3" />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}

export const RightPanel: React.FC<RightPanelProps> = ({
    settings, onSettingsChange, dentingPattern, onDentingChange, onSnapshot, onLoadWeave,
    customWeaves, onAddWeave, onUpdateWeave, onDeleteWeave,
    warpYarns, weftYarns, onUpdateWarpYarn, onUpdateWeftYarn, onUpdateAllYarns,
    paletteColors,
    warpPatternString, setWarpPatternString, weftPatternString, setWeftPatternString, onOpenGridEditor, onOpenPatternGenerator,
    currentInput, onApplyGenerated, onSimulate,
    selectedColorIndex, onSelectColor,
    onOpenDraftStudio, onOpenPegPlanStudio,
    activeYarnId = 'A', selectedYarnType, onSelectYarn, onActiveYarnChange,
    forcedTab, onSyncGridDimensions,
    isWeftScaled, onToggleWeftScale,
    isWarpScaled, onToggleWarpScale,
    onDropWeaveOnYarn,
    onDesignYarn
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('construction');
    const [editingYarn, setEditingYarn] = useState<{ id: string, type: 'warp' | 'weft', def: YarnDefinition } | null>(null);
    const [weaveEditorState, setWeaveEditorState] = useState<{ isOpen: boolean, weave?: LibraryWeave }>({ isOpen: false });

    useEffect(() => {
        if (forcedTab) {
            setActiveTab(forcedTab);
        }
    }, [forcedTab]);

    const warpColors = Object.fromEntries(Object.entries(warpYarns).map(([k,v]) => [k, (v as YarnDefinition).color]));
    const weftColors = Object.fromEntries(Object.entries(weftYarns).map(([k,v]) => [k, (v as YarnDefinition).color]));

    const allWeaves = [...WEAVE_LIBRARY, ...customWeaves];
    const activePaletteColor = paletteColors[selectedColorIndex || 0];
    const letters = ['A','B','C','D','E','F','G','H'];

    const handleMirror = () => {
        onSnapshot();
        setWeftPatternString(warpPatternString);
    };

    const handleShuffleColors = () => {
        if (!onUpdateAllYarns) return;
        onSnapshot();
        
        const shuffle = (yarns: { [key: string]: YarnDefinition }) => {
            const newYarns = { ...yarns };
            const colors = letters.filter(l => yarns[l]).map(l => yarns[l].color);
            if (colors.length === 0) return newYarns;
            colors.unshift(colors.pop()!);
            letters.forEach((l, i) => {
                if (newYarns[l] && colors[i]) {
                    newYarns[l] = { ...newYarns[l], color: colors[i] };
                }
            });
            return newYarns;
        };
        
        onUpdateAllYarns('warp', shuffle(warpYarns));
        onUpdateAllYarns('weft', shuffle(weftYarns));
    };

    const handleCopyWarpToWeft = () => {
        if (window.confirm("Copy all Warp yarn definitions to Weft? Current weft yarns will be overwritten.")) {
            onSnapshot();
            const newWeft = { ...weftYarns };
            letters.forEach(l => {
                if (warpYarns[l]) newWeft[l] = { ...warpYarns[l] };
            });
            if (onUpdateAllYarns) onUpdateAllYarns('weft', newWeft);
        }
    };

    const handleCopyWeftToWarp = () => {
        if (window.confirm("Copy all Weft yarn definitions to Warp? Current warp yarns will be overwritten.")) {
            onSnapshot();
            const newWarp = { ...warpYarns };
            letters.forEach(l => {
                if (weftYarns[l]) newWarp[l] = { ...weftYarns[l] };
            });
            if (onUpdateAllYarns) onUpdateAllYarns('warp', newWarp);
        }
    };

    const handleDropYarn = (sourceId: string, sourceType: 'warp' | 'weft', targetId: string, targetType: 'warp' | 'weft') => {
        onSnapshot();
        const sourceBank = sourceType === 'warp' ? warpYarns : weftYarns;
        const sourceDef = sourceBank[sourceId];
        if (!sourceDef) return;

        if (targetType === 'warp') {
            onUpdateWarpYarn(targetId, { ...sourceDef });
        } else {
            onUpdateWeftYarn(targetId, { ...sourceDef });
        }
    };

    const patternWarpRepeat = getTotalThreads(warpPatternString);
    const patternWeftRepeat = getTotalThreads(weftPatternString);

    return (
        <>
            <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col z-20 shadow-xl">
                <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto no-scrollbar shrink-0">
                    <TabButton id="construction" activeTab={activeTab} onClick={setActiveTab} icon={<LayersIcon className="w-5 h-5" />} label="Specs" />
                    <TabButton id="weave" activeTab={activeTab} onClick={setActiveTab} icon={<GridFillIcon className="w-5 h-5" />} label="Weave" />
                    <TabButton id="pattern" activeTab={activeTab} onClick={setActiveTab} icon={<GridIcon className="w-5 h-5" />} label="Pattern" />
                    <TabButton id="yarns" activeTab={activeTab} onClick={setActiveTab} icon={<ListIcon className="w-5 h-5" />} label="Yarns" />
                    <TabButton id="colors" activeTab={activeTab} onClick={setActiveTab} icon={<PaletteIcon className="w-5 h-5" />} label="Colors" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    
                    {activeTab === 'construction' && (
                        <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                            <h2 className="text-sm font-bold text-gray-900 mb-4">Fabric Specifications</h2>
                            
                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-6">
                                <div className="flex justify-between items-center mb-1 text-xs">
                                    <span className="text-gray-500 uppercase tracking-wide">Pattern Repeat</span>
                                    <span className="font-bold text-gray-700">{patternWarpRepeat} x {patternWeftRepeat}</span>
                                </div>
                                <div className="flex justify-between items-center mb-3 text-xs">
                                    <span className="text-gray-500 uppercase tracking-wide">Grid Dimensions</span>
                                    <span className="font-bold text-gray-700">{settings.warpThreads} x {settings.weftPicks}</span>
                                </div>
                                {onSyncGridDimensions && (
                                    <button 
                                        onClick={() => onSyncGridDimensions(patternWarpRepeat, patternWeftRepeat)}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-50 text-white rounded font-bold text-xs shadow-sm transition-colors"
                                    >
                                        Sync Grid to Pattern
                                    </button>
                                )}
                            </div>

                            {/* Fix: Replaced onUpdateSettings with the correct prop onSettingsChange */}
                            <SliderInput label="Draft Repeat" value={settings.warpThreads} onChange={(v) => onSettingsChange({ ...settings, warpThreads: v })} onPointerDown={onSnapshot} min={4} max={512} step={4} subLabel="ends" />
                            <SliderInput label="Peg Repeat" value={settings.weftPicks} onChange={(v) => onSettingsChange({ ...settings, weftPicks: v })} onPointerDown={onSnapshot} min={4} max={512} step={4} subLabel="picks" />
                            <SliderInput label="Harnesses" value={settings.harnesses} onChange={(v) => onSettingsChange({ ...settings, harnesses: v })} onPointerDown={onSnapshot} min={2} max={24} step={1} />
                            
                            <div className="h-px bg-gray-100 my-6" />
                            
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Set & Reed</h3>
                            {/* Fix: Replaced onUpdateSettings with the correct prop onSettingsChange */}
                            <SliderInput label="Ends Per Inch" value={settings.epi} onChange={(v) => onSettingsChange({ ...settings, epi: v })} onPointerDown={onSnapshot} min={8} max={250} step={1} />
                            <SliderInput label="Picks Per Inch" value={settings.ppi} onChange={(v) => onSettingsChange({ ...settings, ppi: v })} onPointerDown={onSnapshot} min={8} max={250} step={1} />
                            
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Denting Pattern</label>
                                <input type="text" value={dentingPattern} onChange={(e) => { onSnapshot(); onDentingChange(e.target.value); }}
                                    className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="mt-8 pt-4 border-t border-gray-100">
                                <button onClick={onSimulate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                                    Simulate Fabric
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'weave' && (
                        <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="flex flex-col gap-3 mb-8">
                                <button 
                                    onClick={onOpenDraftStudio}
                                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95"
                                >
                                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><LayersIcon className="w-5 h-5"/></div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold uppercase tracking-tight">Drafting Studio</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase">Threading & Denting</div>
                                    </div>
                                </button>
                                <button 
                                    onClick={onOpenPegPlanStudio}
                                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95"
                                >
                                    <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center"><GridFillIcon className="w-5 h-5"/></div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold uppercase tracking-tight">Treadling Studio</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase">Peg Plan & Lift</div>
                                    </div>
                                </button>
                            </div>

                            <div className="h-px bg-gray-100 mb-6" />

                            <div className="flex justify-between items-center mb-4 px-1">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Weave Library</h2>
                                <button 
                                    onClick={() => setWeaveEditorState({ isOpen: true })}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                    title="Add Custom Weave"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pb-8">
                                {allWeaves.map(weave => {
                                    const isCustom = weave.id.startsWith('custom-');
                                    return (
                                        <div key={weave.id} className="relative group">
                                            <button
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('weave-id', weave.id);
                                                    e.dataTransfer.effectAllowed = 'copy';
                                                }}
                                                onClick={() => { onSnapshot(); onLoadWeave(weave); }}
                                                className="flex flex-col items-start p-2 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl transition-all text-left w-full shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing"
                                            >
                                                <WeaveThumbnail weave={weave} className="w-full aspect-square mb-2 rounded-lg pointer-events-none" />
                                                <span className="text-[11px] font-bold text-gray-800 group-hover:text-blue-700 leading-tight truncate w-full pointer-events-none">{weave.name}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 pointer-events-none">{weave.harnesses}H</span>
                                            </button>
                                            
                                            {isCustom && (
                                                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setWeaveEditorState({ isOpen: true, weave }); }}
                                                        className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:text-blue-600"
                                                    >
                                                        <PencilIcon className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onDeleteWeave(weave.id); }}
                                                        className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:text-red-600"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'pattern' && (
                        <div className="animate-in fade-in slide-in-from-right-2 duration-200 flex flex-col gap-6">
                            <div className="flex gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                                <button onClick={handleMirror} className="flex-1 flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors" title="Copy Warp Pattern to Weft">
                                    <CopyIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Mirror</span>
                                </button>
                                <button onClick={handleShuffleColors} className="flex-1 flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors" title="Rotate Yarn Colors">
                                    <FlipIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Shuffle</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => onOpenGridEditor('warp')}
                                    className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-200 hover:border-blue-500 rounded-xl shadow-sm transition-all group"
                                >
                                    <TableIcon className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-gray-600">Warp Manager</span>
                                </button>
                                <button 
                                    onClick={() => onOpenGridEditor('weft')}
                                    className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-200 hover:border-blue-500 rounded-xl shadow-sm transition-all group"
                                >
                                    <TableIcon className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-gray-600">Weft Manager</span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-4">
                                <TextPatternEditor 
                                    title="Warp Pattern String" 
                                    value={warpPatternString} 
                                    onValueChange={setWarpPatternString} 
                                    colorMap={warpColors} 
                                    isScaled={isWarpScaled}
                                    onToggleScale={onToggleWarpScale}
                                />
                                <TextPatternEditor 
                                    title="Weft Pattern String" 
                                    value={weftPatternString} 
                                    onValueChange={setWeftPatternString} 
                                    colorMap={weftColors} 
                                    isScaled={isWeftScaled}
                                    onToggleScale={onToggleWeftScale}
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={() => onOpenPatternGenerator('warp')}
                                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all"
                                >
                                    <MagicWandIcon className="w-4 h-4 text-blue-400" /> Pattern Generators
                                </button>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                                <h3 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Current Repeat</h3>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500">Warp Length</span>
                                    <span className="font-bold text-gray-700 font-mono">{patternWarpRepeat} Ends</span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-gray-500">Weft Length</span>
                                    <span className="font-bold text-gray-700 font-mono">{patternWeftRepeat} Picks</span>
                                </div>
                            </div>
                            
                            <div className="h-px bg-gray-100" />
                            
                            <AiControl currentInput={currentInput} settings={settings} onApplyGenerated={onApplyGenerated} />
                        </div>
                    )}

                    {activeTab === 'yarns' && (
                        <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                            <YarnList 
                                yarns={warpYarns}
                                type="warp"
                                activeId={activeYarnId}
                                isSelectedType={selectedYarnType === 'warp'}
                                onSelect={onSelectYarn}
                                onDesignYarn={onDesignYarn}
                                onEdit={(char, def) => setEditingYarn({ id: char, type: 'warp', def })}
                                onAssignColor={(char) => { onSnapshot(); onUpdateWarpYarn(char, { ...warpYarns[char], color: activePaletteColor }); }}
                                onDropYarn={(sId, sType, tId) => handleDropYarn(sId, sType, tId, 'warp')}
                                onDropWeaveOnYarn={onDropWeaveOnYarn}
                                label="Warp Yarns" 
                            />
                            
                            <div className="flex items-center gap-1 my-4">
                                <div className="flex gap-8 mt-2">
                                    <button 
                                        onClick={handleCopyWarpToWeft}
                                        className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 rounded-lg transition-all shadow-sm border border-gray-200 flex flex-col items-center gap-1"
                                        title="Copy all Warp yarns to Weft"
                                    >
                                        <ArrowDownIcon className="w-5 h-5" />
                                        <span className="text-[8px] font-bold uppercase">Warp to Weft</span>
                                    </button>
                                    <button 
                                        onClick={handleCopyWeftToWarp}
                                        className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 rounded-lg transition-all shadow-sm border border-gray-200 flex flex-col items-center gap-1"
                                        title="Copy all Weft yarns to Warp"
                                    >
                                        <ArrowDownIcon className="w-5 h-5 rotate-180" />
                                        <span className="text-[8px] font-bold uppercase">Weft to Warp</span>
                                    </button>
                                </div>
                            </div>

                            <YarnList 
                                yarns={weftYarns}
                                type="weft"
                                activeId={activeYarnId}
                                isSelectedType={selectedYarnType === 'weft'}
                                onSelect={onSelectYarn}
                                onDesignYarn={onDesignYarn}
                                onEdit={(char, def) => setEditingYarn({ id: char, type: 'weft', def })}
                                onAssignColor={(char) => { onSnapshot(); onUpdateWeftYarn(char, { ...weftYarns[char], color: activePaletteColor }); }}
                                onDropYarn={(sId, sType, tId) => handleDropYarn(sId, sType, tId, 'weft')}
                                onDropWeaveOnYarn={onDropWeaveOnYarn}
                                label="Weft Yarns" 
                            />
                        </div>
                    )}

                    {activeTab === 'colors' && (
                        <ColorLibraryTab onSelectColor={(hex) => onSelectColor?.(paletteColors.indexOf(hex))} activeHex={activePaletteColor} />
                    )}
                </div>
            </div>

            {editingYarn && (
                <YarnDesignerModal 
                    isOpen={!!editingYarn}
                    onClose={() => setEditingYarn(null)}
                    yarnId={editingYarn.id}
                    yarnType={editingYarn.type}
                    initialYarn={editingYarn.def}
                    onSave={(newYarn) => {
                        onSnapshot();
                        if (editingYarn.type === 'warp') {
                            onUpdateWarpYarn(editingYarn.id, newYarn);
                        } else {
                            onUpdateWeftYarn(editingYarn.id, newYarn);
                        }
                    }}
                />
            )}

            {weaveEditorState.isOpen && (
                <WeaveEditorModal
                    isOpen={weaveEditorState.isOpen}
                    initialWeave={weaveEditorState.weave}
                    onClose={() => setWeaveEditorState({ isOpen: false })}
                    onSave={(weave) => {
                        onSnapshot();
                        if (weaveEditorState.weave) {
                            onUpdateWeave(weave);
                        } else {
                            onAddWeave(weave);
                        }
                    }}
                />
            )}
        </>
    );
};
