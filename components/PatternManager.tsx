import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrashIcon, PlusIcon, ShuffleIcon, MagicWandIcon, GradientIcon, TableIcon, FlipIcon, PencilIcon, LayersIcon, CopyIcon, RulerIcon } from './icons';
import { generateOmbre, generateFibonacci, generateRandomStripe } from '../services/patternAlgorithms';
import { InteractiveGrid } from './InteractiveGrid';
import { DensityZone, YarnDefinition } from '../types';

export interface PatternManagerProps {
    target: 'Warp' | 'Weft';
    patternString: string;
    onApply: (newPattern: string, densityZones?: DensityZone[]) => void;
    availableChars: string[];
    colorMap: { [key: string]: string };
    onEditYarn: (char: string) => void;
    initialZones?: DensityZone[]; 
    totalPicks?: number; 
    className?: string;
    onClose?: () => void;
    // New Props for Density Management
    yarns?: { [key: string]: YarnDefinition };
    onUpdateYarn?: (char: string, def: YarnDefinition) => void;
    // Scaling Props
    isScaled?: boolean;
    onToggleScale?: () => void;
}

interface PatternStep {
    char: string;
    count: number | ''; 
    id: string;
}

type ToolTab = 'sequence' | 'auto' | 'gradient' | 'density';
type GradientMode = 'transition' | 'grow-both' | 'grow-single';

