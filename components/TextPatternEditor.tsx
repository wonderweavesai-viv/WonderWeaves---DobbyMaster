import React, { useState, useMemo } from 'react';
import { parsePatternString } from '../utils/patternParser';
import { InteractiveGrid } from './InteractiveGrid';
import { TableIcon, RulerIcon } from './icons';

interface TextPatternEditorProps {
  title: string;
  value: string;
  onValueChange: (newValue: string) => void;
  colorMap: { [key: string]: string };
  onOpenGridEditor?: () => void;
  onFocus?: () => void;
  isScaled?: boolean;
  onToggleScale?: () => void;
}

export const TextPatternEditor: React.FC<TextPatternEditorProps> = ({ 
    title, value, onValueChange, colorMap, onOpenGridEditor, onFocus,
    isScaled = false, onToggleScale
}) => {
  const [isValid, setIsValid] = useState(true);

  const previewPattern = useMemo(() => {
    const parsed = parsePatternString(value, colorMap);
    const currentValidity = parsed.length > 0 || value.trim() === '';
    setIsValid(currentValidity);
    return parsed;
  }, [value, colorMap]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value.toUpperCase());
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
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
          {onOpenGridEditor && (
              <button 
                onClick={onOpenGridEditor}
                className="px-2 py-0.5 text-gray-500 bg-gray-50 border border-gray-200 hover:text-blue-600 hover:border-blue-500 rounded-[4px] text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 transition-all"
                title="Open Grid Editor"
              >
                  <TableIcon className="h-3 w-3" />
                  <span>Grid</span>
              </button>
          )}
      </div>
      <div className="relative">
        <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={onFocus}
            readOnly={isScaled}
            placeholder={isScaled ? "Recalculating..." : "e.g., 4A2B8C"}
            className={`w-full p-2 rounded-lg bg-gray-50 border ${isValid ? 'border-gray-200 focus:border-blue-500' : 'border-red-500'} focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 transition-colors font-mono text-sm tracking-widest uppercase ${isScaled ? 'opacity-70 bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {isScaled && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2" title="Automatically calculated from density ratio">
                <RulerIcon className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            </div>
        )}
      </div>
      {!isValid && <p className="text-red-500 text-[10px] font-bold">Invalid pattern format.</p>}
      
      <div className="h-6 w-full bg-white border border-gray-100 p-0.5 rounded overflow-hidden shadow-inner">
        {previewPattern.length > 0 && (
          <InteractiveGrid data={[previewPattern]} isColorGrid={true} className="w-full h-full" showGrid={false} />
        )}
      </div>
    </div>
  );
};