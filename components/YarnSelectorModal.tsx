
import React, { useState } from 'react';

interface YarnSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    yarns: { [key: string]: { color: string } };
    onSelect: (char: string, denting?: number) => void;
    isWarp?: boolean;
}

export const YarnSelectorModal: React.FC<YarnSelectorModalProps> = ({ 
    isOpen, onClose, title, yarns, onSelect, isWarp 
}) => {
    const [denting, setDenting] = useState<number>(2);

    if (!isOpen) return null;
    
    // Sort keys A, B, C...
    const sortedKeys = Object.keys(yarns).sort();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-sm w-full">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-500 mb-4">Select which yarn code to apply the current weave pattern to.</p>
                    
                    {isWarp && (
                        <div className="mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Denting (Ends/Dent)</label>
                             <input 
                                type="number" 
                                min="1" 
                                max="12" 
                                value={denting} 
                                onChange={(e) => setDenting(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:outline-none"
                             />
                             <p className="text-[10px] text-gray-400 mt-1">Updates denting order for selected yarn threads.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-4 gap-3">
                        {sortedKeys.map(char => (
                            <button
                                key={char}
                                onClick={() => { onSelect(char, isWarp ? denting : undefined); onClose(); }}
                                className="flex flex-col items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
                            >
                                <div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: yarns[char].color }}></div>
                                <span className="font-mono font-bold text-gray-700">{char}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
