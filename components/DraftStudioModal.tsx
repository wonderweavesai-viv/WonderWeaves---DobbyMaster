
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InteractiveGrid } from './InteractiveGrid';
import { TrashIcon, InvertIcon, ShiftUpIcon, ShiftDownIcon, ShiftLeftIcon, ShiftRightIcon, CopyIcon, PlusIcon, FlipIcon, RulerIcon, CheckIcon, PencilIcon } from './icons';

interface DraftStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    draft: boolean[][];
    dentingPlan: number[];
    harnesses: number;
    warpThreads: number;
    onSave: (draft: boolean[][], denting: number[], newWarpThreads: number) => void;
}

const Ruler: React.FC<{
    orientation: 'horizontal' | 'vertical';
    length: number;
    scrollPos: number;
    cellSize: number;
}> = ({ orientation, length, scrollPos, cellSize }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const thickness = 24;
        
        if (orientation === 'horizontal') {
            canvas.width = length * dpr;
            canvas.height = thickness * dpr;
            canvas.style.width = `${length}px`;
            canvas.style.height = `${thickness}px`;
        } else {
            canvas.width = thickness * dpr;
            canvas.height = length * dpr;
            canvas.style.width = `${thickness}px`;
            canvas.style.height = `${length}px`;
        }

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, orientation === 'horizontal' ? length : thickness, orientation === 'horizontal' ? thickness : length);
        
        ctx.strokeStyle = '#374151';
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';

        const startIdx = Math.floor(scrollPos / cellSize);
        const endIdx = startIdx + Math.ceil(length / cellSize) + 1;

        for (let i = startIdx; i <= endIdx; i++) {
            const pos = (i * cellSize) - scrollPos;
            if (orientation === 'horizontal') {
                ctx.beginPath();
                if (i >= 0) {
                    ctx.moveTo(pos, thickness);
                    ctx.lineTo(pos, thickness - (i % 4 === 0 ? 10 : 5));
                    ctx.stroke();
                    if (i % 4 === 0 && i > 0) ctx.fillText(i.toString(), pos, 12);
                }
            } else {
                ctx.beginPath();
                if (i >= 0) {
                    ctx.moveTo(thickness, pos);
                    ctx.lineTo(thickness - (i % 4 === 0 ? 10 : 5), pos);
                    ctx.stroke();
                    if (i % 4 === 0 && i > 0) {
                        ctx.save();
                        ctx.translate(10, pos);
                        ctx.rotate(-Math.PI / 2);
                        ctx.fillText(i.toString(), 0, 0);
                        ctx.restore();
                    }
                }
            }
        }
    }, [orientation, length, scrollPos, cellSize]);

    return <canvas ref={canvasRef} className="block" />;
};

