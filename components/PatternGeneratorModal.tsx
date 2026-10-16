
import React, { useState, useEffect } from 'react';
import { generateOmbre, generateFibonacci, generateRandomStripe } from '../services/patternAlgorithms';
import { InteractiveGrid } from './InteractiveGrid';
import { parsePatternString } from '../utils/patternParser';

interface PatternGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    target: 'Warp' | 'Weft';
    availableChars: string[];
    colorMap: { [key: string]: string };
    onApply: (pattern: string) => void;
}

type GeneratorType = 'ombre' | 'fibonacci' | 'random';

export const PatternGeneratorModal: React.FC<PatternGeneratorModalProps> = ({
    isOpen, onClose, target, availableChars, colorMap, onApply
}) => {
    const [activeType, setActiveType] = useState<GeneratorType>('ombre');
    const [previewString, setPreviewString] = useState('');
    
    // Ombre State
    const [ombreA, setOmbreA] = useState(availableChars[0] || 'A');
    const [ombreB, setOmbreB] = useState(availableChars[1] || 'B');
    const [ombreSteps, setOmbreSteps] = useState(8);
    const [ombreMirror, setOmbreMirror] = useState(false);

    // Fibonacci State
    const [fibColors, setFibColors] = useState<string[]>([availableChars[0] || 'A']);
    const [fibLimit, setFibLimit] = useState(34);

    // Random State
    const [randColors, setRandColors] = useState<string[]>([availableChars[0] || 'A', availableChars[1] || 'B']);
    const [randTotal, setRandTotal] = useState(64);
    const [randMin, setRandMin] = useState(1);
    const [randMax, setRandMax] = useState(8);

    useEffect(() => {
        if (!isOpen) return;
        generate();
    }, [isOpen, activeType, ombreA, ombreB, ombreSteps, ombreMirror, fibColors, fibLimit, randColors, randTotal, randMin, randMax]);

    const generate = () => {
        let result = "";
        if (activeType === 'ombre') {
            const base = generateOmbre(ombreA, ombreB, ombreSteps);
            result = base;
            if (ombreMirror) {
                const reverse = generateOmbre(ombreB, ombreA, ombreSteps);
                result = base + reverse;
            }
        } else if (activeType === 'fibonacci') {
            result = generateFibonacci(fibColors, fibLimit);
        } else if (activeType === 'random') {
            result = generateRandomStripe(randColors, randTotal, randMin, randMax);
        }
        setPreviewString(result);
    };

    const toggleCharSelection = (char: string, list: string[], setList: (l: string[]) => void) => {
        if (list.includes(char)) {
            setList(list.filter(c => c !== char));
        } else {
            setList([...list, char]);
        }
    };

    const parsedPreview = parsePatternString(previewString, colorMap);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Pattern Algebra - {target}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div className="flex border-b border-gray-800 bg-gray-950">
                    {(['ombre', 'fibonacci', 'random'] as GeneratorType[]).map(type => (
                        <button 
                            key={type} 
                            onClick={() => setActiveType(type)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeType === type ? 'text-blue-500 border-b-2 border-blue-500 bg-gray-900' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="p-6 bg-gray-900 flex-1 overflow-y-auto">
                    {/* CONTROLS */}
                    <div className="mb-6 space-y-4">
                        
                        {activeType === 'ombre' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Start Color</label>
                                        <div className="flex gap-2">
                                            {availableChars.map(char => (
                                                <button key={char} onClick={() => setOmbreA(char)} className={`w-8 h-8 rounded border ${ombreA === char ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-700 opacity-50'}`} style={{backgroundColor: colorMap[char]}}>{char}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">End Color</label>
                                        <div className="flex gap-2">
                                            {availableChars.map(char => (
                                                <button key={char} onClick={() => setOmbreB(char)} className={`w-8 h-8 rounded border ${ombreB === char ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-700 opacity-50'}`} style={{backgroundColor: colorMap[char]}}>{char}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Transition Steps: {ombreSteps}</label>
                                    <input type="range" min="3" max="24" value={ombreSteps} onChange={(e) => setOmbreSteps(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="mirror" checked={ombreMirror} onChange={(e) => setOmbreMirror(e.target.checked)} className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500" />
                                    <label htmlFor="mirror" className="text-sm text-gray-300">Mirror (Back and forth)</label>
                                </div>
                            </div>
                        )}

                        {activeType === 'fibonacci' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Sequence Colors</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {availableChars.map(char => (
                                            <button key={char} onClick={() => toggleCharSelection(char, fibColors, setFibColors)} className={`w-8 h-8 rounded border ${fibColors.includes(char) ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-700 opacity-30'}`} style={{backgroundColor: colorMap[char]}}>{char}</button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1">Colors will cycle through the sequence 1, 1, 2, 3, 5...</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Max Stripe Width: {fibLimit}</label>
                                    <input type="range" min="5" max="144" step="1" value={fibLimit} onChange={(e) => setFibLimit(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        )}

                        {activeType === 'random' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Palette Pool</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {availableChars.map(char => (
                                            <button key={char} onClick={() => toggleCharSelection(char, randColors, setRandColors)} className={`w-8 h-8 rounded border ${randColors.includes(char) ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-700 opacity-30'}`} style={{backgroundColor: colorMap[char]}}>{char}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Min Width: {randMin}</label>
                                        <input type="range" min="1" max={randMax} value={randMin} onChange={(e) => setRandMin(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Max Width: {randMax}</label>
                                        <input type="range" min={randMin} max="64" value={randMax} onChange={(e) => setRandMax(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Total Threads: {randTotal}</label>
                                    <input type="range" min="16" max="256" step="16" value={randTotal} onChange={(e) => setRandTotal(parseInt(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <button onClick={generate} className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Regenerate
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RESULT PREVIEW */}
                    <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Preview</label>
                        <div className="h-8 w-full bg-gray-800 rounded mb-2 overflow-hidden">
                            {parsedPreview.length > 0 && (
                                <InteractiveGrid data={[parsedPreview]} isColorGrid renderRows={1} renderCols={parsedPreview.length} />
                            )}
                        </div>
                        <code className="block text-xs font-mono text-gray-400 break-all">{previewString}</code>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Cancel</button>
                    <button onClick={() => { onApply(previewString); onClose(); }} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md shadow-lg transition-colors">Apply Pattern</button>
                </div>
            </div>
        </div>
    );
};
