
import React, { useState, useEffect } from 'react';
import { LibraryWeave } from '../services/weaveLibrary';
import { InteractiveGrid } from './InteractiveGrid';
import { LayersIcon, GridFillIcon, LayoutIcon, TableIcon } from './icons';

interface WeaveEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeave?: LibraryWeave; 
  onSave: (weave: LibraryWeave) => void;
}

export const WeaveEditorModal: React.FC<WeaveEditorModalProps> = ({ isOpen, onClose, initialWeave, onSave }) => {
  const [name, setName] = useState('New Weave');
  const [category, setCategory] = useState<LibraryWeave['category']>('Basic');
  
  const [harnesses, setHarnesses] = useState(4);
  const [draftWidth, setDraftWidth] = useState(4); 
  const [pegHeight, setPegHeight] = useState(4); 

  const [draft, setDraft] = useState<number[][]>([]);
  const [pegPlan, setPegPlan] = useState<number[][]>([]);

  useEffect(() => {
    if (isOpen) {
        if (initialWeave) {
            setName(initialWeave.name);
            setCategory(initialWeave.category);
            setHarnesses(initialWeave.harnesses);
            setDraftWidth(initialWeave.draft[0]?.length || 4);
            setPegHeight(initialWeave.pegPlan.length || 4);
            setDraft(initialWeave.draft);
            setPegPlan(initialWeave.pegPlan);
        } else {
            setName('My Custom Weave');
            setCategory('Basic');
            setHarnesses(4); setDraftWidth(4); setPegHeight(4);
            initGrids(4, 4, 4);
        }
    }
  }, [isOpen, initialWeave]);

  const initGrids = (h: number, w: number, p: number) => {
      setDraft(Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => r === c % h ? 1 : 0)));
      setPegPlan(Array.from({ length: p }, (_, r) => Array.from({ length: h }, (_, c) => r === c % p ? 1 : 0)));
  };

  const updateDimensions = (newH: number, newW: number, newP: number) => {
      const oldDraft = draft;
      const newDraft = Array.from({ length: newH }, (_, r) => 
        Array.from({ length: newW }, (_, c) => (r < oldDraft.length && c < (oldDraft[0]?.length || 0)) ? oldDraft[r][c] : 0)
      );
      const oldPeg = pegPlan;
      const newPeg = Array.from({ length: newP }, (_, r) => 
        Array.from({ length: newH }, (_, c) => (r < oldPeg.length && c < (oldPeg[0]?.length || 0)) ? oldPeg[r][c] : 0)
      );
      setHarnesses(newH); setDraftWidth(newW); setPegHeight(newP);
      setDraft(newDraft); setPegPlan(newPeg);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><TableIcon className="w-5 h-5" /></div>
             <h2 className="text-xl font-bold text-white tracking-tight">{initialWeave ? 'Edit Weave Definition' : 'Define New Weave Structure'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-hidden flex bg-gray-950">
            {/* Left Column: Form */}
            <div className="w-80 border-r border-gray-800 p-6 space-y-8 bg-gray-900 overflow-y-auto custom-scrollbar">
                <section>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Identification</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Pattern Name" className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none mb-3" />
                    <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                        {['Basic', 'Twill', 'Satin', 'Rib', 'Crepe', 'Structure'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </section>

                <section>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Geometry</label>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                             <div className="flex justify-between mb-1"><span className="text-xs text-gray-400">Shafts</span><span className="text-xs font-mono text-blue-400">{harnesses}</span></div>
                             <input type="range" min="2" max="24" value={harnesses} onChange={e => updateDimensions(parseInt(e.target.value), draftWidth, pegHeight)} className="w-full h-1 bg-gray-700 appearance-none rounded-full accent-blue-600" />
                        </div>
                        <div>
                             <div className="flex justify-between mb-1"><span className="text-xs text-gray-400">Repeat Width</span><span className="text-xs font-mono text-blue-400">{draftWidth}</span></div>
                             <input type="range" min="2" max="64" value={draftWidth} onChange={e => updateDimensions(harnesses, parseInt(e.target.value), pegHeight)} className="w-full h-1 bg-gray-700 appearance-none rounded-full accent-blue-600" />
                        </div>
                        <div>
                             <div className="flex justify-between mb-1"><span className="text-xs text-gray-400">Repeat Height</span><span className="text-xs font-mono text-blue-400">{pegHeight}</span></div>
                             <input type="range" min="2" max="64" value={pegHeight} onChange={e => updateDimensions(harnesses, draftWidth, parseInt(e.target.value))} className="w-full h-1 bg-gray-700 appearance-none rounded-full accent-blue-600" />
                        </div>
                    </div>
                </section>
                
                <div className="p-4 bg-blue-900/10 border border-blue-800/30 rounded-lg text-[10px] leading-relaxed text-gray-400">
                    <p className="font-bold text-blue-400 uppercase mb-1">Definition Rules:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Draft defines harness assignment per end.</li>
                        <li>Peg Plan defines treadling / lift per pick.</li>
                        <li>This unit will be tiled across the main design.</li>
                    </ul>
                </div>
            </div>

            {/* Main Area: Grids */}
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-12 items-center">
                <div className="flex flex-col gap-2 max-w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <LayersIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Drafting Unit</span>
                    </div>
                    <div className="border border-gray-700 rounded-lg shadow-xl overflow-hidden p-1 bg-gray-800">
                        <InteractiveGrid 
                            data={draft.map(r => r.map(c => c===1))} 
                            renderRows={harnesses} renderCols={draftWidth}
                            width={draftWidth * 24} height={harnesses * 24}
                            onCellClick={(r,c) => setDraft(p => { const n = p.map(row=>[...row]); n[r][c] = n[r][c] ? 0 : 1; return n; })}
                            gridDivision={4}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2 max-w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <LayoutIcon className="w-4 h-4 text-pink-500" />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Peg Plan Unit</span>
                    </div>
                    <div className="border border-gray-700 rounded-lg shadow-xl overflow-hidden p-1 bg-gray-800">
                        <InteractiveGrid 
                            data={pegPlan.map(r => r.map(c => c===1))} 
                            renderRows={pegHeight} renderCols={harnesses}
                            width={harnesses * 24} height={pegHeight * 24}
                            activeColor="#ec4899"
                            onCellClick={(r,c) => setPegPlan(p => { const n = p.map(row=>[...row]); n[r][c] = n[r][c] ? 0 : 1; return n; })}
                            gridDivision={4}
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">Discard</button>
            <button onClick={() => { onSave({ id: initialWeave?.id || `custom-${Date.now()}`, name, category, description: 'Custom weave', harnesses, draft, pegPlan }); onClose(); }} className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105">Save Weave</button>
        </div>
      </div>
    </div>
  );
};