export const PatternManager: React.FC<PatternManagerProps> = ({
    target, patternString = "", onApply, availableChars = [], colorMap = {}, onEditYarn, initialZones = [], totalPicks = 100, className = "", onClose,
    yarns, onUpdateYarn, isScaled = false, onToggleScale
}) => {
    // --- STATE ---
    const [sequence, setSequence] = useState<PatternStep[]>([]);
    
    // Tools
    const [activeTab, setActiveTab] = useState<ToolTab>('sequence');
    const [rawInput, setRawInput] = useState(patternString);
    const [syntaxMode, setSyntaxMode] = useState<'alpha' | 'numeric'>('alpha');
    
    // Auto Generator
    const [autoWeights, setAutoWeights] = useState<{ [key: string]: number }>({});
    const [autoYarnCount, setAutoYarnCount] = useState(2); 
    const [autoTotal, setAutoTotal] = useState(100);
    const [autoMin, setAutoMin] = useState(2);
    const [autoMax, setAutoMax] = useState(12);
    const [autoMirror, setAutoMirror] = useState(false);

    // Gradient
    const [gradMode, setGradMode] = useState<GradientMode>('transition');
    const [gradStart, setGradStart] = useState('A');
    const [gradEnd, setGradEnd] = useState('B');
    const [gradSteps, setGradSteps] = useState(8);
    const [gradMirror, setGradMirror] = useState(false);

    // Density
    const [zones, setZones] = useState<DensityZone[]>(initialZones);

    // Grid Interaction
    const gridRef = useRef<HTMLDivElement>(null);
    const idCounter = useRef(0);
    const [focusedCol, setFocusedCol] = useState<number | null>(null);

    const getNewId = (prefix: string) => `${prefix}-${idCounter.current++}`;

    // --- EFFECTS ---

    // 1. Initial Load & Weights
    useEffect(() => {
        const weights: {[key:string]: number} = {};
        if (availableChars.length > 0) {
            availableChars.forEach(c => weights[c] = 0);
            if(availableChars.length >= 2) {
                weights[availableChars[0]] = 50;
                weights[availableChars[1]] = 50;
            } else {
                weights[availableChars[0]] = 100;
            }
        }
        setAutoWeights(weights);
        
        // Ensure gradient defaults are valid
        if (availableChars.length > 0) {
            setGradStart(availableChars[0]);
            setGradEnd(availableChars[availableChars.length > 1 ? 1 : 0]);
        }
    }, [availableChars.join(',')]);

    // 2. Sync with External String
    useEffect(() => {
        setRawInput(patternString);
        parseAndSet(patternString);
    }, [patternString]);

    // 3. Sync with Density Zones
    useEffect(() => {
        setZones(initialZones);
    }, [initialZones]);

    // 4. Update Raw Input when Sequence Changes via Grid
    useEffect(() => {
        if (syntaxMode === 'numeric') {
            const numericStr = sequence.map(s => {
                const index = availableChars.indexOf(s.char) + 1;
                return `${s.count || 0}-${index}`;
            }).join('.');
            if (numericStr !== rawInput) setRawInput(numericStr);
        } else {
            const alphaStr = sequence.map(s => `${s.count || 0}${s.char}`).join('');
            if (alphaStr !== rawInput) setRawInput(alphaStr);
        }
    }, [sequence, syntaxMode, availableChars]); // Don't include rawInput to avoid loops

    // --- HELPERS ---

    const parseAndSet = (str: string) => {
        const newSeq: PatternStep[] = [];
        const cleanStr = str || "";

        if (syntaxMode === 'alpha') {
            const regex = /(\d+)\s*([A-Z])/gi;
            let match;
            while ((match = regex.exec(cleanStr)) !== null) {
                newSeq.push({
                    count: parseInt(match[1], 10),
                    char: match[2].toUpperCase(),
                    id: getNewId('step')
                });
            }
        } else {
            const regex = /(\d+)-(\d+)/g;
            let match;
            while ((match = regex.exec(cleanStr)) !== null) {
                const count = parseInt(match[1], 10);
                const index = parseInt(match[2], 10);
                const char = availableChars[index - 1] || 'A';
                if (count > 0) {
                    newSeq.push({
                        count,
                        char,
                        id: getNewId('step')
                    });
                }
            }
        }
        
        // Only update if we have a sequence or if the input string is empty (clearing)
        if (newSeq.length > 0 || cleanStr.trim() === "") {
            setSequence(newSeq);
        }
    };

    const updateStep = (index: number, updates: Partial<PatternStep>) => {
        setSequence(prev => {
            const next = [...prev];
            // If editing past the end, fill gaps
            while (next.length <= index) {
                next.push({ char: availableChars[0] || 'A', count: 1, id: getNewId('blank') });
            }
            next[index] = { ...next[index], ...updates };
            return next;
        });
        setFocusedCol(index);
    };

    const insertStep = (index: number) => {
        setSequence(prev => {
            const next = [...prev];
            const prevStep = next[Math.max(0, index - 1)] || { char: availableChars[0], count: 1 };
            next.splice(index, 0, { char: prevStep.char, count: prevStep.count, id: getNewId('ins') });
            return next;
        });
        setFocusedCol(index);
    };

    const deleteStep = (index: number) => {
        setSequence(prev => prev.filter((_, i) => i !== index));
        if (focusedCol === index) setFocusedCol(null);
    };

    const handleApply = () => {
        const str = sequence
            .filter(s => (typeof s.count === 'number' && s.count > 0))
            .map(s => `${s.count}${s.char}`)
            .join('');
        onApply(str, zones);
        if (onClose) onClose();
    };

    // --- KEYBOARD NAV ---
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (activeTab !== 'sequence') return;
        
        // Ignore typing in input fields except arrow navigation
        if (e.target instanceof HTMLInputElement) {
            if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                e.preventDefault();
            } else if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (!e.ctrlKey) return; 
                e.preventDefault();
            } else {
                return;
            }
        }

        const currentIdx = focusedCol !== null ? focusedCol : (sequence.length > 0 ? sequence.length - 1 : 0);
        const maxIdx = Math.max(sequence.length + 5, 32); 

        if (e.key === 'ArrowRight') {
            setFocusedCol(Math.min(currentIdx + 1, maxIdx));
        } else if (e.key === 'ArrowLeft') {
            setFocusedCol(Math.max(currentIdx - 1, 0));
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (currentIdx >= sequence.length && currentIdx >= maxIdx) return;
            
            const step = sequence[currentIdx];
            const defaultChar = availableChars[0] || 'A';
            
            if (!step) {
                updateStep(currentIdx, { char: defaultChar, count: 1 });
                return;
            }
            
            const charIdx = availableChars.indexOf(step.char);
            let nextCharIdx;
            if (e.key === 'ArrowUp') {
                nextCharIdx = (charIdx - 1 + availableChars.length) % availableChars.length;
            } else {
                nextCharIdx = (charIdx + 1) % availableChars.length;
            }
            updateStep(currentIdx, { char: availableChars[nextCharIdx] });
        }
    };

    // --- GENERATORS ---
    const applyAuto = () => {
        const activeChars = availableChars.slice(0, autoYarnCount);
        if (activeChars.length === 0) return;
        let totalWeight = 0;
        activeChars.forEach(k => totalWeight += (autoWeights[k] || 0));
        if (totalWeight === 0) return;
        
        let currentLen = 0;
        const newSeq: PatternStep[] = [];
        
        while(currentLen < autoTotal) {
            const r = Math.random() * totalWeight;
            let running = 0;
            let picked = activeChars[0];
            for(const char of activeChars) {
                running += (autoWeights[char] || 0);
                if (r <= running) { picked = char; break; }
            }
            let len = Math.floor(Math.random() * (autoMax - autoMin + 1)) + autoMin;
            if (currentLen + len > autoTotal) len = autoTotal - currentLen;
            
            newSeq.push({ count: len, char: picked, id: getNewId('auto') });
            currentLen += len;
        }
        
        if (autoMirror) {
            const reversed = [...newSeq].reverse().map(s => ({...s, id: getNewId('auto-mir')}));
            newSeq.push(...reversed);
        }
        setSequence(newSeq);
    };

    const applyGradient = () => {
        let newSeq: PatternStep[] = [];
        if (gradMode === 'transition') {
            const res = generateOmbre(gradStart, gradEnd, gradSteps);
            let finalStr = res;
            if (gradMirror) finalStr += generateOmbre(gradEnd, gradStart, gradSteps);
            const regex = /(\d+)\s*([A-Z])/gi;
            let match;
            while ((match = regex.exec(finalStr)) !== null) {
                newSeq.push({ count: parseInt(match[1]), char: match[2].toUpperCase(), id: getNewId('grad') });
            }
        } else {
            // Grow logic
            const steps = [];
            for(let i=1; i<=gradSteps; i++) { 
                steps.push({ count: i, char: gradStart }); 
                steps.push({ count: gradMode === 'grow-both' ? i : 1, char: gradEnd }); 
            }
            if (gradMirror) { 
                for(let i=gradSteps-1; i>=1; i--) { 
                    steps.push({ count: i, char: gradStart }); 
                    steps.push({ count: gradMode === 'grow-both' ? i : 1, char: gradEnd }); 
                } 
            }
            newSeq = steps.map(s => ({ ...s, id: getNewId('grad-grow') }));
        }
        setSequence(newSeq);
    };

    const randomize = () => {
        const chars = availableChars.slice(0, 3);
        const res = generateRandomStripe(chars, 64, 2, 12);
        const regex = /(\d+)\s*([A-Z])/gi;
        let match;
        const newSeq: PatternStep[] = [];
        while ((match = regex.exec(res)) !== null) {
            newSeq.push({ count: parseInt(match[1]), char: match[2].toUpperCase(), id: getNewId('rnd') });
        }
        setSequence(newSeq);
    };

    const addZone = () => {
        setZones(prev => [
            ...prev,
            {
                id: getNewId('zone'),
                startPick: 0,
                endPick: 20,
                ppi: 30,
                color: '#3B82F6'
            }
        ]);
    };

    const updateZone = (id: string, updates: Partial<DensityZone>) => {
        setZones(prev => prev.map(z => z.id === id ? { ...z, ...updates } : z));
    };

    const removeZone = (id: string) => {
        setZones(prev => prev.filter(z => z.id !== id));
    };

    // --- VISUALS ---
    const previewData = useMemo(() => {
        const flatColors: string[] = [];
        sequence.forEach(step => {
            const count = typeof step.count === 'number' ? step.count : 0;
            const color = colorMap[step.char] || '#ccc';
            for(let i=0; i<count; i++) flatColors.push(color);
        });
        return [flatColors]; 
    }, [sequence, colorMap]);

    const totalThreads = sequence.reduce((acc, s) => acc + (typeof s.count === 'number' ? s.count : 0), 0);
    const ribbonWidth = Math.max(totalThreads * 4, 100); 
    const MIN_COLS = 32;
    const gridCols = Math.max(sequence.length + 10, MIN_COLS);
    const colIndices = Array.from({ length: gridCols }, (_, i) => i);

    return (
        <div className={`flex flex-col bg-white overflow-hidden border border-gray-300 ${className}`} tabIndex={0} onKeyDown={handleKeyDown}>
            {/* 1. HEADER */}
            <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 flex justify-between items-center shrink-0 h-10">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm">
                        <TableIcon className="w-3 h-3" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight leading-none">{target} Pattern</h2>
                        <span className="text-[10px] text-gray-500 font-mono">{totalThreads} threads • {sequence.length} steps</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onClose && <button onClick={onClose} className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors">Cancel</button>}
                    <button onClick={handleApply} className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-50 rounded shadow-sm transition-colors">Update</button>
                </div>
            </div>

            {/* 2. COMPACT RIBBON */}
            <div className="bg-gray-50 border-b border-gray-300 p-1 shrink-0 h-8 overflow-hidden relative">
                {previewData[0].length > 0 ? (
                    <div className="h-full w-full overflow-hidden rounded bg-white shadow-inner">
                        <InteractiveGrid 
                            data={previewData} 
                            isColorGrid 
                            width={ribbonWidth} 
                            height={24} 
                            renderRows={1} 
                            renderCols={totalThreads} 
                            showGrid={false} 
                        />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-mono">NO PATTERN DEFINED</div>
                )}
            </div>

            {/* 3. MAIN WORKSPACE */}
            <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                {/* EXCEL GRID */}
                <div className="flex-1 overflow-auto custom-scrollbar relative" ref={gridRef}>
                    <table className="border-collapse w-max min-w-full bg-white text-xs table-fixed">
                        <thead className="sticky top-0 z-20 bg-white text-gray-500 font-mono text-[10px] shadow-sm">
                            <tr>
                                <th className="sticky left-0 z-30 bg-gray-50 border-r border-b border-gray-200 w-8 py-1">#</th>
                                <th className="sticky left-8 z-30 bg-gray-50 border-r border-b border-gray-200 w-24 px-2 text-left">Yarn</th>
                                {colIndices.map((idx) => (
                                    <th key={`head-${idx}`} className={`border-r border-b border-gray-200 w-10 py-1 font-normal bg-gray-50 text-center group relative hover:bg-gray-100 cursor-pointer ${focusedCol === idx ? 'bg-blue-50' : ''}`}>
                                        <span className="group-hover:opacity-0 transition-opacity">{idx + 1}</span>
                                        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-gray-100">
                                            <button onClick={() => insertStep(idx)} className="text-blue-500 hover:text-blue-700 p-0.5" title="Insert Step Before"><PlusIcon className="w-3 h-3" /></button>
                                            <button onClick={() => deleteStep(idx)} className="text-red-400 hover:text-red-600 p-0.5" title="Delete Step"><TrashIcon className="w-3 h-3" /></button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {availableChars.map((char) => (
                                <tr key={char} className="hover:bg-gray-50 group/row h-7">
                                    <td className="sticky left-0 z-10 bg-gray-50 border-r border-b border-gray-200 text-center text-gray-400 font-mono text-[10px]">{char}</td>
                                    <td className="sticky left-8 z-10 bg-white border-r border-b border-gray-200 p-0 cursor-pointer" onClick={() => onEditYarn(char)}>
                                        <div className="flex items-center gap-2 px-2 h-full">
                                            <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm relative overflow-hidden" style={{backgroundColor: colorMap[char] || '#ccc'}}>
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 bg-black/20 transition-opacity"><PencilIcon className="w-2 h-2 text-white" /></div>
                                            </div>
                                            <span className="font-mono font-bold text-gray-700">{char}</span>
                                        </div>
                                    </td>
                                    {colIndices.map((idx) => {
                                        const step = sequence[idx];
                                        const isActive = step?.char === char;
                                        const isFocused = focusedCol === idx;
                                        return (
                                            <td key={`${idx}-${char}`} 
                                                className={`border-r border-b border-gray-200 p-0 text-center relative transition-colors cursor-default ${isActive ? 'bg-blue-50' : ''} ${isFocused && !isActive ? 'bg-gray-50' : ''} ${isFocused ? 'border-l-blue-300 border-r-blue-300 border-x-2' : ''}`} 
                                                onClick={() => updateStep(idx, { char })}
                                            >
                                                {isActive && (
                                                    <input 
                                                        type="text" 
                                                        inputMode="numeric" 
                                                        pattern="[0-9]*" 
                                                        value={step.count} 
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                                            if (val === '' || !isNaN(val)) updateStep(idx, { count: val });
                                                        }} 
                                                        className="w-full h-full text-center bg-transparent font-bold text-blue-700 focus:outline-none focus:bg-blue-100 text-xs p-0 border-none" 
                                                        autoFocus={isFocused} 
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* COMMAND CENTER */}
                <div className="h-48 bg-white flex flex-col shrink-0 z-20 border-t border-gray-300">
                    <div className="flex border-b border-gray-200 bg-gray-50 px-2 h-8 items-end">
                        <button onClick={() => setActiveTab('sequence')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t border-x rounded-t transition-colors flex items-center gap-1.5 ${activeTab === 'sequence' ? 'border-gray-200 bg-white text-blue-600 -mb-px' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><TableIcon className="w-3 h-3" /> Input</button>
                        <button onClick={() => setActiveTab('auto')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t border-x rounded-t transition-colors flex items-center gap-1.5 ${activeTab === 'auto' ? 'border-gray-200 bg-white text-blue-600 -mb-px' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><MagicWandIcon className="w-3 h-3" /> Auto</button>
                        <button onClick={() => setActiveTab('gradient')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t border-x rounded-t transition-colors flex items-center gap-1.5 ${activeTab === 'gradient' ? 'border-gray-200 bg-white text-blue-600 -mb-px' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><GradientIcon className="w-3 h-3" /> Gradient</button>
                        {target === 'Weft' && (
                            <button onClick={() => setActiveTab('density')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t border-x rounded-t transition-colors flex items-center gap-1.5 ${activeTab === 'density' ? 'border-gray-200 bg-white text-blue-600 -mb-px' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><LayersIcon className="w-3 h-3" /> Density</button>
                        )}
                    </div>

                    <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                        {activeTab === 'sequence' && (
                            <div className="flex flex-col h-full gap-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Pattern String</label>
                                        {onToggleScale && (
                                            <button
                                                onClick={onToggleScale}
                                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border transition-all ${isScaled ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-400 hover:text-gray-600'}`}
                                                title="Auto-scale to Square (Ratio-based)"
                                            >
                                                % Scale
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex bg-gray-100 rounded p-0.5 border border-gray-200">
                                        <button onClick={() => setSyntaxMode('alpha')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${syntaxMode === 'alpha' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Alpha</button>
                                        <button onClick={() => setSyntaxMode('numeric')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${syntaxMode === 'numeric' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Num</button>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center relative">
                                    <input 
                                        type="text" 
                                        value={rawInput} 
                                        onChange={(e) => setRawInput(e.target.value)} 
                                        onBlur={() => parseAndSet(rawInput)} 
                                        onKeyDown={(e) => e.key === 'Enter' && parseAndSet(rawInput)} 
                                        readOnly={isScaled}
                                        className={`flex-1 border border-gray-300 rounded p-1.5 font-mono text-xs tracking-wide uppercase focus:border-blue-500 focus:outline-none ${isScaled ? 'bg-gray-100 opacity-70 cursor-not-allowed' : ''}`} 
                                        placeholder={isScaled ? "Scaling active..." : "e.g. 4A4B2C"} 
                                    />
                                    {isScaled && (
                                        <div className="absolute right-24 top-1/2 -translate-y-1/2">
                                            <RulerIcon className="w-3 h-3 text-blue-500 animate-pulse" />
                                        </div>
                                    )}
                                    <button onClick={() => parseAndSet(rawInput)} disabled={isScaled} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-bold text-gray-600 transition-colors disabled:opacity-50">Sync</button>
                                    <button onClick={randomize} disabled={isScaled} className="px-2 py-1.5 text-gray-400 hover:text-blue-500 border border-gray-200 rounded hover:border-blue-300 transition-colors disabled:opacity-50" title="Randomize Sequence"><ShuffleIcon className="w-4 h-4"/></button>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1"><span className="font-bold">Keyboard Nav:</span> Arrow keys to move grid focus. Enter to edit.</div>
                            </div>
                        )}

                        {activeTab === 'auto' && (
                            <div className="flex gap-4 h-full text-xs">
                                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                    <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-1">
                                        <label className="font-bold text-gray-500 uppercase">Weights</label>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] text-gray-400 uppercase">Count:</label>
                                            <select value={autoYarnCount} onChange={e => setAutoYarnCount(Number(e.target.value))} className="bg-gray-50 border border-gray-200 rounded text-xs p-0.5">{[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}</select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-x-2 gap-y-2">
                                        {availableChars.slice(0, autoYarnCount).map(char => (
                                            <div key={char} className="flex items-center gap-1.5 p-1 border border-gray-100 rounded">
                                                <div className="w-2.5 h-2.5 rounded-full border shadow-sm shrink-0" style={{backgroundColor: colorMap[char]}}></div>
                                                <span className="font-mono font-bold w-3 text-[10px]">{char}</span>
                                                <input type="number" min="0" max="100" value={autoWeights[char] || 0} onChange={(e) => setAutoWeights(prev => ({...prev, [char]: parseInt(e.target.value) || 0}))} className="w-full p-0.5 text-right font-mono text-[10px] focus:outline-none focus:bg-blue-50 border-b border-gray-200"/>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-px bg-gray-200"></div>
                                <div className="w-32 space-y-2 shrink-0">
                                        <div className="flex justify-between items-center"><label className="font-bold text-gray-500 uppercase text-[10px]">Total</label><input type="number" value={autoTotal} onChange={e => setAutoTotal(parseInt(e.target.value))} className="w-10 border rounded p-0.5 font-mono text-right text-[10px]" /></div>
                                        <div className="flex justify-between items-center"><label className="font-bold text-gray-500 uppercase text-[10px]">Size</label><div className="flex gap-1"><input type="number" value={autoMin} onChange={e => setAutoMin(parseInt(e.target.value))} className="w-10 border rounded p-0.5 text-center text-[10px]" />-<input type="number" value={autoMax} onChange={e => setAutoMax(parseInt(e.target.value))} className="w-10 border rounded p-0.5 text-center text-[10px]" /></div></div>
                                        <label className="flex items-center gap-2 cursor-pointer pt-1"><input type="checkbox" checked={autoMirror} onChange={e => setAutoMirror(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3" /><span className="text-gray-700 font-medium flex items-center gap-1 text-[10px]"><FlipIcon className="w-3 h-3"/> Mirror</span></label>
                                        <button onClick={applyAuto} className="w-full py-1 mt-1 bg-blue-50 text-blue-700 font-bold rounded border border-blue-100 hover:bg-blue-100 flex items-center justify-center gap-1 transition-colors text-[10px]"><MagicWandIcon className="w-3 h-3" /> GENERATE</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'gradient' && (
                            <div className="flex gap-6 h-full text-xs">
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="font-bold text-gray-500 uppercase text-[10px]">Method</label>
                                        <select value={gradMode} onChange={e => setGradMode(e.target.value as GradientMode)} className="bg-gray-50 border border-gray-200 rounded p-1 text-[10px]">
                                            <option value="transition">Transition (Mix)</option>
                                            <option value="grow-both">Grow Band (1-1, 2-2)</option>
                                            <option value="grow-single">Grow Single (1-1, 2-1)</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-4 items-center justify-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <div className="text-center"><label className="font-bold text-gray-400 uppercase block mb-1 text-[9px]">Start</label><div className="flex gap-0.5">{availableChars.map(char => (<button key={char} onClick={() => setGradStart(char)} className={`w-4 h-4 rounded-sm border ${gradStart === char ? 'ring-1 ring-blue-500 border-white z-10' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{backgroundColor: colorMap[char]}}></button>))}</div></div>
                                        <div className="text-gray-300">➜</div>
                                        <div className="text-center"><label className="font-bold text-gray-400 uppercase block mb-1 text-[9px]">End</label><div className="flex gap-0.5">{availableChars.map(char => (<button key={char} onClick={() => setGradEnd(char)} className={`w-4 h-4 rounded-sm border ${gradEnd === char ? 'ring-1 ring-blue-500 border-white z-10' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{backgroundColor: colorMap[char]}}></button>))}</div></div>
                                    </div>
                                </div>
                                <div className="w-px bg-gray-200 h-full"></div>
                                <div className="w-32 space-y-2 pt-4">
                                    <div className="flex justify-between items-center"><label className="font-bold text-gray-500 uppercase text-[10px]">Steps</label><input type="number" min="3" max="32" value={gradSteps} onChange={e => setGradSteps(parseInt(e.target.value))} className="w-12 border rounded p-0.5 text-center text-[10px]" /></div>
                                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={gradMirror} onChange={e => setGradMirror(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3" /><span className="text-gray-700 font-medium flex items-center gap-1 text-[10px]"><FlipIcon className="w-3 h-3"/> Mirror</span></label>
                                    <button onClick={applyGradient} className="w-full py-1 mt-1 bg-blue-50 text-blue-700 font-bold rounded border border-blue-100 hover:bg-blue-100 flex items-center justify-center gap-1 transition-colors text-[10px]"><GradientIcon className="w-3 h-3" /> GENERATE</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'density' && (
                            <div className="h-full flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-gray-500">Define variable weft density zones. Indices are 1-based.</p>
                                        <button onClick={addZone} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 text-xs font-bold flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add Zone</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 rounded bg-gray-50 max-h-32">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-100 text-gray-500 font-bold border-b border-gray-200">
                                                <tr><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">PPI</th><th className="p-2">Color</th><th className="p-2 w-8"></th></tr>
                                            </thead>
                                            <tbody>
                                                {zones.map((zone) => (
                                                    <tr key={zone.id} className="border-b border-gray-200 bg-white">
                                                        <td className="p-2"><input type="number" value={zone.startPick + 1} onChange={e => updateZone(zone.id, {startPick: Math.max(0, (parseInt(e.target.value) || 1) - 1)})} className="w-12 border rounded p-1 text-center" /></td>
                                                        <td className="p-2"><input type="number" value={zone.endPick + 1} onChange={e => updateZone(zone.id, {endPick: Math.max(0, (parseInt(e.target.value) || 1) - 1)})} className="w-12 border rounded p-1 text-center" /></td>
                                                        <td className="p-2"><input type="number" value={zone.ppi} onChange={e => updateZone(zone.id, {ppi: parseInt(e.target.value)})} className="w-12 border rounded p-1 text-center font-bold text-blue-600" /></td>
                                                        <td className="p-2"><input type="color" value={zone.color} onChange={e => updateZone(zone.id, {color: e.target.value})} className="w-6 h-6 border-none p-0 cursor-pointer" /></td>
                                                        <td className="p-2 text-center"><button onClick={() => removeZone(zone.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 pt-2">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Yarn Specific Density</h3>
                                    <div className="space-y-1">
                                        {availableChars.map(char => {
                                            const yarn = yarns ? yarns[char] : null;
                                            return (
                                                <div key={char} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" style={{backgroundColor: colorMap[char]}}></div>
                                                        <span className="font-mono font-bold text-xs text-gray-700">{char}</span>
                                                        <span className="text-[10px] text-gray-400 truncate w-24 block">{yarn?.fiberType || 'Unknown'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="Global"
                                                            value={yarn?.preferredPPI || ''}
                                                            onChange={(e) => {
                                                                if (onUpdateYarn && yarn) {
                                                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                    onUpdateYarn(char, { ...yarn, preferredPPI: val });
                                                                }
                                                            }}
                                                            className="w-16 border border-gray-300 rounded p-1 text-xs text-right focus:border-blue-500 focus:outline-none"
                                                        />
                                                        <span className="text-[9px] text-gray-400">PPI</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-gray-400 mt-1 italic">Yarn PPI overrides global project settings unless a specific Zone is active.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};