export const DraftStudioModal: React.FC<DraftStudioModalProps> = ({
    isOpen, onClose, draft, dentingPlan, harnesses, warpThreads, onSave
}) => {
    const [localDraft, setLocalDraft] = useState(draft);
    const [localDenting, setLocalDenting] = useState(dentingPlan);
    const [repeatWidth, setRepeatWidth] = useState(warpThreads);
    const [cursor, setCursor] = useState<{r:number, c:number}>({r:0, c:0});
    const [activeArea, setActiveArea] = useState<'draft' | 'denting'>('draft');
    const [dentingCursor, setDentingCursor] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingReed, setIsDraggingReed] = useState(false);
    const reedDrawVal = useRef<boolean>(true);
    
    const [showNumbers, setShowNumbers] = useState(true);
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const CELL_SIZE = 20;
    const PADDING = 600; // Increased padding for better infinite feel

    const contentWidth = useMemo(() => (repeatWidth * CELL_SIZE) + (PADDING * 2), [repeatWidth, CELL_SIZE]);
    const contentHeight = useMemo(() => (harnesses * CELL_SIZE) + (PADDING * 2) + 60, [harnesses, CELL_SIZE]);

    useEffect(() => {
        if (isOpen) {
            setLocalDraft(draft.map(r => [...r]));
            setLocalDenting([...dentingPlan]);
            setRepeatWidth(warpThreads);
            setCursor({r: 0, c: 0});
            setActiveArea('draft');
            setDentingCursor(0);
            
            // Auto-center the grid on modal open
            setTimeout(() => {
                containerRef.current?.focus();
                if (scrollAreaRef.current) {
                    const area = scrollAreaRef.current;
                    area.scrollLeft = (contentWidth - area.clientWidth) / 2;
                    area.scrollTop = (contentHeight - area.clientHeight) / 2;
                }
            }, 150);
        }
    }, [isOpen, draft, dentingPlan, warpThreads, contentWidth, contentHeight]);

    useEffect(() => {
        const updateViewport = () => {
            if (scrollAreaRef.current) {
                setViewportSize({
                    w: scrollAreaRef.current.clientWidth,
                    h: scrollAreaRef.current.clientHeight
                });
            }
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [isOpen]);

    // Auto-scroll following cursor
    useEffect(() => {
        if (!scrollAreaRef.current || activeArea !== 'draft' || isDragging) return;
        const area = scrollAreaRef.current;
        // In the new layout, the grid is centered, so we must calculate absolute offset
        const gridX = (contentWidth - (repeatWidth * CELL_SIZE)) / 2;
        const gridY = (contentHeight - (harnesses * CELL_SIZE) - 60) / 2; // -60 for reed offset
        
        const cursorX = (cursor.c * CELL_SIZE) + gridX;
        const cursorY = (cursor.r * CELL_SIZE) + gridY;
        const threshold = 150;
        
        if (cursorX < area.scrollLeft + threshold) area.scrollLeft = Math.max(0, cursorX - threshold);
        else if (cursorX + CELL_SIZE > area.scrollLeft + area.clientWidth - threshold) area.scrollLeft = cursorX + CELL_SIZE - area.clientWidth + threshold;

        if (cursorY < area.scrollTop + threshold) area.scrollTop = Math.max(0, cursorY - threshold);
        else if (cursorY + CELL_SIZE > area.scrollTop + area.clientHeight - threshold) area.scrollTop = cursorY + CELL_SIZE - area.clientHeight + threshold;
    }, [cursor, activeArea, contentWidth, contentHeight, harnesses, repeatWidth, isDragging]);

    const dentingGrid = useMemo(() => {
        const dents = localDenting.length > 0 ? localDenting : [2];
        const row0: string[] = [];
        const row1: string[] = [];
        let dentIndex = 0, threadCount = 0, currentDentSize = dents[0];
        for (let i = 0; i < repeatWidth; i++) {
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
    }, [localDenting, repeatWidth]);

    const handleResize = (newWidth: number) => {
        const val = Math.max(1, newWidth);
        const oldW = repeatWidth;
        const oldH = harnesses;
        setLocalDraft(prev => Array.from({ length: harnesses }, (_, r) => 
            Array.from({ length: val }, (_, c) => (r < oldH) ? prev[r][c % oldW] : false)
        ));
        setRepeatWidth(val);
        setCursor(p => ({ r: Math.min(p.r, harnesses - 1), c: Math.min(p.c, val - 1) }));
    };

    const handleCellInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        if (type === 'down' || (type === 'enter' && isDragging)) {
            if (type === 'down') setIsDragging(true);
            setCursor({ r, c });
            setActiveArea('draft');
            const next = localDraft.map(row => [...row]);
            for (let i = 0; i < harnesses; i++) next[i][c] = false;
            next[r][c] = true;
            setLocalDraft(next);
        } else if (type === 'up') {
            setIsDragging(false);
        }
    };

    const handleReedInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        const currentPlan = localDenting.length > 0 ? localDenting : [2];
        const boolMap: boolean[] = [];
        let state = true, pIdx = 0;
        while (boolMap.length < repeatWidth) {
            for (let k = 0; k < currentPlan[pIdx % currentPlan.length]; k++) boolMap.push(state);
            state = !state; pIdx++;
        }

        let changed = false;
        const targetCol = c % repeatWidth;

        if (type === 'down') {
            setIsDraggingReed(true);
            setActiveArea('denting');
            reedDrawVal.current = r === 0;
            if (boolMap[targetCol] !== reedDrawVal.current) { boolMap[targetCol] = reedDrawVal.current; changed = true; }
        } else if (type === 'enter' && isDraggingReed) {
            if (boolMap[targetCol] !== reedDrawVal.current) { boolMap[targetCol] = reedDrawVal.current; changed = true; }
        } else if (type === 'up') {
            setIsDraggingReed(false);
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
            setLocalDenting(newPlan);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (activeArea === 'denting') {
            if (e.key === 'ArrowRight') setDentingCursor(p => Math.min(localDenting.length - 1, p + 1));
            else if (e.key === 'ArrowLeft') setDentingCursor(p => Math.max(0, p - 1));
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                const next = [...localDenting];
                if (next.length > 1) {
                    next.splice(dentingCursor, 1);
                    setLocalDenting(next);
                    setDentingCursor(p => Math.max(0, p - 1));
                }
            } else if (e.key === '+') {
                const next = [...localDenting];
                next.splice(dentingCursor + 1, 0, 2);
                setLocalDenting(next);
                setDentingCursor(p => p + 1);
            } else if (/^\d$/.test(e.key)) {
                const next = [...localDenting];
                next[dentingCursor] = parseInt(e.key);
                setLocalDenting(next);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                setActiveArea('draft');
            }
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'ArrowRight') setCursor(p => ({...p, c: Math.min(repeatWidth - 1, p.c + 1)}));
        else if (e.key === 'ArrowLeft') setCursor(p => ({...p, c: Math.max(0, p.c - 1)}));
        else if (e.key === 'ArrowUp') setCursor(p => ({...p, r: Math.max(0, p.r - 1)}));
        else if (e.key === 'ArrowDown') setCursor(p => ({...p, r: Math.min(harnesses - 1, p.r + 1)}));
        else if (e.key === ' ') {
            const next = localDraft.map(row => [...row]);
            const isSet = next[cursor.r][cursor.c];
            for(let i=0; i<harnesses; i++) next[i][cursor.c] = false;
            if (!isSet) next[cursor.r][cursor.c] = true;
            setLocalDraft(next);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            setActiveArea('denting');
        }
    };

    const runOp = (op: string) => {
        const next = localDraft.map(r => [...r]);
        if (op === 'clear') setLocalDraft(next.map(r => r.map(() => false)));
        else if (op === 'invert') setLocalDraft(next.map(r => r.map(c => !c)));
        else if (op === 'shiftL') setLocalDraft(next.map(r => [...r.slice(1), r[0]]));
        else if (op === 'shiftR') setLocalDraft(next.map(r => [r[r.length-1], ...r.slice(0, -1)]));
        else if (op === 'shiftU') setLocalDraft([...next.slice(1), next[0]]);
        else if (op === 'shiftD') setLocalDraft([next[next.length-1], ...next.slice(0, -1)]);
        else if (op === 'straight') {
            const straight = next.map(r => r.map(() => false));
            for(let c=0; c<repeatWidth; c++) straight[c % harnesses][c] = true;
            setLocalDraft(straight);
        }
    };

    const rulerOffsetH = (contentWidth - (repeatWidth * CELL_SIZE)) / 2;
    const rulerOffsetV = (contentHeight - (harnesses * CELL_SIZE) - 60) / 2;

    if (!isOpen) return null;

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in outline-none" 
            tabIndex={0} 
            onKeyDown={handleKeyDown}
        >
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-7xl h-full flex flex-col overflow-hidden" onKeyDown={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xl font-bold text-white">Drafting Studio</h2>
                        <div className="flex items-center gap-3 bg-gray-800 p-1 rounded-md border border-gray-700">
                            <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Draft Repeat</span>
                            <input 
                                type="number" min="1" max="512" value={repeatWidth}
                                onChange={(e) => handleResize(parseInt(e.target.value) || 1)}
                                className="w-16 bg-gray-900 border border-gray-700 rounded text-sm text-blue-400 font-bold px-2 py-1 focus:outline-none"
                            />
                        </div>
                        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                            <button onClick={() => setShowNumbers(!showNumbers)} className={`px-3 py-1 text-[10px] font-bold rounded ${showNumbers ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>NUMBERS</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm">Cancel</button>
                        <button onClick={() => onSave(localDraft, localDenting, repeatWidth)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg"><CheckIcon className="w-4 h-4"/> Save All Changes</button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    <div className="w-16 border-r border-gray-800 flex flex-col items-center py-4 gap-4 bg-gray-900 shrink-0">
                        <button onClick={() => runOp('clear')} title="Clear Grid" className="p-2 text-gray-400 hover:text-red-500"><TrashIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('invert')} title="Invert Grid" className="p-2 text-gray-400 hover:text-white"><InvertIcon className="w-5 h-5"/></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('shiftL')} title="Shift Left" className="p-2 text-gray-400 hover:text-white"><ShiftLeftIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftR')} title="Shift Right" className="p-2 text-gray-400 hover:text-white"><ShiftRightIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftU')} title="Shift Up" className="p-2 text-gray-400 hover:text-white"><ShiftUpIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftD')} title="Shift Down" className="p-2 text-gray-400 hover:text-white"><ShiftDownIcon className="w-5 h-5"/></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('straight')} title="Straight Draw" className="p-2 text-blue-500 hover:text-blue-400"><RulerIcon className="w-5 h-5"/></button>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
                        <div className="p-3 bg-gray-900 border-b border-gray-800 flex flex-col gap-2 shrink-0">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    <RulerIcon className="w-4 h-4 text-blue-500" /> Reed Order (Denting)
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { const next=[...localDenting, 2]; setLocalDenting(next); setDentingCursor(next.length-1); setActiveArea('denting'); }} className="p-1 text-blue-400 hover:bg-blue-900/30 rounded"><PlusIcon className="w-4 h-4"/></button>
                                    <button onClick={() => setLocalDenting([2])} className="p-1 text-red-400 hover:bg-red-900/30 rounded"><TrashIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className={`flex gap-2 overflow-x-auto pb-1 custom-scrollbar min-h-[50px] items-center px-1 rounded transition-all ${activeArea === 'denting' ? 'ring-2 ring-blue-500/50 bg-blue-900/10' : ''}`} onClick={() => setActiveArea('denting')}>
                                {localDenting.map((val, idx) => (
                                    <div key={idx} 
                                        className={`shrink-0 w-10 h-10 flex flex-col items-center justify-center rounded border transition-all cursor-pointer ${activeArea === 'denting' && dentingCursor === idx ? 'border-blue-500 bg-blue-600 text-white scale-110 shadow-lg' : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'}`}
                                        onClick={(e) => { e.stopPropagation(); setDentingCursor(idx); setActiveArea('denting'); }}
                                    >
                                        <span className="text-[7px] font-black uppercase opacity-60">D{idx+1}</span>
                                        <span className="text-sm font-bold font-mono">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="h-6 flex shrink-0 border-b border-gray-800">
                            <div className="w-6 shrink-0 bg-gray-900 border-r border-gray-700"></div>
                            <div className="flex-1 overflow-hidden">
                                <Ruler orientation="horizontal" length={viewportSize.w} scrollPos={scrollPos.x - rulerOffsetH} cellSize={CELL_SIZE} />
                            </div>
                        </div>

                        <div className="flex-1 flex min-h-0">
                            <div className="w-6 shrink-0 overflow-hidden border-r border-gray-700">
                                <Ruler orientation="vertical" length={viewportSize.h} scrollPos={scrollPos.y - rulerOffsetV} cellSize={CELL_SIZE} />
                            </div>

                            <div ref={scrollAreaRef} className="flex-1 overflow-auto custom-scrollbar" onScroll={(e) => setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}>
                                <div className="relative flex items-center justify-center bg-gray-900/40" style={{ width: contentWidth, height: contentHeight }}>
                                    <div className={`relative flex flex-col gap-4 border-2 rounded shadow-2xl p-1 bg-gray-800 transition-all ${activeArea === 'draft' || activeArea === 'denting' ? 'border-blue-500' : 'border-gray-700'}`}>
                                        <div className="flex flex-col gap-1" onClick={() => setActiveArea('denting')}>
                                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Visual Reed Layout</span>
                                            <InteractiveGrid 
                                                data={dentingGrid} 
                                                isColorGrid 
                                                renderRows={2} renderCols={repeatWidth} 
                                                onCellInteraction={handleReedInteraction}
                                                width={repeatWidth * CELL_SIZE} height={2 * CELL_SIZE} 
                                                showGrid 
                                            />
                                        </div>
                                        
                                        <div className="flex flex-col gap-1" onClick={() => setActiveArea('draft')}>
                                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1">Threading (Shafts 1-{harnesses})</span>
                                            <InteractiveGrid 
                                                data={localDraft} renderRows={harnesses} renderCols={repeatWidth}
                                                cursorRow={activeArea === 'draft' ? cursor.r : null} cursorCol={activeArea === 'draft' ? cursor.c : null}
                                                onCellInteraction={handleCellInteraction}
                                                width={repeatWidth * CELL_SIZE} height={harnesses * CELL_SIZE}
                                                gridDivision={4} showNumbers={showNumbers} activeColor="#3b82f6"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-2 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 px-6 font-mono flex justify-between uppercase">
                    <div>
                        {activeArea === 'draft' ? `DRAFT CURSOR: ${cursor.c + 1} : ${cursor.r + 1} | SPACE: Thread | TAB: Focus Reed` : `REED CURSOR: Dent ${dentingCursor + 1} | NUMBERS: Edit | +: Add | BACK: Delete | TAB: Focus Draft`}
                    </div>
                    <div className="text-blue-400 font-bold">MODE: {activeArea}</div>
                </div>
            </div>
        </div>
    );
};
