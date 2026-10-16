import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback, MouseEvent } from 'react';
import { InteractiveGrid } from './InteractiveGrid';
import { RulerUnit, ViewMode, FaceMode, ToolType, DensityZone, YarnDefinition, LayoutCorner, EditMode, WeaveSettings } from '../types';
import { CrossSection } from './CrossSection';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, HandIcon, TableIcon, RulerIcon } from './icons';
import { compressPatternString } from '../utils/patternParser';

interface WeaveAreaProps {
  draft: boolean[][];
  pegPlan: boolean[][];
  warpPattern: string[]; // Colors
  weftPattern: string[]; // Colors
  weavePattern: string[][];
  structure: boolean[][]; 
  dentingGrid?: string[][];
  handleDraftInteraction: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  handlePegPlanInteraction: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  handleDrawdownInteraction: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  handleWarpColorInteraction?: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  handleWeftColorInteraction?: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  handleDentingInteraction?: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  pegPlanActiveColor: string;
  draftActiveColor: string;
  currentTool: ToolType;
  gridDivision: number;
  viewMode: ViewMode;
  faceMode: FaceMode;
  epi: number;
  ppi: number;
  warpRepeat: number;
  weftRepeat: number;
  showHeaders?: boolean;
  showGrid?: boolean;
  weftZones?: DensityZone[]; 
  initialScale?: number;
  warpYarns?: { [key: string]: YarnDefinition };
  weftYarns?: { [key: string]: YarnDefinition };
  warpYarnSequence?: string[];
  weftYarnSequence?: string[];
  layoutCorner?: LayoutCorner;
  gridRepeatW?: number;
  gridRepeatP?: number;
  onUpdatePegPlan?: (newPeg: boolean[][]) => void;
  onUpdateDraft?: (newDraft: boolean[][]) => void;
  onUpdateSettings?: (settings: WeaveSettings) => void;
  onSnapshot?: () => void;
  settings?: WeaveSettings;
  onUpdateWarpPattern?: (newPattern: string) => void;
  onUpdateWeftPattern?: (newPattern: string) => void;
  activeSelection?: [number, number, number, number] | null;
  activeGrid?: 'draft' | 'peg' | 'drawdown' | null;
  previewShape?: { type: 'line' | 'rect' | 'circle', startR: number, startC: number, endR: number, endC: number } | null;
}

