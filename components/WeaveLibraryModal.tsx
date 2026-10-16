
import React, { useState } from 'react';
import { WEAVE_LIBRARY, LibraryWeave } from '../services/weaveLibrary';
import { WeaveThumbnail } from './WeaveThumbnail';

interface WeaveLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeave: (weave: LibraryWeave) => void;
}

export const WeaveLibraryModal: React.FC<WeaveLibraryModalProps> = ({ isOpen, onClose, onSelectWeave }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  // Dynamically extract categories from library + 'All'
  const categories = ['All', ...Array.from(new Set(WEAVE_LIBRARY.map(w => w.category)))].sort();

  const filteredWeaves = activeCategory === 'All' 
    ? WEAVE_LIBRARY 
    : WEAVE_LIBRARY.filter(w => w.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-white">Weave Library</h2>
            <p className="text-sm text-gray-400">Select a pattern to apply it to your project.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-4 bg-gray-900 border-b border-gray-800">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 snap-x">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all snap-start whitespace-nowrap ${
                            activeCategory === cat 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-gray-900 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredWeaves.map(weave => (
                    <button
                        key={weave.id}
                        onClick={() => onSelectWeave(weave)}
                        className="group flex flex-col bg-gray-800/50 border border-gray-700 hover:border-blue-500 hover:bg-gray-800 rounded-lg p-3 transition-all text-left"
                    >
                        <WeaveThumbnail weave={weave} className="w-full aspect-square" />
                        <div className="mt-3">
                            <h3 className="font-bold text-gray-200 text-sm group-hover:text-blue-400 transition-colors">{weave.name}</h3>
                            <div className="flex justify-between items-center mt-1 mb-2">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">{weave.category}</span>
                                <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded font-mono">{weave.harnesses}H</span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{weave.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
