import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InteractiveGrid } from './InteractiveGrid';
import { WeaveSettings, YarnDefinition, WeavePattern, DensityZone } from '../types';
import { 
    TrashIcon, InvertIcon, ShiftUpIcon, ShiftDownIcon, ShiftLeftIcon, 
    ShiftRightIcon, FlipIcon, RulerIcon, PencilIcon, LayersIcon, 
    GridFillIcon, PlusIcon, MinusIcon, CopyIcon, TableIcon,
    ZoomInIcon, ZoomOutIcon, ResetZoomIcon, CheckIcon, MagicWandIcon, ShuffleIcon
} from './icons';
import { PatternManager } from './PatternManager';
import { expandPatternString, getTotalThreads } from '../utils/patternParser';

interface TechStudioProps {
    settings: WeaveSettings;
    draft: boolean[][];
    pegPlan: boolean[][];
    warpYarns: Record<string, YarnDefinition>;
    weftYarns: Record<string, YarnDefinition>;
    warpPatternString: string;
    weftPatternString: string;
    weavePattern: WeavePattern;
    weftZones: DensityZone[];
    dentingPlan: number[];
    dentingPatternString: string;
    onUpdateDraft: (d: boolean[][]) => void;
    onUpdatePegPlan: (p: boolean[][]) => void;
    onUpdateWarpPattern: (s: string) => void;
    onUpdateWeftPattern: (s: string, z?: DensityZone[]) => void;
    onUpdateDenting: (plan: number[], str: string) => void;
    onUpdateSettings: (s: WeaveSettings) => void;
    onSyncDimensions: (warpLen: number, weftLen: number) => void;
    onSnapshot: () => void;
    onEditYarn: (char: string, type: 'warp' | 'weft') => void;
    // Scaling Props
    isWarpScaled?: boolean;
    onToggleWarpScale?: () => void;
    isWeftScaled?: boolean;
    onToggleWeftScale?: () => void;
}

