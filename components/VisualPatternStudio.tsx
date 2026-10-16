import React, { useState, useEffect, useRef, useMemo } from 'react';
import { YarnDefinition, DensityZone } from '../types';
import { expandPatternString, compressPatternString } from '../utils/patternParser';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon } from './icons';

interface VisualPatternStudioProps {
    warpPatternString: string;
    weftPatternString: string;
    onUpdateWarpPattern: (str: string) => void;
    onUpdateWeftPattern: (str: string) => void;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    structure: boolean[][];
    activeYarnId: string;
    selectedYarnType?: 'warp' | 'weft';
    onSnapshot: () => void;
    epi: number;
    ppi: number;
    // Fix: Added missing properties to the interface as expected by DobbyMaster.tsx
    dentingPlan: number[];
    weftZones?: DensityZone[];
    onSelectYarn: (id: string, type: 'warp' | 'weft') => void;
    onDropWeaveOnYarn?: (weaveId: string, yarnId: string, type: 'warp' | 'weft') => void;
}

const ZOOM_STEPS = [0.03, 0.08, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0];

export const VisualPatternStudio: React.FC<VisualPatternStudioProps> = ({
    warpPatternString, weftPatternString, onUpdateWarpPattern, onUpdateWeftPattern,
    warpYarns, weftYarns, structure, activeYarnId, selectedYarnType, onSnapshot, epi, ppi,
    onSelectYarn, onDropWeaveOnYarn
}) => {
    // Default zoom level 5%
    const [scale, setScale] = useState(0.05); 
    const [localWarp, setLocalWarp] = useState<string[]>([]);
    const [localWeft, setLocalWeft] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [crosshair, setCrosshair] = useState<{ x: number, y: number } | null>(null);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalWarp(expandPatternString(warpPatternString));
        setLocalWeft(expandPatternString(weftPatternString));
    }, [warpPatternString, weftPatternString]);

    const getCellDimensions = useMemo(() => {
        const base = 28; 
        const cw = Math.max(0.01, base * scale);
        const ch = Math.max(0.01, base * (epi / ppi) * scale);
        return { cw, ch };
    }, [scale, epi, ppi]);

    const handleInteract = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const { cw, ch } = getCellDimensions;
        const margin = 10;
        const warpBarH = 28;
        const weftBarW = 28;
        const warpLeft = weftBarW + margin;
        const weftTop = warpBarH + margin;

        setCrosshair({ x, y });
        if (localWarp.length === 0 || localWeft.length === 0) return;
        if (e.buttons !== 1) return;

        // Click on Top Warp Bar
        if (y < warpBarH && x >= warpLeft) {
            const globalIndex = Math.floor((x - warpLeft) / cw);
            const index = globalIndex % localWarp.length;
            if (index >= 0 && localWarp[index] !== activeYarnId) {
                if (!isDragging) onSnapshot();
                const next = [...localWarp];
                next[index] = activeYarnId;
                setLocalWarp(next);
                onUpdateWarpPattern(compressPatternString(next));
            }
        }
        // Click on Left Weft Bar
        else if (x < weftBarW && y >= weftTop) {
            const globalIndex = Math.floor((y - weftTop) / ch);
            const index = globalIndex % localWeft.length;
            if (index >= 0 && localWeft[index] !== activeYarnId) {
                if (!isDragging) onSnapshot();
                const next = [...localWeft];
                next[index] = activeYarnId;
                setLocalWeft(next);
                onUpdateWeftPattern(compressPatternString(next));
            }
        }
        // Click inside the Main Drawdown / Interlacement Area
        else if (x >= warpLeft && y >= weftTop) {
            const colIdx = Math.floor((x - warpLeft) / cw) % localWarp.length;
            const rowIdx = Math.floor((y - weftTop) / ch) % localWeft.length;
            
            if (selectedYarnType === 'warp') {
                if (localWarp[colIdx] !== activeYarnId) {
                    if (!isDragging) onSnapshot();
                    const next = [...localWarp];
                    next[colIdx] = activeYarnId;
                    setLocalWarp(next);
                    onUpdateWarpPattern(compressPatternString(next));
                }
            } else if (selectedYarnType === 'weft') {
                if (localWeft[rowIdx] !== activeYarnId) {
                    if (!isDragging) onSnapshot();
                    const next = [...localWeft];
                    next[rowIdx] = activeYarnId;
                    setLocalWeft(next);
                    onUpdateWeftPattern(compressPatternString(next));
                }
            }
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleZoomIn = () => {
        const currentIdx = ZOOM_STEPS.findIndex(z => z >= scale);
        if (currentIdx === -1) return;
        const nextIdx = Math.min(ZOOM_STEPS.length - 1, currentIdx + (ZOOM_STEPS[currentIdx] > scale ? 0 : 1));
        setScale(ZOOM_STEPS[nextIdx]);
    };

    const handleZoomOut = () => {
        let currentIdx = -1;
        for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
            if (ZOOM_STEPS[i] <= scale) {
                currentIdx = i;
                break;
            }
        }
        const nextIdx = Math.max(0, currentIdx - (currentIdx >= 0 && ZOOM_STEPS[currentIdx] < scale ? 0 : 1));
        setScale(ZOOM_STEPS[nextIdx]);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || localWarp.length === 0 || localWeft.length === 0) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const { cw, ch } = getCellDimensions;
        const margin = 10;
        const warpBarH = 28;
        const weftBarW = 28;
        const warpLeft = weftBarW + margin;
        const weftTop = warpBarH + margin;

        const repeatW = localWarp.length * cw;
        const repeatH = localWeft.length * ch;

        const viewportW = containerRef.current?.clientWidth || 2000;
        const viewportH = containerRef.current?.clientHeight || 2000;
        const canvasW = Math.max(viewportW, repeatW * 2 + 500);
        const canvasH = Math.max(viewportH, repeatH * 2 + 500);

        canvas.width = canvasW;
        canvas.height = canvasH;
        
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // --- STEP 1: DRAW UNIT ---
        const unitCanvas = document.createElement('canvas');
        unitCanvas.width = Math.ceil(repeatW);
        unitCanvas.height = Math.ceil(repeatH);
        const uCtx = unitCanvas.getContext('2d');
        if (uCtx) {
            const sRows = structure.length;
            const sCols = structure[0]?.length || 1;
            for (let r = 0; r < localWeft.length; r++) {
                const weftColor = weftYarns[localWeft[r]]?.color || '#ccc';
                const y = r * ch;
                for (let c = 0; c < localWarp.length; c++) {
                    const warpColor = warpYarns[localWarp[c]]?.color || '#ccc';
                    const x = c * cw;
                    const isWarpUp = structure[r % sRows][c % sCols];
                    uCtx.fillStyle = isWarpUp ? warpColor : weftColor;
                    uCtx.fillRect(x, y, cw + 0.5, ch + 0.5);
                }
            }
        }

        // --- STEP 2: WARP BAR (NO BORDERS) ---
        const wBarCanvas = document.createElement('canvas');
        wBarCanvas.width = Math.ceil(repeatW);
        wBarCanvas.height = warpBarH;
        const wbCtx = wBarCanvas.getContext('2d');
        if (wbCtx) {
            localWarp.forEach((char, i) => {
                const x = i * cw;
                wbCtx.fillStyle = warpYarns[char]?.color || '#e5e7eb';
                wbCtx.fillRect(x, 0, cw + 0.5, warpBarH);
                if (scale > 0.5) {
                    wbCtx.fillStyle = 'rgba(255,255,255,0.4)';
                    wbCtx.font = 'bold 8px monospace';
                    wbCtx.textAlign = 'center';
                    wbCtx.fillText(char, x + cw/2, warpBarH - 4);
                }
            });
        }

        // --- STEP 3: WEFT BAR (NO BORDERS) ---
        const hBarCanvas = document.createElement('canvas');
        hBarCanvas.width = weftBarW;
        hBarCanvas.height = Math.ceil(repeatH);
        const hbCtx = hBarCanvas.getContext('2d');
        if (hbCtx) {
            localWeft.forEach((char, i) => {
                const y = i * ch;
                hbCtx.fillStyle = weftYarns[char]?.color || '#e5e7eb';
                hbCtx.fillRect(0, y, weftBarW, ch + 0.5);
                if (scale > 0.5) {
                    hbCtx.fillStyle = 'rgba(255,255,255,0.4)';
                    hbCtx.font = 'bold 8px monospace';
                    hbCtx.textAlign = 'center';
                    hbCtx.fillText(char, weftBarW/2, y + ch/2 + 3);
                }
            });
        }

        const fabricPattern = ctx.createPattern(unitCanvas, 'repeat');
        if (fabricPattern) {
            ctx.save();
            ctx.translate(warpLeft, weftTop);
            ctx.fillStyle = fabricPattern;
            ctx.fillRect(0, 0, canvasW - warpLeft, canvasH - weftTop);
            ctx.restore();
        }

        const wPattern = ctx.createPattern(wBarCanvas, 'repeat-x');
        if (wPattern) {
            ctx.save();
            ctx.translate(warpLeft, 0);
            ctx.fillStyle = wPattern;
            ctx.fillRect(0, 0, canvasW - warpLeft, warpBarH);
            ctx.restore();
        }

        const hPattern = ctx.createPattern(hBarCanvas, 'repeat-y');
        if (hPattern) {
            ctx.save();
            ctx.translate(0, weftTop);
            ctx.fillStyle = hPattern;
            ctx.fillRect(0, 0, weftBarW, canvasH - weftTop);
            ctx.restore();
        }

        // Repeat indicator
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(warpLeft, weftTop, repeatW, repeatH);

        if (crosshair) {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(crosshair.x, 0); ctx.lineTo(crosshair.x, canvasH);
            ctx.moveTo(0, crosshair.y); ctx.lineTo(canvasW, crosshair.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

    }, [localWarp, localWeft, structure, scale, warpYarns, weftYarns, crosshair, getCellDimensions]);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative" ref={containerRef}>
            <div className="flex-1 overflow-auto custom-scrollbar bg-gray-100/50">
                <canvas 
                    ref={canvasRef}
                    onMouseDown={(e) => { setIsDragging(true); handleInteract(e); }}
                    onMouseMove={handleInteract}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { setCrosshair(null); handleMouseUp(); }}
                    className="cursor-crosshair shadow-sm bg-white"
                    style={{ imageRendering: 'pixelated' }}
                />
            </div>

            {/* Consistent Zoom Bar Placement (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-50 flex items-center gap-1 bg-white/90 backdrop-blur p-1.5 rounded-lg border border-gray-200 shadow-lg">
                <button onClick={handleZoomOut} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Zoom Out"><ZoomOutIcon className="w-4 h-4"/></button>
                <div className="px-2 text-[10px] font-bold text-gray-400 min-w-[3rem] text-center">{Math.round(scale * 100)}%</div>
                <button onClick={handleZoomIn} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Zoom In"><ZoomInIcon className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button onClick={() => setScale(0.05)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Reset Zoom"><ResetZoomIcon className="w-4 h-4"/></button>
            </div>

            <div className="bg-white border-t border-gray-200 px-6 py-1.5 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider shrink-0">
                <div className="flex gap-6">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 border-2 border-red-500 rounded-xs"></div> <span>Editable Primary Unit</span></div>
                    <span>{localWarp.length} Ends × {localWeft.length} Picks</span>
                    <div className="flex items-center gap-1.5"><span>Aspect Ratio (EPI:PPI): 1:{ (epi/ppi).toFixed(2) }</span></div>
                </div>
                <span className="text-gray-300 italic text-[8px]">Selection Sync: {activeYarnId} ({selectedYarnType})</span>
            </div>
        </div>
    );
};