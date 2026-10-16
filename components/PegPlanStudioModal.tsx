import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InteractiveGrid } from './InteractiveGrid';
import { 
    TrashIcon, InvertIcon, ShiftUpIcon, ShiftDownIcon, ShiftLeftIcon, 
    ShiftRightIcon, CopyIcon, PlusIcon, FlipIcon, RulerIcon, CheckIcon,
    MagicWandIcon, PencilIcon, MinusIcon, LayersIcon
} from './icons';

interface PegPlanStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    pegPlan: boolean[][];
    harnesses: number;
    weftPicks: number;
    onSave: (pegPlan: boolean[][], newWeftPicks: number) => void;
}

type EditTool = 'pencil' | 'select' | 'text';

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

export const PegPlanStudioModal: React.FC<PegPlanStudioModalProps> = ({
    isOpen, onClose, pegPlan, harnesses, weftPicks, onSave
}) => {
    const [localPeg, setLocalPeg] = useState(pegPlan);
    const [repeatHeight, setRepeatHeight] = useState(weftPicks);
    const [cursor, setCursor] = useState<{r:number, c:number}>({r:0, c:0});
    const [selection, setSelection] = useState<[number, number, number, number] | null>(null);
    const [clipboard, setClipboard] = useState<boolean[][] | null>(null);
    const [tool, setTool] = useState<EditTool>('pencil');
    const [viewSide, setViewSide] = useState<'face' | 'back'>('face');
    const [showNumbers, setShowNumbers] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const CELL_SIZE = 20;
    const PADDING = 600;

    const contentWidth = useMemo(() => (harnesses * CELL_SIZE) + (PADDING * 2), [harnesses, CELL_SIZE]);
    const contentHeight = useMemo(() => (repeatHeight * CELL_SIZE) + (PADDING * 2), [repeatHeight, CELL_SIZE]);

    useEffect(() => {
        if (isOpen) {
            setLocalPeg(pegPlan.map(r => [...r]));
            setRepeatHeight(weftPicks);
            setCursor({r: 0, c: 0});
            setSelection(null);
            
            setTimeout(() => {
                containerRef.current?.focus();
                if (scrollAreaRef.current) {
                    const area = scrollAreaRef.current;
                    area.scrollLeft = (contentWidth - area.clientWidth) / 2;
                    area.scrollTop = (contentHeight - area.clientHeight) / 2;
                }
            }, 150);
        }
    }, [isOpen, pegPlan, weftPicks, contentWidth, contentHeight]);

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

    // Auto-scroll logic to follow cursor
    useEffect(() => {
        if (!scrollAreaRef.current || isDragging) return;
        const area = scrollAreaRef.current;
        const gridX = (contentWidth - (harnesses * CELL_SIZE)) / 2;
        const gridY = (contentHeight - (repeatHeight * CELL_SIZE)) / 2;

        const cursorX = (cursor.c * CELL_SIZE) + gridX;
        const cursorY = (cursor.r * CELL_SIZE) + gridY;
        
        const threshold = 150;
        
        if (cursorX < area.scrollLeft + threshold) {
            area.scrollLeft = Math.max(0, cursorX - threshold);
        } else if (cursorX + CELL_SIZE > area.scrollLeft + area.clientWidth - threshold) {
            area.scrollLeft = cursorX + CELL_SIZE - area.clientWidth + threshold;
        }

        if (cursorY < area.scrollTop + threshold) {
            area.scrollTop = Math.max(0, cursorY - threshold);
        } else if (cursorY + CELL_SIZE > area.scrollTop + area.clientHeight - threshold) {
            area.scrollTop = cursorY + CELL_SIZE - area.clientHeight + threshold;
        }
    }, [cursor, harnesses, repeatHeight, contentWidth, contentHeight, isDragging]);

    const handleResize = (newHeight: number) => {
        const val = Math.max(1, newHeight);
        const oldP = repeatHeight;
        const oldH = harnesses;
        
        setLocalPeg(prev => {
            const next = Array.from({ length: val }, (_, r) => 
                Array.from({ length: harnesses }, (_, c) => {
                    const sourceRow = r % oldP;
                    if (c < oldH) {
                        return prev[sourceRow][c];
                    }
                    return false;
                })
            );
            return next;
        });
        setRepeatHeight(val);
        setCursor(p => ({
            r: Math.min(p.r, harnesses - 1),
            c: Math.min(p.c, val - 1)
        }));
        setSelection(null);
    };

    const handleCellInteraction = (r: number, c: number, type: 'down' | 'enter' | 'up') => {
        if (type === 'down') {
            setIsDragging(true);
            setCursor({r, c});
            if (tool === 'pencil') {
                const next = localPeg.map(row => [...row]);
                next[r][c] = !next[r][c];
                setLocalPeg(next);
                setSelection(null);
            } else if (tool === 'select') {
                setSelection([r, c, r, c]);
            }
        } else if (type === 'enter' && isDragging) {
            setCursor({r, c});
            if (tool === 'select') {
                setSelection(prev => prev ? [prev[0], prev[1], r, c] : [r, c, r, c]);
            }
        } else if (type === 'up') {
            setIsDragging(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (tool === 'text' && e.target instanceof HTMLInputElement) return;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'ArrowRight') setCursor(p => ({...p, c: Math.min(harnesses - 1, p.c + 1)}));
        else if (e.key === 'ArrowLeft') setCursor(p => ({...p, c: Math.max(0, p.c - 1)}));
        else if (e.key === 'ArrowUp') setCursor(p => ({...p, r: Math.max(0, p.r - 1)}));
        else if (e.key === 'ArrowDown') setCursor(p => ({...p, r: Math.min(repeatHeight - 1, p.r + 1)}));
        else if (e.key === ' ') {
            const next = localPeg.map(row => [...row]);
            next[cursor.r][cursor.c] = !next[cursor.r][cursor.c];
            setLocalPeg(next);
        }
        else if (e.key === 'c' && e.ctrlKey) runOp('copy');
        else if (e.key === 'v' && e.ctrlKey) runOp('paste');
        else if (e.key === 'Insert') runOp('insertPick');
        else if (e.key === 'Delete' && !selection) runOp('deletePick');
    };

    const runOp = (op: string) => {
        const next = localPeg.map(r => [...r]);
        
        let r1 = 0, c1 = 0, r2 = repeatHeight - 1, c2 = harnesses - 1;
        if (selection) {
            r1 = Math.min(selection[0], selection[2]);
            c1 = Math.min(selection[1], selection[3]);
            r2 = Math.max(selection[0], selection[2]);
            c2 = Math.max(selection[1], selection[3]);
        }

        switch(op) {
            case 'clear':
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = false;
                setLocalPeg(next);
                break;
            case 'invert':
                for(let r=r1; r<=r2; r++) for(let c=c1; c<=c2; c++) next[r][c] = !next[r][c];
                setLocalPeg(next);
                break;
            case 'flipH':
                for(let r=r1; r<=r2; r++) {
                    const rowPart = next[r].slice(c1, c2 + 1).reverse();
                    for(let c=c1; c<=c2; c++) next[r][c] = rowPart[c-c1];
                }
                setLocalPeg(next);
                break;
            case 'flipV':
                const tempRows = [];
                for(let r=r1; r<=r2; r++) tempRows.push([...next[r]]);
                tempRows.reverse();
                for(let r=r1; r<=r2; r++) {
                    for(let c=c1; c<=c2; c++) next[r][c] = tempRows[r-r1][c];
                }
                setLocalPeg(next);
                break;
            case 'copy':
                const clip: boolean[][] = [];
                for(let r=r1; r<=r2; r++) clip.push(next[r].slice(c1, c2 + 1));
                setClipboard(clip);
                break;
            case 'paste':
                if (!clipboard) return;
                for(let r=0; r<clipboard.length; r++) {
                    for(let c=0; c<clipboard[0].length; c++) {
                        const targetR = cursor.r + r;
                        const targetC = cursor.c + c;
                        if (targetR < repeatHeight && targetC < harnesses) {
                            next[targetR][targetC] = clipboard[r][c];
                        }
                    }
                }
                setLocalPeg(next);
                break;
            case 'insertPick':
                const insertAt = cursor.r + 1;
                const newRow = new Array(harnesses).fill(false);
                next.splice(insertAt, 0, newRow);
                setLocalPeg(next);
                setRepeatHeight(prev => prev + 1);
                setCursor(p => ({ ...p, r: Math.min(repeatHeight, p.r + 1) }));
                setSelection(null);
                break;
            case 'deletePick':
                if (repeatHeight <= 1) return;
                next.splice(cursor.r, 1);
                setLocalPeg(next);
                setRepeatHeight(prev => prev - 1);
                setCursor(p => ({ ...p, r: Math.max(0, Math.min(repeatHeight - 2, p.r)) }));
                setSelection(null);
                break;
            case 'shiftL':
                for (let r = r1; r <= r2; r++) {
                    const rowPart = next[r].slice(c1, c2 + 1);
                    const shifted = [...rowPart.slice(1), rowPart[0]];
                    for (let c = c1; c <= c2; c++) next[r][c] = shifted[c - c1];
                }
                setLocalPeg(next);
                break;
            case 'shiftR':
                for (let r = r1; r <= r2; r++) {
                    const rowPart = next[r].slice(c1, c2 + 1);
                    const shifted = [rowPart[rowPart.length - 1], ...rowPart.slice(0, -1)];
                    for (let c = c1; c <= c2; c++) next[r][c] = shifted[c - c1];
                }
                setLocalPeg(next);
                break;
            case 'shiftU':
                for (let c = c1; c <= c2; c++) {
                    const colPart = [];
                    for (let r = r1; r <= r2; r++) colPart.push(next[r][c]);
                    const shifted = [...colPart.slice(1), colPart[0]];
                    for (let r = r1; r <= r2; r++) next[r][c] = shifted[r - r1];
                }
                setLocalPeg(next);
                break;
            case 'shiftD':
                for (let c = c1; c <= c2; c++) {
                    const colPart = [];
                    for (let r = r1; r <= r2; r++) colPart.push(next[r][c]);
                    const shifted = [colPart[colPart.length - 1], ...colPart.slice(0, -1)];
                    for (let r = r1; r <= r2; r++) next[r][c] = shifted[r - r1];
                }
                setLocalPeg(next);
                break;
        }
    };

    const displayGrid = viewSide === 'face' ? localPeg : localPeg.map(r => r.map(c => !c));
    const rulerOffsetH = (contentWidth - (harnesses * CELL_SIZE)) / 2;
    const rulerOffsetV = (contentHeight - (repeatHeight * CELL_SIZE)) / 2;

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
                        <h2 className="text-xl font-bold text-white">Treadling Studio</h2>
                        <div className="flex items-center gap-3 bg-gray-800 p-1 rounded-md border border-gray-700">
                            <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Picks Repeat</span>
                            <input 
                                type="number" 
                                min="1" 
                                max="256"
                                value={repeatHeight}
                                onChange={(e) => handleResize(parseInt(e.target.value) || 1)}
                                className="w-16 bg-gray-900 border border-gray-700 rounded text-sm text-pink-400 font-bold px-2 py-1 focus:outline-none focus:border-pink-500"
                            />
                        </div>
                        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                            <button 
                                onClick={() => {setTool('pencil'); setSelection(null);}} 
                                className={`p-2 rounded transition-colors ${tool === 'pencil' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Pencil Tool"
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => {setTool('select'); setSelection(null);}} 
                                className={`p-2 rounded transition-colors ${tool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Selection Tool"
                            >
                                <MagicWandIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => {setTool('text'); setCursor({r: 0, c: 0}); setSelection(null);}} 
                                className={`p-2 rounded transition-colors ${tool === 'text' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Text Mode (Pick-by-Pick)"
                            >
                                <span className="text-xs font-bold px-1">T</span>
                            </button>
                        </div>
                        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                            <button onClick={() => setViewSide('face')} className={`px-4 py-1 text-[10px] font-bold rounded transition-all ${viewSide === 'face' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>FACE</button>
                            <button onClick={() => setViewSide('back')} className={`px-4 py-1 text-[10px] font-bold rounded transition-all ${viewSide === 'back' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>BACK</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm">Cancel</button>
                        <button onClick={() => onSave(localPeg, repeatHeight)} className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg"><CheckIcon className="w-4 h-4"/> Save Treadling</button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    <div className="w-16 border-r border-gray-800 flex flex-col items-center py-4 gap-4 bg-gray-900 shrink-0">
                        <button onClick={() => runOp('clear')} title="Clear" className="p-2 text-gray-400 hover:text-red-500"><TrashIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('invert')} title="Invert" className="p-2 text-gray-400 hover:text-white"><InvertIcon className="w-5 h-5"/></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('insertPick')} title="Insert Pick After Cursor" className="p-2 text-emerald-500 hover:text-emerald-400"><PlusIcon className="w-3 h-3" /> <LayersIcon className="w-3 h-3" /></button>
                        <button onClick={() => runOp('deletePick')} title="Delete Current Pick" className="p-2 text-red-500 hover:text-red-400"><MinusIcon className="w-3 h-3" /> <LayersIcon className="w-3 h-3" /></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('copy')} title="Copy Selection" disabled={!selection} className="p-2 text-gray-400 hover:text-white disabled:opacity-20"><CopyIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('paste')} title="Paste at Cursor" disabled={!clipboard} className="p-2 text-gray-400 hover:text-white disabled:opacity-20 transform rotate-180"><CopyIcon className="w-5 h-5"/></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('flipH')} title="Flip Horizontal" className="p-2 text-gray-400 hover:text-white"><FlipIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('flipV')} title="Flip Vertical" className="p-2 text-gray-400 hover:text-white"><FlipIcon className="w-5 h-5 rotate-90"/></button>
                        <div className="h-px w-8 bg-gray-800" />
                        <button onClick={() => runOp('shiftL')} title="Shift Left" className="p-2 text-gray-400 hover:text-white"><ShiftLeftIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftR')} title="Shift Right" className="p-2 text-gray-400 hover:text-white"><ShiftRightIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftU')} title="Shift Up" className="p-2 text-gray-400 hover:text-white"><ShiftUpIcon className="w-5 h-5"/></button>
                        <button onClick={() => runOp('shiftD')} title="Shift Down" className="p-2 text-gray-400 hover:text-white"><ShiftDownIcon className="w-5 h-5"/></button>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-950">
                        <div className="h-6 flex shrink-0">
                            <div className="w-6 shrink-0 bg-gray-900 border-b border-r border-gray-700"></div>
                            <div className="flex-1 overflow-hidden border-b border-gray-800">
                                <Ruler orientation="horizontal" length={viewportSize.w} scrollPos={scrollPos.x - rulerOffsetH} cellSize={CELL_SIZE} />
                            </div>
                        </div>

                        <div className="flex-1 flex min-h-0">
                            <div className="w-6 shrink-0 overflow-hidden border-r border-gray-700">
                                <Ruler orientation="vertical" length={viewportSize.h} scrollPos={scrollPos.y - rulerOffsetV} cellSize={CELL_SIZE} />
                            </div>

                            <div 
                                ref={scrollAreaRef}
                                className="flex-1 overflow-auto custom-scrollbar"
                                onScroll={(e) => setScrollPos({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
                            >
                                <div 
                                    className="relative flex items-center justify-center bg-gray-900/40"
                                    style={{ width: contentWidth, height: contentHeight }}
                                >
                                    <div 
                                        className="relative inline-block border-2 border-gray-700 rounded shadow-2xl p-1 bg-gray-800"
                                    >
                                        <InteractiveGrid 
                                            data={displayGrid}
                                            renderRows={repeatHeight} renderCols={harnesses}
                                            cursorRow={cursor.r} cursorCol={cursor.c}
                                            pulseCursor={false}
                                            selectionRect={selection}
                                            onCellInteraction={handleCellInteraction}
                                            width={harnesses * CELL_SIZE} height={repeatHeight * CELL_SIZE}
                                            gridDivision={4}
                                            showNumbers={showNumbers}
                                            numberingDirection="col"
                                            activeColor="#ec4899"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-2 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 px-6 font-mono flex justify-between uppercase">
                    {tool === 'text' ? (
                        <div className="flex items-center gap-4 w-full">
                            <span className="text-blue-400 font-bold shrink-0">TEXT MODE | Pick {cursor.r + 1}:</span>
                            <input 
                                autoFocus
                                placeholder="Punch Warp-Up sequence (e.g. 1.3.5.7) then press ENTER"
                                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white w-full max-w-xl focus:outline-none focus:border-blue-500 font-mono text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.currentTarget.value.trim();
                                        if (val || val === '') {
                                            const next = localPeg.map(row => [...row]);
                                            // Clear current pick
                                            for(let i=0; i<harnesses; i++) next[cursor.r][i] = false;
                                            // Parse dot-separated sequence
                                            const shafts = val.split('.').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            shafts.forEach(s => {
                                                if (s >= 1 && s <= harnesses) {
                                                    next[cursor.r][s-1] = true;
                                                }
                                            });
                                            setLocalPeg(next);
                                            // Advance to next pick
                                            setCursor(p => ({ ...p, r: Math.min(repeatHeight - 1, p.r + 1) }));
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                CURSOR: {cursor.c + 1} : {cursor.r + 1} | Use ARROW KEYS to move, SPACE to toggle peg.
                            </div>
                            <div>
                                {tool === 'select' ? 'DRAG to select area.' : 'PENCIL mode active.'} 
                                {selection ? ` Selected: [${Math.min(selection[1], selection[3])+1}:${Math.min(selection[0], selection[2])+1} to ${Math.max(selection[1], selection[3])+1}:${Math.max(selection[0], selection[2])+1}]` : ''}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};