const ToolButton: React.FC<{ active?: boolean; onClick: () => void; icon: React.ReactNode; title: string; danger?: boolean; disabled?: boolean }> = ({ active, onClick, icon, title, danger, disabled }) => (
    <button 
        onClick={disabled ? undefined : onClick} 
        disabled={disabled}
        title={title} 
        className={`p-1.5 rounded transition-all flex items-center justify-center border shadow-sm ${active ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'} ${danger ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {icon}
    </button>
);

const HeaderInput: React.FC<{ label: string, value: number, onChange: (v: number) => void, color: string }> = ({ label, value, onChange, color }) => (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-0.5 shadow-sm">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{label}</span>
        <input 
            type="number" 
            value={value} 
            onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
            className={`w-12 text-xs font-black font-mono text-center focus:outline-none ${color}`}
        />
    </div>
);

const HeaderTextInput: React.FC<{ label: string, value: string, onChange: (v: string) => void, color: string }> = ({ label, value, onChange, color }) => (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-0.5 shadow-sm">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{label}</span>
        <input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className={`w-24 text-xs font-black font-mono focus:outline-none ${color}`}
            placeholder="e.g. 2,2"
        />
    </div>
);

const SVGRuler: React.FC<{
    orientation: 'horizontal' | 'vertical';
    viewportSize: number;
    zoom: number;
    unit: 'inch' | 'cm';
}> = ({ orientation, viewportSize, zoom, unit }) => {
    const pixelsPerUnit = unit === 'inch' ? 96 : (96 / 2.54);
    const scaledPixelsPerUnit = pixelsPerUnit * zoom;
    const divisions = unit === 'inch' ? 8 : 10;
    
    const ticks = [];
    const numUnits = Math.ceil(viewportSize / scaledPixelsPerUnit) + 1;

    for (let i = 0; i <= numUnits; i++) {
        const basePos = i * scaledPixelsPerUnit;
        if (basePos > viewportSize) break;

        ticks.push(
            <g key={`unit-${i}`} transform={orientation === 'horizontal' ? `translate(${basePos}, 0)` : `translate(0, ${basePos})`}>
                <line 
                    x1="0.5" y1="0.5" 
                    x2={orientation === 'horizontal' ? "0.5" : "15"} 
                    y2={orientation === 'horizontal' ? "15" : "0.5"} 
                    stroke="currentColor" strokeWidth="1.2" 
                />
                <text 
                    x={orientation === 'horizontal' ? "4" : "12"} 
                    y={orientation === 'horizontal' ? "12" : "3"} 
                    fontSize="9" fontWeight="bold" 
                    textAnchor={orientation === 'horizontal' ? "start" : "end"}
                    className="fill-gray-500 font-sans select-none"
                    transform={orientation === 'vertical' ? `rotate(-90 12 3)` : ''}
                >
                    {i}
                </text>
                
                {i < numUnits && Array.from({ length: divisions - 1 }).map((_, j) => {
                    const subPos = (j + 1) * (scaledPixelsPerUnit / divisions);
                    const iHalf = (j + 1) === Math.floor(divisions / 2);
                    const h = iHalf ? 10 : 5;
                    if (basePos + subPos > viewportSize) return null;
                    return (
                        <line 
                            key={`sub-${i}-${j}`}
                            x1={orientation === 'horizontal' ? subPos : "0"} 
                            y1={orientation === 'horizontal' ? "0" : subPos}
                            x2={orientation === 'horizontal' ? subPos : h} 
                            y2={orientation === 'horizontal' ? h : subPos}
                            stroke="currentColor" strokeWidth="0.5"
                            className="text-gray-300"
                        />
                    );
                })}
            </g>
        );
    }

    return (
        <svg 
            className={`absolute z-30 pointer-events-none bg-white/95 backdrop-blur-sm border-gray-200 text-gray-400 ${orientation === 'horizontal' ? 'w-full h-6 border-b left-0 top-0' : 'h-full w-6 border-r left-0 top-0'}`}
        >
            {ticks}
        </svg>
    );
};

export const TechStudio: React.FC<TechStudioProps> = ({
    settings, draft, pegPlan, warpYarns, weftYarns, warpPatternString, weftPatternString, weavePattern, weftZones,
    dentingPlan, dentingPatternString,
    onUpdateDraft, onUpdatePegPlan, onUpdateWarpPattern, onUpdateWeftPattern, onUpdateDenting, onUpdateSettings, onSyncDimensions, onSnapshot, onEditYarn,
    isWarpScaled, onToggleWarpScale, isWeftScaled, onToggleWeftScale
}) => {
    const [previewZoom, setPreviewZoom] = useState(1.0); 
    const [rulerUnit, setRulerUnit] = useState<'inch' | 'cm' | 'none'>('inch');
    const drawdownCanvasRef = useRef<HTMLCanvasElement>(null);
    const rightPanelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [activeGrid, setActiveGrid] = useState<'draft' | 'peg' | 'denting'>('draft');
    const [cursor, setCursor] = useState({ r: 0, c: 0 });
    const [tool, setTool] = useState<'pencil' | 'select'>('pencil');
    const [selection, setSelection] = useState<[number, number, number, number] | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const drawValRef = useRef<boolean>(true);

    const extraWarpMap = useMemo(() => {
        const seq = expandPatternString(warpPatternString);
        return Array.from({ length: settings.warpThreads }, (_, i) => warpYarns[seq[i % seq.length]]?.isExtraWarp || false);
    }, [warpPatternString, warpYarns, settings.warpThreads]);

    const extraWeftMap = useMemo(() => {
        const seq = expandPatternString(weftPatternString);
        return Array.from({ length: settings.weftPicks }, (_, i) => weftYarns[seq[i % seq.length]]?.isExtraWeft || false);
    }, [weftPatternString, weftYarns, settings.weftPicks]);

    const dentingGrid = useMemo(() => {
        const dents = dentingPlan.length > 0 ? dentingPlan : [2];
        const row0: string[] = [];
        const row1: string[] = [];
        let dentIndex = 0, threadCount = 0, currentDentSize = dents[0];
        for (let i = 0; i < settings.warpThreads; i++) {
            let loopGuard = 0;
            while (currentDentSize === 0 && loopGuard < dents.length * 2) {
                dentIndex++;
                currentDentSize = dents[dentIndex % dents.length];
                loopGuard++;
            }
            const isTop = dentIndex % 2 === 0;
            row0.push(isTop ? '#000000' : '#ffffff');
            row1.push(!isTop ? '#000000' : '#ffffff');
            threadCount++;
            if (threadCount >= currentDentSize) {
                dentIndex++;
                threadCount = 0;
                currentDentSize = dents[dentIndex % dents.length];
            }
        }
        return [row0, row1];
    }, [dentingPlan, settings.warpThreads]);

    const handleDraftOp = (op: string) => {
        onSnapshot();
        const next = draft.map(r => [...r]);
        let r1 = 0, c1 = 0, r2 = settings.harnesses - 1, c2 = settings.warpThreads - 1;
        if (selection && activeGrid === 'draft') {
            r1 = Math.min(selection[0], selection[2]); c1 = Math.min(selection[1], selection[3]);
            r2 = Math.max(selection[0], selection[2]); c2 = Math.max(selection[1], selection[3]);
        }

        switch(op) {
            case 'clear': 
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = false;
                onUpdateDraft(next); break;
            case 'invert': 
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = !next[r][c];
                onUpdateDraft(next); break;
            case 'shiftL': onUpdateDraft(next.map(r => [...r.slice(1), r[0]])); break;
            case 'shiftR': onUpdateDraft(next.map(r => [r[r.length-1], ...r.slice(0, -1)])); break;
            case 'shiftU': onUpdateDraft([...next.slice(1), next[0]]); break;
            case 'shiftD': onUpdateDraft([next[next.length-1], ...next.slice(0, -1)]); break;
            case 'straight':
                const straight = next.map(r => r.map(() => false));
                for(let c=0; c<settings.warpThreads; c++) straight[c % settings.harnesses][c] = true;
                onUpdateDraft(straight); break;
        }
    };

    const handlePegOp = (op: string) => {
        onSnapshot();
        const next = pegPlan.map(r => [...r]);
        let r1 = 0, c1 = 0, r2 = settings.weftPicks - 1, c2 = settings.harnesses - 1;
        if (selection && activeGrid === 'peg') {
            r1 = Math.min(selection[0], selection[2]); c1 = Math.min(selection[1], selection[3]);
            r2 = Math.max(selection[0], selection[2]); c2 = Math.max(selection[1], selection[3]);
        }

        switch(op) {
            case 'clear': 
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = false;
                onUpdatePegPlan(next); break;
            case 'invert': 
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = !next[r][c];
                onUpdatePegPlan(next); break;
            case 'shiftL': onUpdatePegPlan(next.map(r => [...r.slice(1), r[0]])); break;
            case 'shiftR': onUpdatePegPlan(next.map(r => [r[r.length-1], ...r.slice(0, -1)])); break;
            case 'shiftU': onUpdatePegPlan([...next.slice(1), next[0]]); break;
            case 'shiftD': onUpdatePegPlan([next[next.length-1], ...next.slice(0, -1)]); break;
            case 'flipV': onUpdatePegPlan([...next].reverse()); break;
        }
    };

    const handleSyncDimensions = () => {
        const wLen = getTotalThreads(warpPatternString);
        const pLen = getTotalThreads(weftPatternString);
        if (wLen > 0 || pLen > 0) {
            onSyncDimensions(wLen || settings.warpThreads, pLen || settings.weftPicks);
        }
    };

    const handleDentingInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        if (activeGrid !== 'denting') { setActiveGrid('denting'); setSelection(null); }
        const currentPlan = dentingPlan.length > 0 ? dentingPlan : [2];
        const boolMap: boolean[] = [];
        let state = true, pIdx = 0;
        while (boolMap.length < settings.warpThreads) {
            for (let k = 0; k < currentPlan[pIdx % currentPlan.length]; k++) boolMap.push(state);
            state = !state; pIdx++;
        }

        let changed = false;
        const targetCol = c % settings.warpThreads;

        if (type === 'down') {
            onSnapshot();
            setIsDragging(true);
            setCursor({ r, c });
            drawValRef.current = r === 0;
            if (boolMap[targetCol] !== drawValRef.current) { boolMap[targetCol] = drawValRef.current; changed = true; }
        } else if (type === 'enter' && isDragging) {
            setCursor({ r, c });
            if (boolMap[targetCol] !== drawValRef.current) { boolMap[targetCol] = drawValRef.current; changed = true; }
        } else if (type === 'up') {
            setIsDragging(false);
        }

        if (changed) {
            const newPlan: number[] = [];
            if (boolMap.length > 0) {
                if (boolMap[0] === false) newPlan.push(0);
                let run = 1, last = boolMap[0];
                for (let i = 1; i < boolMap.length; i++) {
                    if (boolMap[i] === last) run++;
                    else { newPlan.push(run); last = boolMap[i]; run = 1; }
                }
                newPlan.push(run);
            }
            onUpdateDenting(newPlan, newPlan.join(', '));
        }
    };

    const handleDraftInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        if (activeGrid !== 'draft') { setActiveGrid('draft'); setSelection(null); }
        if (type === 'down') {
            onSnapshot();
            setIsDragging(true);
            setCursor({ r, c });
            if (tool === 'pencil') {
                const next = draft.map(row => [...row]);
                for(let i = 0; i < settings.harnesses; i++) if (next[i]) next[i][c] = false;
                if (next[r]) next[r][c] = true;
                onUpdateDraft(next);
            } else {
                setSelection([r, c, r, c]);
            }
        } else if (type === 'enter' && isDragging) {
            setCursor({ r, c });
            if (tool === 'select') setSelection(prev => prev ? [prev[0], prev[1], r, c] : [r, c, r, c]);
        } else if (type === 'up') {
            setIsDragging(false);
        }
    };

    const handlePegInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        if (activeGrid !== 'peg') { setActiveGrid('peg'); setSelection(null); }
        if (type === 'down') {
            setIsDragging(true);
            setCursor({ r, c });
            if (tool === 'pencil') {
                const next = pegPlan.map(row => [...row]);
                if (next[r]) next[r][c] = !next[r][c];
                onUpdatePegPlan(next);
            } else {
                setSelection([r, c, r, c]);
            }
        } else if (type === 'enter' && isDragging) {
            setCursor({ r, c });
            if (tool === 'select') setSelection(prev => prev ? [prev[0], prev[1], r, c] : [r, c, r, c]);
        } else if (type === 'up') {
            setIsDragging(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement) return;
        
        const isDraft = activeGrid === 'draft';
        const isPeg = activeGrid === 'peg';
        const isDenting = activeGrid === 'denting';

        const rows = isDraft ? settings.harnesses : (isPeg ? settings.weftPicks : 2);
        const cols = isPeg ? settings.harnesses : settings.warpThreads;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'ArrowRight') setCursor(p => ({...p, c: Math.min(cols - 1, p.c + 1)}));
        else if (e.key === 'ArrowLeft') setCursor(p => ({...p, c: Math.max(0, p.c - 1)}));
        else if (e.key === 'ArrowUp') setCursor(p => ({...p, r: Math.max(0, p.r - 1)}));
        else if (e.key === 'ArrowDown') setCursor(p => ({...p, r: Math.min(rows - 1, p.r + 1)}));
        else if (e.key === ' ') {
            onSnapshot();
            if (isDraft) {
                const next = draft.map(row => [...row]);
                for(let i=0; i<settings.harnesses; i++) next[i][cursor.c] = false;
                next[cursor.r][cursor.c] = true;
                onUpdateDraft(next);
            } else if (isPeg) {
                const next = pegPlan.map(row => [...row]);
                next[cursor.r][cursor.c] = !next[cursor.r][cursor.c];
                onUpdatePegPlan(next);
            } else if (isDenting) {
                handleDentingInteraction(cursor.r, cursor.c, 'down');
                handleDentingInteraction(cursor.r, cursor.c, 'up');
            }
        }
    };

    useEffect(() => {
        const canvas = drawdownCanvasRef.current;
        const container = rightPanelRef.current;
        if (!canvas || !container || !weavePattern.pattern.length) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const w = container.clientWidth;
        const h = container.clientHeight;
        canvas.width = w;
        canvas.height = h;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        const cw = (96 / settings.epi) * previewZoom;
        const ch = (96 / settings.ppi) * previewZoom;

        const unitCanvas = document.createElement('canvas');
        const rows = weavePattern.pattern.length;
        const cols = weavePattern.pattern[0].length;
        
        unitCanvas.width = Math.ceil(cols * cw);
        unitCanvas.height = Math.ceil(rows * ch);
        const uCtx = unitCanvas.getContext('2d');
        if (uCtx) {
            uCtx.imageSmoothingEnabled = true;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    uCtx.fillStyle = weavePattern.pattern[r][c];
                    uCtx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
                    if (previewZoom > 0.6) {
                        uCtx.strokeStyle = 'rgba(0,0,0,0.03)';
                        uCtx.lineWidth = 0.5;
                        uCtx.strokeRect(c * cw, r * ch, cw, ch);
                    }
                }
            }
        }

        const pattern = ctx.createPattern(unitCanvas, 'repeat');
        if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w, h);
        }

    }, [weavePattern, previewZoom, settings.epi, settings.ppi]);

    return (
        <div 
            ref={containerRef}
            className="flex-1 flex flex-col bg-gray-50 text-gray-800 overflow-hidden relative outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div className="h-10 bg-white border-b border-gray-300 flex items-center px-4 justify-between shrink-0 shadow-sm z-30">
                <div className="flex items-center gap-4">
                    <span className="text-blue-600 font-black text-[10px] tracking-[0.2em] uppercase">Tech Studio Deck</span>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <div className="flex gap-2">
                        <HeaderInput label="Ends" value={settings.warpThreads} onChange={(v) => onUpdateSettings({...settings, warpThreads: v})} color="text-blue-600" />
                        <HeaderInput label="Picks" value={settings.weftPicks} onChange={(v) => onUpdateSettings({...settings, weftPicks: v})} color="text-pink-600" />
                        <HeaderInput label="Shafts" value={settings.harnesses} onChange={(v) => onUpdateSettings({...settings, harnesses: v})} color="text-gray-800" />
                        <div className="w-px h-4 bg-gray-200 self-center mx-1"></div>
                        <HeaderInput label="EPI" value={settings.epi} onChange={(v) => onUpdateSettings({...settings, epi: v})} color="text-blue-500" />
                        <HeaderInput label="PPI" value={settings.ppi} onChange={(v) => onUpdateSettings({...settings, ppi: v})} color="text-orange-500" />
                        <div className="w-px h-4 bg-gray-200 self-center mx-1"></div>
                        <HeaderTextInput label="Reed" value={dentingPatternString} onChange={(v) => {
                             const plan = v.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
                             onUpdateDenting(plan.length > 0 ? plan : [2], v);
                        }} color="text-gray-500" />
                    </div>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <button 
                        onClick={handleSyncDimensions}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors text-[10px] font-black uppercase tracking-widest shadow-sm"
                        title="Sync structural grid repeat with yarn sequence repeat"
                    >
                        <ShuffleIcon className="w-3 h-3" /> Sync Grid
                    </button>
                </div>
                <div className="flex items-center gap-3">
                     <button onClick={onSnapshot} className="px-4 py-1 bg-gray-900 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all">Snapshot</button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-[550px] flex flex-col border-r border-gray-300 bg-white shadow-inner relative z-20">
                    <div className={`flex-1 flex flex-col border-b border-gray-300 relative overflow-hidden transition-all ${activeGrid === 'draft' || activeGrid === 'denting' ? 'ring-2 ring-inset ring-blue-500/20 bg-blue-50/5' : ''}`}>
                        <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0">
                            <span className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2">
                                <LayersIcon className="w-3.5 h-3.5" /> Drafting Studio
                            </span>
                            <div className="flex gap-1">
                                <ToolButton active={tool === 'pencil' && (activeGrid === 'draft' || activeGrid === 'denting')} onClick={() => { setTool('pencil'); setActiveGrid('draft'); }} icon={<PencilIcon className="w-3.5 h-3.5" />} title="Pencil" />
                                <ToolButton active={tool === 'select' && activeGrid === 'draft'} onClick={() => { setTool('select'); setActiveGrid('draft'); }} icon={<MagicWandIcon className="w-3.5 h-3.5" />} title="Selection" />
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <ToolButton onClick={() => handleDraftOp('clear')} icon={<TrashIcon className="w-3.5 h-3.5" />} title="Clear" danger />
                                <ToolButton onClick={() => handleDraftOp('invert')} icon={<InvertIcon className="w-3.5 h-3.5" />} title="Invert" />
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <ToolButton onClick={() => handleDraftOp('shiftL')} icon={<ShiftLeftIcon className="w-3.5 h-3.5" />} title="Shift Left" />
                                <ToolButton onClick={() => handleDraftOp('shiftR')} icon={<ShiftRightIcon className="w-3.5 h-3.5" />} title="Shift Right" />
                                <ToolButton onClick={() => handleDraftOp('straight')} icon={<RulerIcon className="w-3.5 h-3.5" />} title="Straight Draw" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-start justify-start bg-gray-100/30 custom-scrollbar">
                            <div className={`flex flex-col gap-4 border border-gray-300 bg-white p-1 rounded shadow-xl ring-4 ring-black/5 transition-all ${activeGrid === 'draft' || activeGrid === 'denting' ? 'border-blue-500 shadow-blue-100' : ''}`}>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Reed Order</span>
                                    <InteractiveGrid 
                                        data={dentingGrid}
                                        isColorGrid
                                        renderRows={2} renderCols={settings.warpThreads}
                                        onCellInteraction={handleDentingInteraction}
                                        cursorRow={activeGrid === 'denting' ? cursor.r : null}
                                        cursorCol={activeGrid === 'denting' ? cursor.c : null}
                                        width={settings.warpThreads * 18} height={2 * 18}
                                        gridDivision={4}
                                        showGrid
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Threading (Draft)</span>
                                    <InteractiveGrid 
                                        data={draft}
                                        renderRows={settings.harnesses} renderCols={settings.warpThreads}
                                        onCellInteraction={handleDraftInteraction}
                                        cursorRow={activeGrid === 'draft' ? cursor.r : null}
                                        cursorCol={activeGrid === 'draft' ? cursor.c : null}
                                        selectionRect={activeGrid === 'draft' ? selection : null}
                                        width={settings.warpThreads * 18} height={settings.harnesses * 18}
                                        gridDivision={4}
                                        activeColor="#2563eb"
                                        showNumbers
                                        extraCols={extraWarpMap}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`flex-1 flex flex-col relative overflow-hidden transition-all ${activeGrid === 'peg' ? 'ring-2 ring-inset ring-pink-500/20 bg-pink-50/5' : ''}`}>
                        <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0">
                            <span className="text-[10px] font-black text-pink-600 uppercase flex items-center gap-2">
                                <GridFillIcon className="w-3.5 h-3.5" /> Treadling Studio
                            </span>
                            <div className="flex gap-1">
                                <ToolButton active={tool === 'pencil' && activeGrid === 'peg'} onClick={() => { setTool('pencil'); setActiveGrid('peg'); }} icon={<PencilIcon className="w-3.5 h-3.5" />} title="Pencil" />
                                <ToolButton active={tool === 'select' && activeGrid === 'peg'} onClick={() => { setTool('select'); setActiveGrid('peg'); }} icon={<MagicWandIcon className="w-3.5 h-3.5" />} title="Selection" />
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <ToolButton onClick={() => handlePegOp('clear')} icon={<TrashIcon className="w-3.5 h-3.5" />} title="Clear" danger />
                                <ToolButton onClick={() => handlePegOp('invert')} icon={<InvertIcon className="w-3.5 h-3.5" />} title="Invert" />
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <ToolButton onClick={() => handlePegOp('shiftU')} icon={<ShiftUpIcon className="w-3.5 h-3.5" />} title="Shift Up" />
                                <ToolButton onClick={() => handlePegOp('shiftD')} icon={<ShiftDownIcon className="w-3.5 h-3.5" />} title="Shift Down" />
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <ToolButton onClick={() => handlePegOp('flipV')} icon={<FlipIcon className="w-3.5 h-3.5 rotate-90" />} title="Flip V" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-start justify-start bg-gray-100/30 custom-scrollbar">
                            <div className={`border border-gray-300 bg-white p-1 rounded shadow-xl ring-4 ring-black/5 transition-all ${activeGrid === 'peg' ? 'border-pink-500 shadow-pink-100' : ''}`}>
                                <InteractiveGrid 
                                    data={pegPlan}
                                    renderRows={settings.weftPicks} renderCols={settings.harnesses}
                                    onCellInteraction={handlePegInteraction}
                                    cursorRow={activeGrid === 'peg' ? cursor.r : null}
                                    cursorCol={activeGrid === 'peg' ? cursor.c : null}
                                    selectionRect={activeGrid === 'peg' ? selection : null}
                                    width={settings.harnesses * 18} height={settings.weftPicks * 18}
                                    gridDivision={4}
                                    activeColor="#db2777"
                                    showNumbers
                                    extraRows={extraWeftMap}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-[660px] flex flex-col border-r border-gray-300 bg-white z-10">
                    <div className="flex-1 flex flex-col border-b border-gray-200 overflow-hidden relative">
                        <PatternManager 
                            target="Warp"
                            patternString={warpPatternString}
                            onApply={onUpdateWarpPattern}
                            availableChars={Object.keys(warpYarns)}
                            colorMap={Object.fromEntries(Object.entries(warpYarns).map(([k, v]) => [k, (v as YarnDefinition).color]))}
                            onEditYarn={(char) => onEditYarn(char, 'warp')}
                            className="h-full border-none"
                            yarns={warpYarns}
                            onUpdateYarn={() => onUpdateDraft(draft)}
                            isScaled={isWarpScaled}
                            onToggleScale={onToggleWarpScale}
                        />
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        <PatternManager 
                            target="Weft"
                            patternString={weftPatternString}
                            onApply={onUpdateWeftPattern}
                            availableChars={Object.keys(weftYarns)}
                            colorMap={Object.fromEntries(Object.entries(weftYarns).map(([k, v]) => [k, (v as YarnDefinition).color]))}
                            onEditYarn={(char) => onEditYarn(char, 'weft')}
                            initialZones={weftZones}
                            totalPicks={settings.weftPicks}
                            className="h-full border-none"
                            yarns={weftYarns}
                            onUpdateYarn={() => onUpdatePegPlan(pegPlan)}
                            isScaled={isWeftScaled}
                            onToggleScale={onToggleWeftScale}
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden relative" ref={rightPanelRef}>
                    {rulerUnit !== 'none' && (
                        <>
                            <SVGRuler orientation="horizontal" viewportSize={rightPanelRef.current?.clientWidth || 1000} zoom={previewZoom} unit={rulerUnit as any} />
                            <SVGRuler orientation="vertical" viewportSize={rightPanelRef.current?.clientHeight || 1000} zoom={previewZoom} unit={rulerUnit as any} />
                        </>
                    )}

                    <div className="absolute top-8 right-8 z-40 flex flex-col gap-2">
                        <div className="flex items-center gap-1 bg-white/95 backdrop-blur shadow-xl rounded-lg p-1 border border-gray-200">
                            <button onClick={() => setPreviewZoom(z => Math.max(0.1, z - 0.1))} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors"><ZoomOutIcon className="w-4 h-4"/></button>
                            <span className="px-2 text-[10px] font-black font-mono w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                            <button onClick={() => setPreviewZoom(z => Math.min(10.0, z + 0.1))} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors"><ZoomInIcon className="w-4 h-4"/></button>
                            <div className="w-px h-4 bg-gray-200 mx-1"></div>
                            <button onClick={() => setPreviewZoom(1.0)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Reset Zoom to 100% (Actual Scale)"><ResetZoomIcon className="w-4 h-4"/></button>
                        </div>

                        <div className="flex bg-white/95 backdrop-blur shadow-xl rounded-lg p-1 border border-gray-200 self-end">
                            <button onClick={() => setRulerUnit('inch')} className={`px-2 py-1 text-[9px] font-black rounded transition-all ${rulerUnit === 'inch' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>IN</button>
                            <button onClick={() => setRulerUnit('cm')} className={`px-2 py-1 text-[9px] font-black rounded transition-all ${rulerUnit === 'cm' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>CM</button>
                            <button onClick={() => setRulerUnit('none')} className={`px-2 py-1 text-[9px] font-black rounded transition-all ${rulerUnit === 'none' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>OFF</button>
                        </div>
                    </div>

                    <canvas ref={drawdownCanvasRef} className="w-full h-full block" />
                    
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg border border-gray-200 shadow-lg text-[9px] font-black uppercase tracking-widest z-40">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Drawdown Preview Active</div>
                    </div>
                </div>
            </div>
        </div>
    );
};