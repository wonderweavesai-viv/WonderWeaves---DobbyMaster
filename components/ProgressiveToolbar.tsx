
import React from 'react';
import { LayoutIcon, TerminalIcon, DesktopIcon, PlayCircleIcon, PresentationIcon, YarnIcon, GridFillIcon, SwatchIcon, CameraIcon, TableIcon, PaletteIcon, LayersIcon, CubeIcon, GridIcon, MagicWandIcon, PrinterIcon } from './icons';
import { AppMode } from '../types';

interface ProgressiveToolbarProps {
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
}

const ModeButton: React.FC<{ 
    active: boolean; 
    icon: React.ReactNode; 
    label: string; 
    onClick: () => void;
    disabled?: boolean;
}> = ({ active, icon, label, onClick, disabled }) => (
    <button
        onClick={disabled ? undefined : onClick}
        className={`w-full px-1 py-3 flex flex-col items-center gap-1 transition-all border-l-4 relative group ${
            active 
            ? 'border-blue-500 bg-gray-800 text-blue-400' 
            : disabled 
                ? 'border-transparent text-gray-600 cursor-not-allowed opacity-50' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
        }`}
        title={label + (disabled ? " (Coming Soon)" : "")}
    >
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider text-center leading-tight">{label}</span>
        {disabled && (
            <div className="absolute left-full top-2 ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-gray-700">
                Coming Soon
            </div>
        )}
    </button>
);

export const ProgressiveToolbar: React.FC<ProgressiveToolbarProps> = ({ mode, onModeChange }) => {
    return (
        <div className="w-20 h-full bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2 z-30 flex-shrink-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
            
            {/* 1. Fabric Specs */}
            <ModeButton 
                active={mode === 'specs'} 
                icon={<LayersIcon className="w-6 h-6" />} 
                label="Specs" 
                onClick={() => onModeChange('specs')}
            />

            {/* 2. Weaving Module */}
            <ModeButton 
                active={mode === 'weave'} 
                icon={<GridFillIcon className="w-6 h-6" />} 
                label="Weaving" 
                onClick={() => onModeChange('weave')}
            />

            {/* 3. Pattern Module */}
            <ModeButton 
                active={mode === 'pattern'} 
                icon={<TableIcon className="w-6 h-6" />} 
                label="Pattern" 
                onClick={() => onModeChange('pattern')}
            />

            {/* 4. Tech Studio (Tech Deck) */}
            <ModeButton 
                active={mode === 'tech-studio'} 
                icon={<GridIcon className="w-6 h-6" />} 
                label="Tech Deck" 
                onClick={() => onModeChange('tech-studio')}
            />
            
            <div className="w-10 h-px bg-gray-800 my-2 shrink-0" />

            {/* 5. Analysis Module (New) */}
            <ModeButton 
                active={mode === 'analyze'} 
                icon={<MagicWandIcon className="w-6 h-6" />} 
                label="Analyse" 
                onClick={() => onModeChange('analyze')}
            />
            
            <div className="w-10 h-px bg-gray-800 my-2 shrink-0" />
            
            {/* 6. Yarn Module */}
            <ModeButton 
                active={mode === 'yarn'} 
                icon={<YarnIcon className="w-6 h-6" />} 
                label="Yarn" 
                onClick={() => onModeChange('yarn')}
            />

            {/* 7. ColorWays Module */}
            <ModeButton 
                active={mode === 'colorways'} 
                icon={<PaletteIcon className="w-6 h-6" />} 
                label="Colors" 
                onClick={() => onModeChange('colorways')}
            />

            <div className="w-10 h-px bg-gray-800 my-2 shrink-0" />
            
            {/* 8. Sim Module */}
            <ModeButton 
                active={mode === 'sim'} 
                icon={<PlayCircleIcon className="w-6 h-6" />} 
                label="Sim" 
                onClick={() => onModeChange('sim')}
            />

            <div className="w-10 h-px bg-gray-800 my-2 shrink-0" />

            {/* 9. Tech Data -> Production Calculator */}
            <ModeButton 
                active={mode === 'tech'} 
                icon={<TerminalIcon className="w-6 h-6" />} 
                label="Prod" 
                onClick={() => onModeChange('tech')}
            />

            {/* 10. Print Studio */}
            <ModeButton 
                active={mode === 'print'} 
                icon={<PrinterIcon className="w-6 h-6" />} 
                label="Print" 
                onClick={() => onModeChange('print')}
            />

            {/* 11. Presentation */}
            <ModeButton 
                active={mode === 'presentation'} 
                icon={<PresentationIcon className="w-6 h-6" />} 
                label="Pres" 
                onClick={() => onModeChange('presentation')}
                disabled
            />
            
            <div className="h-4 w-full shrink-0"></div>
        </div>
    );
};
