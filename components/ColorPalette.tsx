
import React from 'react';

interface ColorPaletteProps {
  colorMap: { [key: string]: string };
  onUpdateColor?: (index: number, newColor: string) => void;
  selectedColorIndex?: number;
  onSelectColor?: (index: number) => void;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ 
    colorMap, onUpdateColor, selectedColorIndex = 0, onSelectColor 
}) => {
  return (
    <div className="pt-4 border-t border-gray-600">
      <h3 className="text-lg font-medium text-gray-300 mb-3">Color Legend</h3>
      <p className="text-xs text-gray-400 mb-2">Select a color to paint on the pattern bars.</p>
      <div className="grid grid-cols-6 gap-2">
        {Object.entries(colorMap).map(([letter, color], idx) => {
          const isSelected = idx === selectedColorIndex;
          return (
          <div key={letter} className="relative group">
             <div 
                className={`flex flex-col items-center gap-1 p-1 rounded-md cursor-pointer transition-all ${isSelected ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-900/50 hover:bg-gray-800'}`}
                onClick={() => onSelectColor?.(idx)}
             >
                <div className="relative w-full aspect-square">
                    <div
                    className="w-full h-full rounded shadow-sm border border-gray-600/50"
                    style={{ backgroundColor: color }}
                    />
                    {/* Color Picker Input overlay */}
                    {onUpdateColor && (
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => onUpdateColor(idx, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title={`Edit Color ${letter}`}
                            onClick={(e) => e.stopPropagation()} // Prevent selecting when opening picker? Actually we probably want to select AND open picker if double clicked? For now separating selection (container click) from picking (input click) is hard with opacity 0.
                            // Better UX: Click container to select. Double click or small edit icon to change value.
                            // Given constraint "open custom color box on click", we can put the input in a small corner or make the whole thing the input. 
                            // But we also need "Selection".
                            // Compromise: Click container selects. Input is invisible but active? 
                            // If we make input active, clicking opens picker immediately. 
                            // Let's rely on standard input behavior: Clicking it opens picker. 
                            // But we also want to set 'selectedColorIndex'.
                            // We can use onInput or onClick on the input to also set selected index.
                        />
                    )}
                </div>
                <span className={`font-mono font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-400'}`}>{letter}</span>
             </div>
          </div>
        )})}
      </div>
    </div>
  );
};
