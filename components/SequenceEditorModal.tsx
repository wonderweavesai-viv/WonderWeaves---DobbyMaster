
import React, { useState, useEffect, useMemo } from 'react';
import { parsePatternString } from '../utils/patternParser';
import { TrashIcon, PlusIcon, ArrowRightIcon } from './icons';

interface SequenceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  patternString: string;
  onSave: (newPattern: string) => void;
  colorMap: { [key: string]: string };
}

interface PatternStep {
  char: string;
  count: number;
  id: string; // unique id for list keys
}

export const SequenceEditorModal: React.FC<SequenceEditorModalProps> = ({
  isOpen, onClose, title, patternString, onSave, colorMap
}) => {
  const [sequence, setSequence] = useState<PatternStep[]>([]);
  
  // Available chars based on color map keys (usually A-H)
  const availableChars = useMemo(() => Object.keys(colorMap), [colorMap]);

  useEffect(() => {
    if (isOpen) {
      // Parse the string into steps
      // Regex: (\d+)([A-Z])
      const regex = /(\d+)([A-Z])/gi;
      let match;
      const newSeq: PatternStep[] = [];
      let i = 0;
      
      // Basic validation check first
      if (patternString.trim() === '') {
          setSequence([]);
          return;
      }

      while ((match = regex.exec(patternString)) !== null) {
        newSeq.push({
          count: parseInt(match[1], 10),
          char: match[2].toUpperCase(),
          id: `step-${i++}-${Date.now()}`
        });
      }
      setSequence(newSeq);
    }
  }, [isOpen, patternString]);

  const handleSave = () => {
    const newString = sequence.map(s => `${s.count}${s.char}`).join('');
    onSave(newString);
    onClose();
  };

  const updateStep = (index: number, updates: Partial<PatternStep>) => {
    setSequence(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
    });
  };

  const addStep = () => {
    setSequence(prev => [
        ...prev, 
        { char: availableChars[0] || 'A', count: 4, id: `step-${Date.now()}` }
    ]);
  };

  const removeStep = (index: number) => {
    setSequence(prev => prev.filter((_, i) => i !== index));
  };

  // Matrix Interaction: Setting a count at [Char][Index]
  // If we click a cell for Char 'B' at Step 3, we update Step 3 to be Char 'B'.
  const handleCellChange = (stepIndex: number, char: string, count: number) => {
      // If the step is already this char, update count
      // If the step is different char, switch char AND update count
      updateStep(stepIndex, { char, count });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-white">{title} - Color Order</h2>
            <p className="text-sm text-gray-400">Define the stripe sequence using the matrix below.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
                Cancel
            </button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md shadow-lg transition-colors">
                Apply Pattern
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-gray-950 relative">
             {/* Matrix Container */}
             <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <table className="border-collapse w-max">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-10 bg-gray-900 p-2 text-left min-w-[120px] border-b border-gray-800 border-r text-xs font-bold text-gray-500 uppercase">
                                Yarn Color
                            </th>
                            {sequence.map((step, idx) => (
                                <th key={step.id} className="p-2 border-b border-gray-800 min-w-[80px] text-center text-xs font-mono text-gray-500 group relative">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>#{idx + 1}</span>
                                        <button 
                                            onClick={() => removeStep(idx)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-500 rounded transition-all"
                                            title="Remove Step"
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th className="p-2 border-b border-gray-800 min-w-[80px]">
                                <button 
                                    onClick={addStep}
                                    className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white transition-all mx-auto"
                                    title="Add Step"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {availableChars.map((char) => (
                            <tr key={char} className="hover:bg-gray-900/50 transition-colors">
                                <td className="sticky left-0 z-10 bg-gray-900 p-3 border-b border-r border-gray-800 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded shadow-sm" style={{ backgroundColor: colorMap[char] }} />
                                    <span className="font-mono font-bold text-gray-300">{char}</span>
                                </td>
                                {sequence.map((step, idx) => {
                                    const isActive = step.char === char;
                                    return (
                                        <td key={`${step.id}-${char}`} className="p-1 border-b border-gray-800 border-r border-gray-800/30 text-center relative">
                                            <div 
                                                className={`
                                                    w-full h-12 flex items-center justify-center rounded cursor-pointer transition-all
                                                    ${isActive ? 'bg-blue-900/30 ring-1 ring-blue-500' : 'hover:bg-gray-800'}
                                                `}
                                                onClick={() => !isActive && handleCellChange(idx, char, step.count)}
                                            >
                                                {isActive && (
                                                    <input 
                                                        type="number" 
                                                        min={1} 
                                                        max={999}
                                                        value={step.count}
                                                        onChange={(e) => handleCellChange(idx, char, parseInt(e.target.value) || 0)}
                                                        className="w-16 bg-transparent text-center font-bold text-white text-lg focus:outline-none"
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {!isActive && (
                                                    <div className="w-full h-full" />
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="border-b border-gray-800"></td>
                            </tr>
                        ))}
                         {/* Total Row */}
                         <tr>
                            <td className="sticky left-0 z-10 bg-gray-900 p-3 border-r border-gray-800 font-bold text-gray-500 text-xs uppercase text-right">
                                Threads
                            </td>
                            {sequence.map((step, idx) => (
                                <td key={`total-${idx}`} className="p-2 text-center text-xs text-gray-500 font-mono border-r border-gray-800/30">
                                    {step.count}
                                </td>
                            ))}
                            <td></td>
                        </tr>
                    </tbody>
                </table>
             </div>
             
             {/* Total Summary */}
             <div className="p-3 bg-gray-900 border-t border-gray-800 text-right text-sm text-gray-400 px-6">
                 Total Threads: <span className="text-white font-bold">{sequence.reduce((acc, s) => acc + s.count, 0)}</span>
             </div>
        </div>
      </div>
    </div>
  );
};
