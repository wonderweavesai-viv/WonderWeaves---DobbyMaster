
import React from 'react';
import { WeaveSettings } from '../types';

interface ControlPanelProps {
  settings: WeaveSettings;
  onSettingsChange: (newSettings: WeaveSettings) => void;
  dentingPattern?: string;
  onDentingChange?: (pattern: string) => void;
  onLoadPreset: (draft: boolean[][], pegPlan: boolean[][]) => void;
  onSimulate: () => void;
  onOpenLibrary: () => void;
  onSnapshot: () => void;
}

const SliderInput: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    subLabel?: string;
    onInteractionStart?: () => void;
}> = ({ label, value, onChange, min, max, step, subLabel, onInteractionStart }) => (
    <div className="mb-5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between">
            <span>{label} {subLabel && <span className="text-gray-400 normal-case ml-1">({subLabel})</span>}</span>
            <span className="text-blue-600 font-mono">{value}</span>
        </label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            onPointerDown={onInteractionStart}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
        />
    </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
    settings, onSettingsChange, dentingPattern, onDentingChange, onLoadPreset, onSimulate, onOpenLibrary, onSnapshot
}) => {
  const handleSettingChange = (key: keyof WeaveSettings, value: number) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  
  const generatePreset = (type: string) => {
      onSnapshot(); 
      const { harnesses, warpThreads, weftPicks } = settings;
      let newDraft: boolean[][] = Array.from({ length: harnesses }, () => Array(warpThreads).fill(false));
      let newPegPlan: boolean[][] = Array.from({ length: weftPicks }, () => Array(harnesses).fill(false));

      for(let w = 0; w < warpThreads; w++) {
          newDraft[w % harnesses][w] = true;
      }

      switch (type) {
          case 'plain':
              for(let p = 0; p < weftPicks; p++) {
                  for(let h = 0; h < harnesses; h++) {
                       if (p % 2 === 0) newPegPlan[p][h] = h % 2 === 0;
                       else newPegPlan[p][h] = h % 2 !== 0;
                  }
              }
              break;
          case 'twill22':
              for(let p = 0; p < weftPicks; p++) {
                  for(let h = 0; h < harnesses; h++) {
                      if(harnesses >= 4) {
                           newPegPlan[p][h] = (h - p + harnesses) % harnesses < 2;
                      } else {
                          newPegPlan[p][h] = (h + p) % 2 === 0;
                      }
                  }
              }
              break;
            case 'twill21':
                for(let p = 0; p < weftPicks; p++) {
                    for(let h = 0; h < harnesses; h++) {
                        newPegPlan[p][h] = (h - p + harnesses) % 3 < 2; 
                    }
                }
                break;
            case 'satin5':
                for(let p = 0; p < weftPicks; p++) {
                     const step = (p * 2) % 5;
                     for(let h = 0; h < harnesses; h++) {
                         newPegPlan[p][h] = (h % 5) === step;
                     }
                }
                break;
      }
      onLoadPreset(newDraft, newPegPlan);
  };

  return (
    <div>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Configuration</h2>
      
      <SliderInput 
        label="Warp Threads"
        value={settings.warpThreads}
        onChange={(v) => handleSettingChange('warpThreads', v)}
        onInteractionStart={onSnapshot}
        min={4} max={128} step={4}
      />
      <SliderInput 
        label="Weft Picks"
        value={settings.weftPicks}
        onChange={(v) => handleSettingChange('weftPicks', v)}
        onInteractionStart={onSnapshot}
        min={4} max={128} step={4}
      />
      <SliderInput 
        label="Harnesses"
        value={settings.harnesses}
        onChange={(v) => handleSettingChange('harnesses', v)}
        onInteractionStart={onSnapshot}
        min={2} max={120} step={1}
      />

      <div className="h-px bg-gray-200 my-4" />

      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">View</h2>
      <SliderInput 
        label="Grid Division"
        value={settings.gridDivision}
        onChange={(v) => handleSettingChange('gridDivision', v)}
        onInteractionStart={onSnapshot}
        min={2} max={12} step={1}
        subLabel="cells"
      />

      <div className="h-px bg-gray-200 my-4" />

      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Density</h2>
      <SliderInput 
        label="Ends Per Inch"
        subLabel={`~${Math.round(settings.epi / 2.54)} epc`}
        value={settings.epi}
        onChange={(v) => handleSettingChange('epi', v)}
        onInteractionStart={onSnapshot}
        min={8} max={120} step={1}
      />
      <SliderInput 
        label="Picks Per Inch"
        subLabel={`~${Math.round(settings.ppi / 2.54)} ppc`}
        value={settings.ppi}
        onChange={(v) => handleSettingChange('ppi', v)}
        onInteractionStart={onSnapshot}
        min={8} max={120} step={1}
      />
      
      {/* Denting Input */}
      {dentingPattern !== undefined && onDentingChange && (
          <div className="mb-5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Denting Pattern</label>
              <input 
                type="text" 
                value={dentingPattern}
                onChange={(e) => onDentingChange(e.target.value)}
                placeholder="e.g. 2, 2"
                className="w-full bg-white border border-gray-300 rounded p-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">Threads per dent (comma separated)</p>
          </div>
      )}
    
      <div className="grid grid-cols-2 gap-2 mt-2">
         <button
            onClick={onOpenLibrary}
            className="py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 rounded-md font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Library
        </button>
        <button
            onClick={onSimulate}
            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold text-sm shadow transition-colors flex items-center justify-center gap-2"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            Simulate
        </button>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      <div className="mb-4">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Quick Presets</label>
          <select 
            className="w-full bg-white text-gray-900 rounded-md p-2 text-sm border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onChange={(e) => generatePreset(e.target.value)}
            defaultValue=""
          >
              <option value="" disabled>Select a weave...</option>
              <option value="plain">Plain Weave</option>
              <option value="twill22">2/2 Twill (Balanced)</option>
              <option value="twill21">2/1 Twill (Warp Faced)</option>
              <option value="satin5">5-Shaft Satin</option>
          </select>
      </div>
    </div>
  );
};