const Ruler: React.FC<{
    orientation: 'horizontal' | 'vertical';
    lengthPixels: number; 
    scrollPos: number; 
    unit: RulerUnit;
    ppi: number; 
    scale: number;
    isReversed?: boolean; 
    totalContentPx: number; 
    isBottom?: boolean;
}> = ({ orientation, lengthPixels, scrollPos, unit, ppi, scale, isReversed, totalContentPx, isBottom }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const size = 24; 
        
        if (orientation === 'horizontal') {
            canvas.width = lengthPixels * dpr;
            canvas.height = size * dpr;
            canvas.style.width = `${lengthPixels}px`;
            canvas.style.height = `${size}px`;
        } else {
            canvas.width = size * dpr;
            canvas.height = lengthPixels * dpr;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${lengthPixels}px`;
        }
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, orientation === 'horizontal' ? lengthPixels : size, orientation === 'horizontal' ? size : lengthPixels);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 9px monospace';
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;

        const pixelsPerThread = 20 * scale;
        let pixelsPerMajor = pixelsPerThread * 10; 
        let labelFactor = 10; 
        
        if (unit === 'inch') {
            pixelsPerMajor = pixelsPerThread * ppi; 
            labelFactor = 1;
        } else if (unit === 'cm') {
            pixelsPerMajor = (pixelsPerThread * ppi) / 2.54; 
            labelFactor = 1;
        }

        const startWorld = Math.floor(scrollPos / pixelsPerMajor);
        const endWorld = Math.floor((scrollPos + lengthPixels) / pixelsPerMajor);
        
        for (let i = startWorld; i <= endWorld + 1; i++) {
            const worldPos = i * pixelsPerMajor;
            const screenPos = worldPos - scrollPos;
            
            let displayValue = i * labelFactor;
            if (isReversed) {
                const valAtPos = Math.round((totalContentPx - worldPos) / pixelsPerMajor);
                displayValue = valAtPos * labelFactor;
                if (displayValue < 0) continue;
            }

            if (orientation === 'horizontal') {
                ctx.beginPath();
                if (isBottom) {
                    ctx.moveTo(screenPos, 0);
                    ctx.lineTo(screenPos, 8);
                } else {
                    ctx.moveTo(screenPos, size);
                    ctx.lineTo(screenPos, size - 8);
                }
                ctx.stroke();
                if (i >= 0) ctx.fillText(`${displayValue}`, screenPos + 2, isBottom ? 18 : 12);
            } else {
                ctx.beginPath();
                ctx.moveTo(size, screenPos);
                ctx.lineTo(size - 8, screenPos);
                ctx.stroke();
                if (i >= 0) {
                     ctx.save();
                     ctx.translate(12, screenPos + 10);
                     ctx.rotate(-Math.PI / 2);
                     ctx.fillText(`${displayValue}`, 0, 0);
                     ctx.restore();
                }
            }
        }
    }, [orientation, lengthPixels, scrollPos, unit, ppi, scale, isReversed, totalContentPx, isBottom]);

    return <canvas ref={canvasRef} className="bg-gray-50 border-gray-200 pointer-events-none block" />;
}

export const WeaveArea: React.FC<WeaveAreaProps> = ({
    draft, pegPlan, warpPattern, weftPattern, weavePattern, structure, dentingGrid,
    handleDraftInteraction, handlePegPlanInteraction, handleDrawdownInteraction,
    handleWarpColorInteraction, handleWeftColorInteraction, handleDentingInteraction,
    pegPlanActiveColor, draftActiveColor, currentTool, gridDivision, viewMode, faceMode,
    epi, ppi, warpRepeat, weftRepeat, showHeaders = true, showGrid = true,
    weftZones = [], initialScale = 1.0, warpYarns = {}, weftYarns = {},
    warpYarnSequence = [], weftYarnSequence = [], layoutCorner = 'TL',
    onUpdatePegPlan, onUpdateDraft, onUpdateSettings, onSnapshot, settings,
    onUpdateWarpPattern, onUpdateWeftPattern,
    activeSelection = null, activeGrid = null, previewShape = null
}) => {
    const [scale, setScale] = useState(initialScale);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [editMode, setEditMode] = useState<EditMode>('pointer');
    const [kbActiveGrid, setKbActiveGrid] = useState<'draft' | 'peg' | 'denting' | 'warpColor' | 'weftColor'>('peg');
    const [kbCursor, setKbCursor] = useState({ r: 0, c: 0 }); 
    const [cursorPulse, setCursorPulse] = useState(true);

    const isBL = layoutCorner === 'BL';
    const pegOnLeft = layoutCorner === 'TL' || layoutCorner === 'BL';

    // --- GRID CONTEXTS FOR CROSS-GRID GUIDES AND CURSOR ---
    const gridContexts = useMemo(() => {
        const isKb = editMode === 'keyboard';
        const cur = kbCursor;
        const act = kbActiveGrid;

        return {
            denting: {
                cursorR: (isKb && act === 'denting') ? cur.r : null,
                cursorC: (isKb && act === 'denting') ? cur.c : null,
                guideC: (isKb && (act === 'draft' || act === 'warpColor')) ? cur.c : null,
            },
            draft: {
                cursorR: (isKb && act === 'draft') ? cur.r : null,
                cursorC: (isKb && act === 'draft') ? cur.c : null,
                guideR: (isKb && act === 'peg') ? cur.c : null, // Peg Col is harness index
                guideC: (isKb && (act === 'denting' || act === 'warpColor')) ? cur.c : null,
            },
            warpC: {
                cursorR: (isKb && act === 'warpColor') ? cur.r : null,
                cursorC: (isKb && act === 'warpColor') ? cur.c : null,
                guideC: (isKb && (act === 'draft' || act === 'denting')) ? cur.c : null,
            },
            peg: {
                cursorR: (isKb && act === 'peg') ? (isBL ? (weftRepeat - 1 - cur.r) : cur.r) : null,
                cursorC: (isKb && act === 'peg') ? cur.c : null,
                guideR: (isKb && act === 'weftColor') ? (isBL ? (weftRepeat - 1 - cur.r) : cur.r) : null,
                guideC: (isKb && act === 'draft') ? cur.r : null, // Draft Row is harness index
            },
            weftC: {
                cursorR: (isKb && act === 'weftColor') ? (isBL ? (weftRepeat - 1 - cur.r) : cur.r) : null,
                cursorC: (isKb && act === 'weftColor') ? cur.c : null,
                guideR: (isKb && act === 'peg') ? (isBL ? (weftRepeat - 1 - cur.r) : cur.r) : null,
            }
        };
    }, [editMode, kbCursor, kbActiveGrid, isBL, weftRepeat]);

    const [hoverStatus, setHoverStatus] = useState<{ zone: string; x: number | null; y: number | null }>({
        zone: 'IDLE',
        x: null,
        y: null
    });

    useEffect(() => {
        if (editMode !== 'keyboard') return;
        const interval = setInterval(() => setCursorPulse(p => !p), 450);
        return () => clearInterval(interval);
    }, [editMode]);

    const warpYarnChars = useMemo(() => Object.keys(warpYarns).sort(), [warpYarns]);
    const weftYarnChars = useMemo(() => Object.keys(weftYarns).sort(), [weftYarns]);
    const numWarpYarnChoices = warpYarnChars.length || 1;
    const numWeftYarnChoices = weftYarnChars.length || 1;

    const handleWrappedWarpColorInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
        if (!handleWarpColorInteraction || type !== 'down') return;
        const yarnChar = warpYarnChars[row];
        if (!yarnChar) return;
        onSnapshot?.();
        const next = [...(warpYarnSequence || [])];
        while (next.length < warpRepeat) next.push(next[next.length % (next.length || 1)] || 'A');
        next[col % warpRepeat] = yarnChar;
        onUpdateWarpPattern?.(compressPatternString(next));
    };

    const handleWrappedWeftColorInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
        if (!handleWeftColorInteraction || type !== 'down') return;
        const actualRow = isBL ? (weftRepeat - 1 - row) : row;
        const yarnChar = weftYarnChars[col];
        if (!yarnChar) return;
        onSnapshot?.();
        const next = [...(weftYarnSequence || [])];
        while (next.length < weftRepeat) next.push(next[next.length % (next.length || 1)] || 'A');
        next[actualRow % weftRepeat] = yarnChar;
        onUpdateWeftPattern?.(compressPatternString(next));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (editMode !== 'keyboard') return;
        if (e.key === 'Tab') {
            e.preventDefault();
            const order: ('peg' | 'draft' | 'denting' | 'warpColor' | 'weftColor')[] = ['peg', 'draft', 'denting', 'warpColor', 'weftColor'];
            const nextIdx = (order.indexOf(kbActiveGrid) + 1) % order.length;
            setKbActiveGrid(order[nextIdx]);
            setKbCursor({ r: 0, c: 0 }); 
            setCursorPulse(true);
            return;
        }
        let numRows = 0, numCols = 0;
        if (kbActiveGrid === 'draft') { numRows = draft.length; numCols = draft[0]?.length || 0; } 
        else if (kbActiveGrid === 'peg') { numRows = pegPlan.length; numCols = pegPlan[0]?.length || 0; } 
        else if (kbActiveGrid === 'denting') { numRows = 2; numCols = warpRepeat; } 
        else if (kbActiveGrid === 'warpColor') { numRows = numWarpYarnChoices; numCols = warpRepeat; } 
        else if (kbActiveGrid === 'weftColor') { numRows = weftRepeat; numCols = numWeftYarnChoices; }
        const step = e.shiftKey ? 8 : 1;
        let { r, c } = kbCursor;
        if (e.key === 'ArrowUp') { e.preventDefault(); r = Math.max(0, r - step); } 
        else if (e.key === 'ArrowDown') { e.preventDefault(); r = Math.min(numRows - 1, r + step); } 
        else if (e.key === 'ArrowLeft') { e.preventDefault(); c = Math.max(0, c - step); } 
        else if (e.key === 'ArrowRight') { e.preventDefault(); c = Math.min(numCols - 1, c + step); } 
        else if (e.key === ' ') {
            e.preventDefault();
            if (kbActiveGrid === 'draft') { handleDraftInteraction(r, c, 'down'); handleDraftInteraction(r, c, 'up'); } 
            else if (kbActiveGrid === 'peg') { handlePegPlanInteraction(r, c, 'down'); handlePegPlanInteraction(r, c, 'up'); } 
            else if (kbActiveGrid === 'denting') { handleDentingInteraction?.(r, c, 'down'); handleDentingInteraction?.(r, c, 'up'); } 
            else if (kbActiveGrid === 'warpColor') { handleWrappedWarpColorInteraction(r, c, 'down'); } 
            else if (kbActiveGrid === 'weftColor') { handleWrappedWeftColorInteraction(r, c, 'down'); }
        }
        if (r !== kbCursor.r || c !== kbCursor.c) { setKbCursor({ r, c }); setCursorPulse(true); }
    };

    const extraWarpMap = useMemo(() => (warpYarnSequence || []).map(id => warpYarns[id]?.isExtraWarp || false), [warpYarnSequence, warpYarns]);
    const extraWeftMap = useMemo(() => (weftYarnSequence || []).map(id => weftYarns[id]?.isExtraWeft || false), [weftYarnSequence, weftYarns]);

    const warpColorGridData = useMemo(() => warpYarnChars.map(char => {
        const row: string[] = [];
        for (let c = 0; c < warpRepeat; c++) {
            const assigned = (warpYarnSequence || [])[c % ((warpYarnSequence || []).length || 1)];
            row.push(assigned === char ? warpYarns[char]?.color : 'transparent');
        }
        return row;
    }), [warpYarnChars, warpYarnSequence, warpRepeat, warpYarns]);

    const weftColorGridData = useMemo(() => {
        const grid = Array.from({ length: weftRepeat }, () => Array(numWeftYarnChoices).fill('transparent'));
        for (let r = 0; r < weftRepeat; r++) {
            const assigned = (weftYarnSequence || [])[r % ((weftYarnSequence || []).length || 1)];
            const charIdx = weftYarnChars.indexOf(assigned);
            if (charIdx !== -1) grid[r][charIdx] = weftYarns[assigned]?.color;
        }
        return grid;
    }, [weftYarnChars, weftYarnSequence, weftRepeat, weftYarns, numWeftYarnChoices]);

    useLayoutEffect(() => {
        if (isBL && containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, [isBL, showHeaders]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) { e.preventDefault(); const delta = e.deltaY * -0.001; setScale(prev => Math.min(Math.max(prev + delta, 0.1), 5)); }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        setScrollPos({ x: target.scrollLeft, y: target.scrollTop });
    };

    useEffect(() => {
        const updateSize = () => { if (containerRef.current) setViewportSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const cellSize = Math.max(1, 20 * scale);
    const numHarnesses = draft.length;
    const numWarpThreads = warpPattern.length;
    const numWeftPicks = weftPattern.length;
    const totalDrawdownWidth = numWarpThreads * cellSize;
    const totalDrawdownHeight = numWeftPicks * cellSize;
    const headerH = numHarnesses * cellSize;
    const headerW = numHarnesses * cellSize;
    const dentingH = 2 * cellSize; 
    const warpColorBarH = numWarpYarnChoices * cellSize;
    const weftColorBarW = numWeftYarnChoices * cellSize;
    const margin = 20;
    const contentPaddingBottom = 100;
    const gap = 15;
    const totalContentHeight = totalDrawdownHeight + headerH + dentingH + warpColorBarH + contentPaddingBottom + 200;

    let dentingTop: number, draftTop: number, colorBarTop: number, drawdownTop: number;
    if (isBL) {
        const baseBottom = totalContentHeight - contentPaddingBottom;
        dentingTop = baseBottom - dentingH;
        draftTop = dentingTop - 15 - headerH;
        colorBarTop = draftTop - 10 - warpColorBarH;
        drawdownTop = colorBarTop - 25 - totalDrawdownHeight;
    } else {
        dentingTop = margin;
        draftTop = dentingTop + dentingH + 15;
        colorBarTop = draftTop + headerH + 10;
        drawdownTop = colorBarTop + warpColorBarH + 25;
    }

    let pegLeft: number, weftBarLeft: number, contentLeft: number;
    if (pegOnLeft) {
        pegLeft = margin;
        weftBarLeft = showHeaders ? (pegLeft + headerW + gap) : margin;
        contentLeft = weftBarLeft + weftColorBarW + gap;
    } else {
        contentLeft = margin;
        weftBarLeft = contentLeft + totalDrawdownWidth + gap;
        pegLeft = weftBarLeft + weftColorBarW + gap;
    }

    const drawdownData = useMemo(() => {
        let base;
        if (viewMode === 'interlace') base = weavePattern;
        else if (faceMode === 'face') base = structure;
        else base = structure.map(row => row.map(cell => !cell));
        if (isBL) return base.slice().reverse();
        return base;
    }, [viewMode, faceMode, weavePattern, structure, isBL]);

    const displayWeftColorGrid = useMemo(() => isBL ? weftColorGridData.slice().reverse() : weftColorGridData, [weftColorGridData, isBL]);

    const wrappedHandleDrawdown = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
        const actualRow = isBL ? (numWeftPicks - 1 - row) : row;
        handleDrawdownInteraction(actualRow, col, type);
    };

    const adaptiveShowGrid = showGrid && scale >= 0.4;

    const ppiLabels = useMemo(() => {
        const labels: { y: number, text: string, color?: string }[] = [];
        let lastPPI = -1;
        for (let i = 0; i < numWeftPicks; i++) {
            const zone = weftZones.find(z => i >= z.startPick && i <= z.endPick);
            const currentPPI = zone ? zone.ppi : ppi;
            if (currentPPI !== lastPPI) {
                labels.push({ y: isBL ? (numWeftPicks - 1 - i) * cellSize : i * cellSize, text: `${currentPPI}`, color: zone?.color });
                lastPPI = currentPPI;
            }
        }
        return labels;
    }, [weftZones, ppi, numWeftPicks, cellSize, isBL]);

    const horizontalRuler = (
        <div className={`h-6 shrink-0 flex flex-row ${isBL ? 'border-t border-gray-200' : 'border-b border-gray-200'}`}>
            <div className="flex-1 overflow-hidden relative" style={{ marginLeft: contentLeft }}>
                 <Ruler orientation="horizontal" lengthPixels={viewportSize.width} scrollPos={scrollPos.x} unit="thread" ppi={ppi} scale={scale} totalContentPx={totalDrawdownWidth} isBottom={isBL} />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-100 overflow-hidden relative outline-none" onWheel={handleWheel} onKeyDown={handleKeyDown} tabIndex={0} ref={(node) => { if (node && editMode === 'keyboard') node.focus(); }}>
            
            <div className="absolute bottom-4 right-4 z-50 flex items-center gap-1 bg-white/90 backdrop-blur p-1.5 rounded-lg border border-gray-200 shadow-lg">
                <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200 mr-2">
                    <button onClick={() => setEditMode('pointer')} className={`p-1.5 rounded transition-all flex items-center gap-1.5 ${editMode === 'pointer' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="Pointer Mode (Mouse)"><HandIcon className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-tighter pr-1">Pointer</span></button>
                    <button onClick={() => { setEditMode('keyboard'); setKbActiveGrid('peg'); setKbCursor({r:0, c:0}); }} className={`p-1.5 rounded transition-all flex items-center gap-1.5 ${editMode === 'keyboard' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="Keyboard Mode (Arrows)"><TableIcon className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-tighter pr-1">Keyboard</span></button>
                </div>
                <div className="w-px h-4 bg-gray-200 mr-1"></div>
                <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomOutIcon className="w-4 h-4"/></button>
                <div className="px-2 flex items-center text-[10px] font-bold text-gray-500 min-w-[3rem] justify-center">{Math.round(scale * 100)}%</div>
                <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomInIcon className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button onClick={() => setScale(1.0)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ResetZoomIcon className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 flex flex-row min-h-0 min-w-0">
                <div className="w-6 shrink-0 flex flex-col pt-[24px]">
                     <div className="flex-1 overflow-hidden relative border-r border-gray-200"><Ruler orientation="vertical" lengthPixels={viewportSize.height} scrollPos={scrollPos.y - (showHeaders ? drawdownTop : margin)} unit="thread" ppi={ppi} scale={scale} isReversed={isBL} totalContentPx={totalDrawdownHeight} /></div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    {!isBL && horizontalRuler}

                    <div className="flex-1 overflow-auto custom-scrollbar" onScroll={handleScroll} ref={containerRef} onMouseLeave={() => setHoverStatus({ zone: 'IDLE', x: null, y: null })}>
                        <div className="relative bg-white" style={{ width: contentLeft + totalDrawdownWidth + 200, height: isBL ? totalContentHeight : (totalDrawdownHeight + (showHeaders ? drawdownTop + 100 : 100)) }}>
                            
                            <div 
                                className="absolute" 
                                style={{ top: showHeaders ? drawdownTop : (isBL ? totalContentHeight - contentPaddingBottom - totalDrawdownHeight : margin), left: contentLeft }}
                                onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'FABRIC' }))}
                            >
                                <div className="border border-gray-300 shadow-sm bg-white">
                                    <InteractiveGrid 
                                        data={drawdownData} isColorGrid={viewMode === 'interlace'} activeColor={pegPlanActiveColor} gridDivision={gridDivision} width={totalDrawdownWidth} height={totalDrawdownHeight} renderRows={numWeftPicks} renderCols={numWarpThreads} showGrid={adaptiveShowGrid} rowZones={isBL ? [...weftZones].reverse() : weftZones} extraRows={isBL ? [...extraWeftMap].reverse() : extraWeftMap} extraCols={extraWarpMap}
                                        onCellInteraction={(r, c, t) => { if (editMode === 'pointer') wrappedHandleDrawdown(r, c, t); setHoverStatus({ zone: 'FABRIC', x: c, y: isBL ? numWeftPicks - 1 - r : r }); }}
                                    />
                                </div>
                            </div>

                            {showHeaders && dentingGrid && (
                                <div 
                                    className="absolute" style={{ top: dentingTop, left: contentLeft }}
                                    onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'REED' }))}
                                >
                                    <div className="border border-gray-300 shadow-sm bg-white">
                                        <InteractiveGrid 
                                            data={dentingGrid} isColorGrid gridDivision={gridDivision} width={totalDrawdownWidth} height={dentingH} renderRows={2} renderCols={numWarpThreads} cursorRow={gridContexts.denting.cursorR} cursorCol={gridContexts.denting.cursorC} guideCol={gridContexts.denting.guideC} pulseCursor={editMode === 'keyboard' && kbActiveGrid === 'denting' && cursorPulse} showGrid={adaptiveShowGrid}
                                            onCellInteraction={(r, c, t) => { if (editMode === 'pointer') handleDentingInteraction?.(r, c, t); setHoverStatus({ zone: 'REED', x: c, y: r }); }}
                                        />
                                    </div>
                                    <div className="absolute -left-10 top-0 bottom-0 flex items-center"><span className={`text-[7px] font-bold uppercase tracking-tighter rotate-180 [writing-mode:vertical-lr] transition-colors ${editMode === 'keyboard' && kbActiveGrid === 'denting' ? 'text-blue-600' : 'text-gray-400'}`}>Reed</span></div>
                                </div>
                            )}

                            {showHeaders && (
                                <div 
                                    className="absolute" style={{ top: draftTop, left: contentLeft }}
                                    onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'DRAFTING' }))}
                                >
                                    <div className="border border-gray-300 shadow-sm bg-white">
                                        <InteractiveGrid 
                                            data={draft} gridDivision={gridDivision} width={totalDrawdownWidth} height={headerH} renderRows={numHarnesses} renderCols={numWarpThreads} activeColor={draftActiveColor} cursorRow={gridContexts.draft.cursorR} cursorCol={gridContexts.draft.cursorC} guideRow={gridContexts.draft.guideR} guideCol={gridContexts.draft.guideC} pulseCursor={editMode === 'keyboard' && kbActiveGrid === 'draft' && cursorPulse} showGrid={adaptiveShowGrid} extraCols={extraWarpMap}
                                            onCellInteraction={(r, c, t) => { if (editMode === 'pointer') handleDraftInteraction(r, c, t); setHoverStatus({ zone: 'DRAFTING', x: c, y: r }); }}
                                            selectionRect={activeGrid === 'draft' ? activeSelection : null}
                                            previewShape={hoverStatus.zone === 'DRAFTING' ? previewShape : null}
                                        />
                                    </div>
                                    <div className="absolute -left-10 top-0 bottom-0 flex items-center"><span className={`text-[7px] font-bold uppercase tracking-tighter rotate-180 [writing-mode:vertical-lr] transition-colors ${editMode === 'keyboard' && kbActiveGrid === 'draft' ? 'text-blue-600' : 'text-gray-400'}`}>Draft</span></div>
                                </div>
                            )}

                            <div 
                                className="absolute border border-gray-300 bg-white shadow-sm" style={{ top: colorBarTop, left: contentLeft, width: totalDrawdownWidth, height: warpColorBarH }}
                                onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'WARP PALETTE' }))}
                            >
                                <InteractiveGrid 
                                    data={warpColorGridData} isColorGrid width={totalDrawdownWidth} height={warpColorBarH} renderRows={numWarpYarnChoices} renderCols={numWarpThreads} cursorRow={gridContexts.warpC.cursorR} cursorCol={gridContexts.warpC.cursorC} guideCol={gridContexts.warpC.guideC} pulseCursor={editMode === 'keyboard' && kbActiveGrid === 'warpColor' && cursorPulse} showGrid={adaptiveShowGrid} 
                                    onCellInteraction={(r, c, t) => { if (editMode === 'pointer') handleWrappedWarpColorInteraction(r, c, t); setHoverStatus({ zone: 'WARP PALETTE', x: c, y: r }); }}
                                />
                                <div className="absolute -left-10 top-0 bottom-0 flex items-center"><span className={`text-[7px] font-bold uppercase tracking-tighter rotate-180 [writing-mode:vertical-lr] transition-colors ${editMode === 'keyboard' && kbActiveGrid === 'warpColor' ? 'text-blue-600' : 'text-gray-400'}`}>Warp Palette</span></div>
                            </div>

                            {showHeaders && (
                                <div 
                                    className="absolute" style={{ top: drawdownTop, left: pegLeft }}
                                    onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'PEG PLAN' }))}
                                >
                                    <div className="relative">
                                        <div className="border border-gray-300 shadow-sm bg-white">
                                            <InteractiveGrid 
                                                data={isBL ? pegPlan.slice().reverse() : pegPlan} gridDivision={gridDivision} width={headerW} height={totalDrawdownHeight} renderRows={numWeftPicks} renderCols={numHarnesses} activeColor={pegPlanActiveColor} cursorRow={gridContexts.peg.cursorR} cursorCol={gridContexts.peg.cursorC} guideRow={gridContexts.peg.guideR} guideCol={gridContexts.peg.guideC} pulseCursor={editMode === 'keyboard' && kbActiveGrid === 'peg' && cursorPulse} showGrid={adaptiveShowGrid} extraRows={isBL ? [...extraWeftMap].reverse() : extraWeftMap}
                                                onCellInteraction={(r,c,t) => { const actualR = isBL ? (numWeftPicks - 1 - r) : r; if (editMode === 'pointer') handlePegPlanInteraction(actualR, c, t); setHoverStatus({ zone: 'PEG PLAN', x: c, y: actualR }); }}
                                                selectionRect={activeGrid === 'peg' ? activeSelection : null}
                                                previewShape={hoverStatus.zone === 'PEG PLAN' ? previewShape : null}
                                            />
                                        </div>
                                    </div>
                                    <div className={`mt-1 text-center transition-colors ${editMode === 'keyboard' && kbActiveGrid === 'peg' ? 'text-blue-600 font-black' : 'text-gray-400'}`}><span className="text-[7px] font-bold uppercase tracking-widest">Lift</span></div>
                                </div>
                            )}

                            <div 
                                className="absolute border border-gray-300 bg-white shadow-sm" style={{ top: showHeaders ? drawdownTop : (isBL ? totalContentHeight - contentPaddingBottom - totalDrawdownHeight : margin), left: weftBarLeft, width: weftColorBarW, height: totalDrawdownHeight }}
                                onMouseEnter={() => setHoverStatus(prev => ({ ...prev, zone: 'WEFT PALETTE' }))}
                            >
                                <InteractiveGrid 
                                    data={displayWeftColorGrid} isColorGrid width={weftColorBarW} height={totalDrawdownHeight} renderRows={numWeftPicks} renderCols={numWeftYarnChoices} cursorRow={gridContexts.weftC.cursorR} cursorCol={gridContexts.weftC.cursorC} guideRow={gridContexts.weftC.guideR} pulseCursor={editMode === 'keyboard' && kbActiveGrid === 'weftColor' && cursorPulse} showGrid={adaptiveShowGrid} rowZones={isBL ? [...weftZones].reverse() : weftZones}
                                    onCellInteraction={(r, c, t) => { if (editMode === 'pointer') handleWrappedWeftColorInteraction(r, c, t); setHoverStatus({ zone: 'WEFT PALETTE', x: c, y: isBL ? numWeftPicks - 1 - r : r }); }}
                                />
                                <div className="absolute pointer-events-none" style={{ top: 0, left: weftColorBarW + 4, width: 40, height: '100%' }}>
                                    {ppiLabels.map((l, i) => (<div key={i} className="absolute left-0 text-[8px] font-black font-mono leading-none flex items-center gap-1 bg-white/60 backdrop-blur-[1px] px-1 rounded-sm" style={{ top: l.y + 2, color: l.color || '#64748b' }}><div className="w-1.5 h-px bg-current opacity-30"></div><span>{l.text} <span className="opacity-40 font-normal">PPI</span></span></div>))}
                                </div>
                                <div className="absolute top-full left-0 right-0 pt-1 text-center"><span className={`text-[7px] font-bold uppercase tracking-widest transition-colors ${editMode === 'keyboard' && kbActiveGrid === 'weftColor' ? 'text-blue-600' : 'text-gray-400'}`}>Weft Palette</span></div>
                            </div>
                        </div>
                    </div>
                    {isBL && horizontalRuler}
                </div>
            </div>
        </div>
    );
};