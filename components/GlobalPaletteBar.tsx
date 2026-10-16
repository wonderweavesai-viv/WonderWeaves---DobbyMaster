import React, { useState } from 'react';
import { YarnDefinition, AppMode } from '../types';
import { CheckIcon } from './icons';

interface GlobalPaletteBarProps {
    appMode: AppMode;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    activeYarnId: string;
    selectedYarnType: 'warp' | 'weft';
    onSelectYarn: (id: string, type: 'warp' | 'weft') => void;
    onDropWeaveOnYarn: (weaveId: string, yarnId: string, type: 'warp' | 'weft') => void;
    onUpdateYarnColor?: (id: string, type: 'warp' | 'weft', hex: string) => void;
}

const YarnChip: React.FC<{ 
    char: string, 
    color: string, 
    isActive: boolean, 
    onClick: () => void,
    isEmpty: boolean,
    type: 'warp' | 'weft',
    onDropWeaveOnYarn: (weaveId: string, yarnId: string, type: 'warp' | 'weft') => void;
    onUpdateYarnColor?: (id: string, type: 'warp' | 'weft', hex: string) => void;
}> = ({ char, color, isActive, onClick, isEmpty, type, onDropWeaveOnYarn, onUpdateYarnColor }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const weaveId = e.dataTransfer.getData('weave-id');
        const colorHex = e.dataTransfer.getData('color-hex');
        
        if (colorHex && onUpdateYarnColor) {
            onUpdateYarnColor(char, type, colorHex);
        } else if (weaveId) {
            onDropWeaveOnYarn(weaveId, char, type);
        }
    };

    return (
        <button
            onClick={onClick}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`
                relative w-9 h-9 rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5
                ${isActive 
                    ? (type === 'warp' ? 'border-blue-500 ring-2 ring-blue-100 scale-105 z-10' : 'border-orange-500 ring-2 ring-orange-100 scale-105 z-10') 
                    : 'border-gray-200 hover:border-gray-400 shadow-sm'}
                ${isEmpty ? 'bg-gray-50 border-dashed opacity-30 cursor-default' : ''}
                ${isDragOver ? 'ring-4 ring-blue-400 scale-110 border-blue-500 z-20 bg-blue-50' : ''}
            `}
            style={{ backgroundColor: isEmpty ? 'transparent' : color }}
            title={`${type.toUpperCase()} ${char}`}
        >
            <span className={`text-[9px] font-black font-mono ${isActive || isDragOver ? 'text-white drop-shadow-md' : 'text-gray-400'}`}>{char}</span>
            {isActive && !isEmpty && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                    <CheckIcon className={`w-2 h-2 ${type === 'warp' ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
            )}
        </button>
    );
};

export const GlobalPaletteBar: React.FC<GlobalPaletteBarProps> = ({
    appMode, warpYarns, weftYarns, activeYarnId, selectedYarnType, onSelectYarn, onDropWeaveOnYarn, onUpdateYarnColor
}) => {
    const letters = ['A','B','C','D','E','F','G','H'];
    
    const getModeLabel = () => {
        switch(appMode) {
            case 'specs': return 'Fabric Specifications';
            case 'weave': return 'Weaving Studio';
            case 'yarn': return 'Yarn Designer';
            case 'pattern': return 'Pattern Studio';
            case 'colorways': return 'Colorway Manager';
            case 'sim': return 'Fabric Simulation';
            case 'tech': return 'Production Data';
            default: return 'WonderWeaves';
        }
    };

    return (
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6 justify-between shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-6">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1">Module</span>
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{getModeLabel()}</span>
                </div>

                <div className="h-8 w-px bg-gray-200"></div>

                <div className="flex gap-8">
                    {/* WARP SECTION */}
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Warp</span>
                        <div className="flex gap-1">
                            {letters.map(char => (
                                <YarnChip 
                                    key={`gb-warp-${char}`} 
                                    char={char} 
                                    type="warp"
                                    color={warpYarns[char]?.color || '#ccc'} 
                                    isActive={selectedYarnType === 'warp' && activeYarnId === char} 
                                    isEmpty={!warpYarns[char]}
                                    onClick={() => warpYarns[char] && onSelectYarn(char, 'warp')}
                                    onDropWeaveOnYarn={onDropWeaveOnYarn}
                                    onUpdateYarnColor={onUpdateYarnColor}
                                />
                            ))}
                        </div>
                    </div>

                    {/* WEFT SECTION */}
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-orange-600 uppercase tracking-tighter">Weft</span>
                        <div className="flex gap-1">
                            {letters.map(char => (
                                <YarnChip 
                                    key={`gb-weft-${char}`} 
                                    char={char} 
                                    type="weft"
                                    color={weftYarns[char]?.color || '#ccc'} 
                                    isActive={selectedYarnType === 'weft' && activeYarnId === char} 
                                    isEmpty={!weftYarns[char]}
                                    onClick={() => weftYarns[char] && onSelectYarn(char, 'weft')}
                                    onDropWeaveOnYarn={onDropWeaveOnYarn}
                                    onUpdateYarnColor={onUpdateYarnColor}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400">
                 <span className="text-[9px] font-bold uppercase tracking-widest italic opacity-60">Drag Weaves or Colors to Yarns to Apply</span>
            </div>
        </div>
    );
};