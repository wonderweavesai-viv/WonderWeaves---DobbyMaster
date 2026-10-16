
import React, { useState, useEffect, useMemo } from 'react';
import { WeaveSettings, YarnDefinition, WarpBeam, WeavePattern, DensityZone } from '../types';
import { WeaveArea } from './WeaveArea';
import { MultiBeamDraft } from './MultiBeamDraft';
import { InteractiveGrid } from './InteractiveGrid';
import { generateWeave } from '../services/weaveGenerator';
import { expandPatternString, parsePatternString } from '../utils/patternParser';
import { TrashIcon, PlusIcon, LayersIcon } from './icons';

interface ProWeaveStudioProps {
    settings: WeaveSettings;
    onSettingsChange: (s: WeaveSettings) => void;
    draft: boolean[][];
    pegPlan: boolean[][];
    onUpdateDraft: (d: boolean[][]) => void;
    onUpdatePegPlan: (p: boolean[][]) => void;
    
    // Weft is global
    weftYarns: { [key: string]: YarnDefinition };
    weftPatternString: string;
    onUpdateWeftPattern: (s: string) => void;
    
    // Warp is managed via beams here
    warpYarns: { [key: string]: YarnDefinition }; // Global yarn registry
    
    // Callbacks to sync with main app
    onUpdateWarpYarns: (yarns: { [key: string]: YarnDefinition }) => void;
    onUpdateWarpPattern: (s: string) => void;
}

