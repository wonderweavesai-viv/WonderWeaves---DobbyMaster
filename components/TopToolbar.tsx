
import React, { useState, useEffect } from 'react';
import { 
    PencilIcon, LineIcon, GridFillIcon, UndoIcon, RedoIcon, 
    EyeIcon, EyeOffIcon, FlipIcon, WeaveIcon, ChevronDownIcon, HandIcon,
    DownloadIcon, UploadIcon, WarpApplyIcon, WeftApplyIcon, PdfIcon, BrushIcon, HomeIcon, SaveIcon,
    RectIcon, CircleIcon, SelectIcon, PanelRightIcon
} from './icons';
import { ToolType, ViewMode, FaceMode, LayoutCorner } from '../types';
import { WEAVE_FILL_PATTERNS } from '../services/weaveLibrary';

interface TopToolbarProps {
    currentTool: ToolType;
    onToolChange: (tool: ToolType) => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    faceMode: FaceMode;
    onFaceModeChange: (mode: FaceMode) => void;
    currentFillPatternId: string;
    onFillPatternChange: (id: string) => void;
    layoutCorner: LayoutCorner;
    onLayoutCornerChange: (corner: LayoutCorner) => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSaveToLibrary: () => void;
    onSaveAsWeave?: () => void;
    onSave: () => void;
    onLoad: () => void;
    onImport: () => void;
    onApplyToWarp?: () => void;
    onApplyToWeft?: () => void;
    onDownloadPdf?: () => void;
    isRightPanelCollapsed?: boolean;
    onToggleRightPanel?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
    currentTool, onToolChange,
    viewMode, onViewModeChange,
    faceMode, onFaceModeChange,
    currentFillPatternId, onFillPatternChange,
    layoutCorner, onLayoutCornerChange,
    canUndo, canRedo, onUndo, onRedo,
    onSaveToLibrary, onSaveAsWeave, onSave, onLoad, onImport,
    onApplyToWarp, onApplyToWeft,
    onDownloadPdf,
    isRightPanelCollapsed,
    onToggleRightPanel
}) => {
    const [isPatternMenuOpen, setIsPatternMenuOpen] = React.useState(false);
    const currentPatternName = WEAVE_FILL_PATTERNS.find(p => p.id === currentFillPatternId)?.name || 'Structure';

    const ToolBtn: React.FC<{ type: ToolType, icon: React.ReactNode, title: string }> = ({ type, icon, title }) => (
        <button
            onClick={() => onToolChange(type)}
            title={title}
            className={`p-2 rounded-md flex items-center justify-center transition-colors ${currentTool === type ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
        >
            {icon}
        </button>
    );

    return (
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 justify-between shrink-0 z-30 shadow-sm relative">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                    <WeaveIcon className="w-6 h-6 text-blue-600" />
                    <span className="font-bold text-gray-800 tracking-tight">WeaveCAD</span>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                     <button onClick={onLoad} className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors" title="Open design (design browser)">
                        <HomeIcon className="w-4 h-4" />
                     </button>
                     <button onClick={onSaveToLibrary} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Save design">
                        <SaveIcon className="w-4 h-4" />
                     </button>
                     {onSaveAsWeave && (
                        <button onClick={onSaveAsWeave} className="px-2 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors flex items-center gap-1" title="Save this design's structure to your weave library">
                            <WeaveIcon className="w-4 h-4" /> Save as weave
                        </button>
                     )}
                     <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                     <button onClick={onImport} className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors" title="Import files (.wwdesign, .wwweave, .wwyarn, .wwpalette, .weave)">
                        <UploadIcon className="w-4 h-4" />
                     </button>
                     <button onClick={onSave} className="p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors" title="Save a copy of this design as a file">
                        <DownloadIcon className="w-4 h-4" />
                     </button>
                     <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                     <button onClick={onUndo} disabled={!canUndo} className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30 rounded-md hover:bg-gray-100">
                        <UndoIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onRedo} disabled={!canRedo} className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30 rounded-md hover:bg-gray-100">
                        <RedoIcon className="w-4 h-4" />
                    </button>
                     <div className="w-px h-4 bg-gray-300 mx-1"></div>
                     <button onClick={onDownloadPdf} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors" title="PDF Spec">
                        <PdfIcon className="w-4 h-4" />
                     </button>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <ToolBtn type="pan" icon={<HandIcon className="w-4 h-4" />} title="Pan" />
                    <ToolBtn type="select" icon={<SelectIcon className="w-4 h-4" />} title="Selection Tool" />
                    <ToolBtn type="pencil" icon={<PencilIcon className="w-4 h-4" />} title="Pencil" />
                    <ToolBtn type="brush" icon={<BrushIcon className="w-4 h-4" />} title="Color Brush" />
                    <ToolBtn type="line" icon={<LineIcon className="w-4 h-4" />} title="Line" />
                    <ToolBtn type="rect" icon={<RectIcon className="w-4 h-4" />} title="Square / Rect" />
                    <ToolBtn type="circle" icon={<CircleIcon className="w-4 h-4" />} title="Circle" />
                    <ToolBtn type="fill" icon={<GridFillIcon className="w-4 h-4" />} title="Pattern Fill" />
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Layout Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button 
                        onClick={() => onLayoutCornerChange('TL')}
                        className={`p-1.5 rounded transition-all ${layoutCorner === 'TL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Origin Top-Left"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7M7 7h10M7 7v10" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => onLayoutCornerChange('BL')}
                        className={`p-1.5 rounded transition-all ${layoutCorner === 'BL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Origin Bottom-Left"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 7l10 10M7 17h10M7 17V7" />
                        </svg>
                    </button>
                </div>

                <div className="w-px h-8 bg-gray-200 mx-1"></div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => onViewModeChange('interlace')} title="Color" className={`p-2 rounded-md ${viewMode === 'interlace' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}><EyeIcon className="w-4 h-4" /></button>
                        <button onClick={() => onViewModeChange('structure')} title="Structure" className={`p-2 rounded-md ${viewMode === 'structure' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}><EyeOffIcon className="w-4 h-4" /></button>
                    </div>

                    <button
                        onClick={() => onFaceModeChange(faceMode === 'face' ? 'reverse' : 'face')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${faceMode === 'reverse' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FlipIcon className="w-4 h-4" />
                        <span>{faceMode === 'face' ? 'Face' : 'Back'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