export const ProWeaveStudio: React.FC<ProWeaveStudioProps> = ({
    settings, onSettingsChange, draft, pegPlan, onUpdateDraft, onUpdatePegPlan,
    weftYarns, weftPatternString, onUpdateWeftPattern,
    warpYarns, onUpdateWarpYarns, onUpdateWarpPattern
}) => {
    // --- STATE ---
    const [beams, setBeams] = useState<WarpBeam[]>([
        { id: 'b1', name: 'Ground Beam', color: '#3b82f6', harnesses: [0, 1, 2, 3], yarns: {}, pattern: '1A' }
    ]);
    const [beamArrangement, setBeamArrangement] = useState('1A'); // "1A" means Beam 1 all across. "1A1B" means 1 end Beam 1, 1 end Beam 2.
    
    const [viewMode, setViewMode] = useState<'face' | 'back' | 'structure'>('face');
    const [activeTab, setActiveTab] = useState<'draft' | 'peg'>('draft');

    // --- INITIAL SYNC ---
    useEffect(() => {
        // Initialize Beam 1 with existing warp setup if first load
        if (beams.length === 1 && Object.keys(beams[0].yarns).length === 0) {
            setBeams([{ 
                ...beams[0], 
                yarns: warpYarns, 
                // Default harnesses to all available
                harnesses: Array.from({length: settings.harnesses}, (_, i) => i) 
            }]);
        }
    }, []);

    // --- COMPOSITING LOGIC ---
    // 1. Parse Arrangement String -> Sequence of Beam Indices
    const beamSequence = useMemo(() => {
        const regex = /(\d+)([A-Z])/gi; // e.g. 1A = 1 end from Beam A (Index 0)
        let match;
        const seq: number[] = [];
        
        // Map Letters A,B,C to Beam Indices 0,1,2
        const charMap: {[key:string]: number} = {};
        beams.forEach((b, i) => charMap[String.fromCharCode(65 + i)] = i); // A=0, B=1

        while ((match = regex.exec(beamArrangement)) !== null) {
            const count = parseInt(match[1]);
            const char = match[2].toUpperCase();
            const beamIdx = charMap[char] !== undefined ? charMap[char] : 0;
            for(let i=0; i<count; i++) seq.push(beamIdx);
        }
        return seq.length > 0 ? seq : [0];
    }, [beamArrangement, beams]);

    // 2. Compile Global Warp Pattern & Colors
    useEffect(() => {
        // Construct the master warp pattern string based on interleaving
        let masterPattern: string[] = [];
        // And ensure the global warpYarns contains all yarns from all beams
        // To avoid conflicts, we might need to prefix keys? 
        // For now, let's assume shared global yarn registry but beams select from it.
        // Actually, simplest is: Beam A uses yarn 'A', Beam B uses yarn 'B'.
        // Let's build the visual pattern array first.
        
        const totalThreads = settings.warpThreads;
        
        for(let i=0; i<totalThreads; i++) {
            const beamIdx = beamSequence[i % beamSequence.length];
            const beam = beams[beamIdx];
            if (!beam) {
                masterPattern.push('A'); 
                continue;
            }
            
            // Get beam's local pattern sequence
            const beamPatExpanded = expandPatternString(beam.pattern);
            // We need to know WHICH thread index OF THIS BEAM we are on.
            // Count how many times this beam has appeared so far in the sequence
            // This is complex for phase shifting. 
            // Simplified: Just repeat the beam's pattern linearly.
            
            // To do this correctly: maintain a counter for each beam
            // But React effect runs fully.
            // Let's just calculate:
            
            // We need a function to generate the Nth thread color for Beam X
            // That function is just (n % patternLength).
            
            // Count occurrences of beamIdx in beamSequence up to i % seqLen
            // Then add (i / seqLen) * occurrencesInFullSeq
            
            const seqLen = beamSequence.length;
            const fullRepeats = Math.floor(i / seqLen);
            const remainder = i % seqLen;
            
            let beamThreadIndex = 0;
            // Add full repeats contribution
            const countInSeq = beamSequence.filter(idx => idx === beamIdx).length;
            beamThreadIndex += fullRepeats * countInSeq;
            // Add remainder contribution
            for(let k=0; k<remainder; k++) {
                if (beamSequence[k] === beamIdx) beamThreadIndex++;
            }
            
            const colorChar = beamPatExpanded[beamThreadIndex % beamPatExpanded.length] || 'A';
            // We might need to prefix char to avoid collisions if Beam A has 'A' (Red) and Beam B has 'A' (Blue)
            // Strategy: Map Beam 0 chars to A-H, Beam 1 chars to I-P ?
            // Or just merge dictionaries.
            masterPattern.push(colorChar);
        }
        
        // Update global state
        // For color simulation to work, warpYarns must have definitions for all chars used.
        // We just merge all beam yarns into global warpYarns
        const mergedYarns = { ...warpYarns };
        beams.forEach(b => {
            Object.assign(mergedYarns, b.yarns);
        });
        
        // Convert array back to RLE string? Or DobbyMaster can take array? 
        // DobbyMaster expects string.
        // Let's compress.
        const compress = (arr: string[]) => {
            if (arr.length === 0) return "";
            let res = "", last = arr[0], count = 1;
            for(let i=1; i<arr.length; i++) {
                if (arr[i] === last) count++;
                else { res += `${count}${last}`; last = arr[i]; count = 1; }
            }
            res += `${count}${last}`;
            return res;
        };
        
        const newPatternStr = compress(masterPattern);
        
        // Only update if changed to avoid loops
        // onUpdateWarpPattern(newPatternStr); // This might cause render loop if not careful
        // onUpdateWarpYarns(mergedYarns);

    }, [beams, beamSequence, settings.warpThreads]); 

    // --- RENDER HELPERS ---
    const warpColors = useMemo(() => {
        // Compile a visual array of colors for the Drawdown based on current beams
        // This is purely for the WeaveArea prop
        const colors: string[] = [];
        for(let i=0; i<settings.warpThreads; i++) {
            const beamIdx = beamSequence[i % beamSequence.length];
            const beam = beams[beamIdx];
            if (!beam) { colors.push('#000'); continue; }
            
            const beamPat = expandPatternString(beam.pattern);
            // Calculate local index
            const seqLen = beamSequence.length;
            const fullRepeats = Math.floor(i / seqLen);
            const remainder = i % seqLen;
            const countInSeq = beamSequence.filter(idx => idx === beamIdx).length;
            let localIndex = fullRepeats * countInSeq;
            for(let k=0; k<remainder; k++) if(beamSequence[k] === beamIdx) localIndex++;
            
            const char = beamPat[localIndex % beamPat.length];
            colors.push(beam.yarns[char]?.color || '#999');
        }
        return colors;
    }, [beams, beamSequence, settings.warpThreads]);

    const weftColors = useMemo(() => expandPatternString(weftPatternString).map(c => weftYarns[c]?.color || '#999'), [weftPatternString, weftYarns]);

    const weaveData = useMemo(() => generateWeave({
        draft, pegPlan, 
        warpPattern: warpColors, 
        weftPattern: weftColors
    }), [draft, pegPlan, warpColors, weftColors]);

    // --- ACTIONS ---
    const handleAddBeam = () => {
        const nextId = beams.length;
        const char = String.fromCharCode(65 + nextId);
        setBeams([...beams, {
            id: `b${nextId+1}`,
            name: `Beam ${char}`,
            color: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][nextId % 4],
            harnesses: [], // User must assign
            yarns: { 'A': { color: '#000000', model: 'simple', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 20, ply: 2, thickness: 1, twist: 'Z', tpi: 10, sheen: 0.5, roughness: 0.5 } },
            pattern: '1A'
        }]);
    };

    const handleDeleteBeam = (idx: number) => {
        if (beams.length <= 1) return;
        setBeams(prev => prev.filter((_, i) => i !== idx));
    };

    const handleHarnessAssignment = (beamIndex: number, start: number, end: number) => {
        const newBeams = [...beams];
        // Create range
        const range = [];
        for(let i=start-1; i<end; i++) range.push(i);
        newBeams[beamIndex].harnesses = range;
        setBeams(newBeams);
    };

    const handleDraftClick = (harness: number, warpIndex: number) => {
        // Toggle logic
        const newDraft = draft.map(row => [...row]);
        // Ensure draft is large enough
        if (!newDraft[harness]) return;
        
        // Standard drafting: One harness per thread usually.
        // If we want radio behavior (clear column), we do it here.
        // For Multi-beam, usually we enforce that the thread belongs to the beam owning the harness.
        // The UI handles the click restriction, so we just toggle.
        
        // Radio behavior: Clear this column first? 
        // Let's stick to toggle for flexibility in Pro mode.
        newDraft[harness][warpIndex] = !newDraft[harness][warpIndex];
        onUpdateDraft(newDraft);
    };

    return (
        <div className="flex h-full w-full bg-gray-900 text-gray-200">
            {/* LEFT: VISUALIZATION (40%) */}
            <div className="w-2/5 flex flex-col border-r border-gray-700 bg-gray-50">
                <div className="h-10 bg-white border-b border-gray-200 flex justify-between items-center px-4">
                    <span className="text-xs font-bold text-gray-500 uppercase">Live Simulation</span>
                    <div className="flex gap-2">
                        <button onClick={() => setViewMode('face')} className={`text-[10px] font-bold px-2 py-1 rounded ${viewMode === 'face' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>Face</button>
                        <button onClick={() => setViewMode('back')} className={`text-[10px] font-bold px-2 py-1 rounded ${viewMode === 'back' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>Reverse</button>
                        <button onClick={() => setViewMode('structure')} className={`text-[10px] font-bold px-2 py-1 rounded ${viewMode === 'structure' ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>Structure</button>
                    </div>
                </div>
                <div className="flex-1 relative overflow-hidden">
                    <WeaveArea 
                        draft={draft} pegPlan={pegPlan}
                        warpPattern={warpColors} weftPattern={weftColors}
                        weavePattern={weaveData.pattern} structure={weaveData.structure}
                        handleDraftInteraction={()=>{}} handlePegPlanInteraction={()=>{}} handleDrawdownInteraction={()=>{}}
                        pegPlanActiveColor="#000" draftActiveColor="#000"
                        currentTool="pan" gridDivision={settings.gridDivision}
                        viewMode={viewMode === 'structure' ? 'structure' : 'interlace'}
                        faceMode={viewMode === 'back' ? 'reverse' : 'face'}
                        epi={settings.epi} ppi={settings.ppi}
                        warpRepeat={settings.warpThreads} weftRepeat={settings.weftPicks}
                        showHeaders={false} initialScale={0.8}
                    />
                </div>
            </div>

            {/* RIGHT: ENGINEERING (60%) */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* TOOLBAR */}
                <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setActiveTab('draft')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'draft' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        >
                            <LayersIcon className="w-4 h-4" /> Drafting
                        </button>
                        <button 
                            onClick={() => setActiveTab('peg')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'peg' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        >
                            <LayersIcon className="w-4 h-4 transform rotate-90" /> Peg Plan
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase font-bold mr-2">Arrangement:</span>
                        <input 
                            type="text" 
                            value={beamArrangement}
                            onChange={(e) => setBeamArrangement(e.target.value.toUpperCase())}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white w-32 focus:border-blue-500 outline-none"
                            title="e.g. 1A 1B for alternating beams"
                        />
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    
                    {/* TOP HALF: MANAGERS */}
                    <div className="h-1/3 min-h-[200px] border-b border-gray-700 flex">
                        {activeTab === 'draft' ? (
                            // BEAM MANAGER
                            <div className="flex-1 bg-gray-900 p-4 overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Beam Manager</h3>
                                    <button onClick={handleAddBeam} className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1">
                                        <PlusIcon className="w-3 h-3" /> Add Beam
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {beams.map((beam, idx) => (
                                        <div key={beam.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex gap-4 items-start">
                                            <div className="w-1 h-full rounded-full" style={{ backgroundColor: beam.color, minHeight: '40px' }}></div>
                                            <div className="flex-1 grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex justify-between">
                                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Beam Name ({String.fromCharCode(65+idx)})</label>
                                                        {idx > 0 && <button onClick={() => handleDeleteBeam(idx)} className="text-red-500 hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={beam.name} 
                                                        onChange={(e) => { const n = [...beams]; n[idx].name = e.target.value; setBeams(n); }}
                                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Harness Range</label>
                                                    <div className="flex gap-2 mt-1">
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={beam.harnesses.length > 0 ? Math.min(...beam.harnesses) + 1 : 1}
                                                            onChange={(e) => {
                                                                const start = parseInt(e.target.value) || 1;
                                                                const end = beam.harnesses.length > 0 ? Math.max(...beam.harnesses) + 1 : start + 3;
                                                                handleHarnessAssignment(idx, start, end);
                                                            }}
                                                            className="w-12 bg-gray-900 border border-gray-600 rounded px-1 py-1 text-xs text-center text-white"
                                                        />
                                                        <span className="text-gray-500">-</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={beam.harnesses.length > 0 ? Math.max(...beam.harnesses) + 1 : 4}
                                                            onChange={(e) => {
                                                                const start = beam.harnesses.length > 0 ? Math.min(...beam.harnesses) + 1 : 1;
                                                                const end = parseInt(e.target.value) || start;
                                                                handleHarnessAssignment(idx, start, end);
                                                            }}
                                                            className="w-12 bg-gray-900 border border-gray-600 rounded px-1 py-1 text-xs text-center text-white"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Pattern Sequence</label>
                                                    <input 
                                                        type="text" 
                                                        value={beam.pattern} 
                                                        onChange={(e) => { const n = [...beams]; n[idx].pattern = e.target.value.toUpperCase(); setBeams(n); }}
                                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white mt-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // PEG PLAN EDITOR
                            <div className="flex-1 bg-gray-900 p-4 flex flex-col">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Peg Plan Editor</h3>
                                <div className="flex-1 overflow-auto bg-gray-800 rounded border border-gray-700">
                                    <div className="p-4">
                                        <InteractiveGrid 
                                            data={pegPlan} 
                                            renderRows={settings.weftPicks} 
                                            renderCols={settings.harnesses}
                                            isColorGrid={false}
                                            activeColor="#ec4899"
                                            gridDivision={settings.gridDivision}
                                            onCellInteraction={(r,c,t) => {
                                                if (t === 'down') {
                                                    const newPeg = pegPlan.map(row => [...row]);
                                                    newPeg[r][c] = !newPeg[r][c];
                                                    onUpdatePegPlan(newPeg);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BOTTOM HALF: STACKED DRAFT */}
                    <div className="flex-1 bg-gray-950 p-4 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Multi-Beam Drafting</h3>
                            <span className="text-[10px] text-gray-500">Edit threading by clicking cells. Disabled cells belong to other beams.</span>
                        </div>
                        <MultiBeamDraft 
                            draft={draft}
                            beams={beams}
                            beamSequence={beamSequence}
                            onCellClick={handleDraftClick}
                            gridDivision={settings.gridDivision}
                        />
                    </div>

                </div>
            </div>
        </div>
    );
};
