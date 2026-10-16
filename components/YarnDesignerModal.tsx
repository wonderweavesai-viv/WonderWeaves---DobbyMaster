import React, { useEffect, useRef, useState, useMemo } from 'react';
import { YarnDefinition, YarnModel, YarnCountSystem, FiberType, YarnConstruction } from '../types';
import { generateYarnTexture } from '../services/yarnRenderer';

const Slider: React.FC<{
    label: string; 
    value: number; 
    onChange: (value: number) => void; 
    min: number; 
    max: number; 
    step: number; 
    subLabel?: string;
}> = ({ label, value, onChange, min, max, step, subLabel }) => (
    <div>
        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
            <span>{label}</span>
            <span className="text-gray-300">{typeof value === 'number' ? value.toFixed(2) : value} {subLabel}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step} 
            value={value || 0} 
            onChange={e => onChange(parseFloat(e.target.value))} 
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
        />
    </div>
);

interface YarnDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  yarnId: string;
  yarnType: 'warp' | 'weft'; 
  initialYarn: YarnDefinition;
  onSave: (yarn: YarnDefinition) => void;
}

export const YarnDesignerModal: React.FC<YarnDesignerModalProps> = ({
  isOpen, onClose, yarnId, yarnType, initialYarn, onSave
}) => {
  const [yarn, setYarn] = useState<YarnDefinition>({
      countSystem: 'Nm',
      count: 28,
      ply: 1,
      price: 0,
      code: '',
      unevenness: 0.1,
      isExtraWeft: false,
      isExtraWarp: false,
      extraFloatOpacity: 0.08,
      extraOverlap: 0.0,
      floatWaviness: 0.0,
      bindingDepth: 0.05,
      floatTaper: 0.0,
      shadowAngle: 135,
      shadowThrow: 1.0,
      pileLength: 1.0,
      pileDensity: 0.6,
      pileThickness: 1.0,
      coreThickness: 0.4,
      directionalUniformity: 0.2,
      strength: 15,
      elongation: 5,
      ipi: 50,
      shadowStrength: 0.20,
      overfeedRatio: 1.5,
      twistAmount: 200,
      loopSize: 1.0,
      loopInterval: 0.5,
      loopRounding: 0.5,
      ...initialYarn
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
      setYarn({
          countSystem: 'Nm',
          count: 28,
          ply: 1,
          price: 0,
          code: '',
          unevenness: 0.1,
          isExtraWeft: false,
          isExtraWarp: false,
          extraFloatOpacity: 0.08,
          extraOverlap: 0.0,
          floatWaviness: 0.0,
          bindingDepth: 0.05,
          floatTaper: 0.0,
          shadowAngle: 135,
          shadowThrow: 1.0,
          pileLength: 1.0,
          pileDensity: 0.6,
          pileThickness: 1.0,
          coreThickness: 0.4,
          directionalUniformity: 0.2,
          strength: 15,
          elongation: 5,
          ipi: 50,
          shadowStrength: 0.20,
          overfeedRatio: 1.5,
          twistAmount: 200,
          loopSize: 1.0,
          loopInterval: 0.5,
          loopRounding: 0.5,
          ...initialYarn
      });
  }, [initialYarn, isOpen]);

  const calculateDerivedStats = (system: YarnCountSystem, count: number, ply: number, fiber: FiberType) => {
      const safeCount = Math.max(0.1, count); 
      let effectiveNm = 0;
      switch (system) {
          case 'Nm': effectiveNm = safeCount / ply; break;
          case 'Ne': effectiveNm = (safeCount * 1.6934) / ply; break;
          case 'Lea': effectiveNm = (safeCount * 0.6048) / ply; break;
          case 'Tex': effectiveNm = 1000 / (safeCount * ply); break;
          case 'Denier': effectiveNm = 9000 / (safeCount * ply); break;
          default: effectiveNm = safeCount / ply;
      }
      const tex = 1000 / effectiveNm;
      let diamCoeff = 0.037;
      if (['Silk', 'Synthetic', 'Lurex'].includes(fiber)) diamCoeff = 0.032;
      const diameterMm = diamCoeff * Math.sqrt(tex);
      const visualThickness = Math.sqrt(28 / effectiveNm);
      return { visualThickness: Math.min(2.5, Math.max(0.3, visualThickness)), diameterMm, tex };
  };

  const handlePhysicalChange = (field: keyof YarnDefinition, value: any) => {
      setYarn(prev => {
          const next = { ...prev, [field]: value };
          const stats = calculateDerivedStats(next.countSystem, next.count, next.ply, next.fiberType);
          return { ...next, thickness: parseFloat(stats.visualThickness.toFixed(2)) };
      });
  };

  const handleParamChange = (field: keyof YarnDefinition, value: any) => {
      setYarn(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0,0, canvas.width, canvas.height);
    const texture = generateYarnTexture(yarn, 144); 
    const centerX = canvas.width / 2;
    
    let drawScale = yarn.thickness;
    if (yarn.construction === 'chenille') drawScale = (yarn.coreThickness || 0.4) * 3.0;
    if (yarn.construction === 'boucle') drawScale = (yarn.coreThickness || 0.5) * 3.5;

    const coreWidth = 30 * drawScale;
    const drawWidth = (yarn.construction === 'chenille' || yarn.construction === 'boucle') ? coreWidth * 6.0 : coreWidth * 3.0; 
    
    ctx.save();
    ctx.translate(centerX, 20); ctx.rotate(Math.PI / 2);
    const pattern = ctx.createPattern(texture, 'repeat');
    if (pattern) {
        ctx.fillStyle = pattern;
        const matrix = new DOMMatrix(); 
        matrix.scaleSelf(1, drawWidth / texture.height); 
        pattern.setTransform(matrix);
        ctx.fillRect(0, -drawWidth/2, canvas.height - 40, drawWidth);
    }
    ctx.restore();
  }, [yarn]);

  const isExtraEnabled = yarnType === 'warp' ? yarn.isExtraWarp : yarn.isExtraWeft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h2 className="text-lg font-bold text-white">Yarn Designer - {yarnId} ({yarnType.toUpperCase()})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
            <div className="w-40 bg-gray-950 p-4 flex flex-col items-center border-r border-gray-800">
                <canvas ref={canvasRef} width={120} height={350} className="rounded-lg border border-gray-700 bg-gray-800 shadow-inner mb-4 flex-1 w-full" />
                <div className="text-xl font-bold text-white mb-4">{yarn.thickness.toFixed(2)}x</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-900 p-6">
                
                <section className="mb-6">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">Model & Physics</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase block mb-1">Spinning Type</label>
                                <select value={yarn.model} onChange={e => handlePhysicalChange('model', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded p-2 focus:outline-none">
                                    <option value="simple">Solid Ring</option>
                                    <option value="mouline">Mouline</option>
                                    <option value="grindle">Grindle (2-Tone)</option>
                                    <option value="melange">Melange</option>
                                    <option value="space-dyed">Space Dyed</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase block mb-1">Construction</label>
                                <select value={yarn.construction} onChange={e => handlePhysicalChange('construction', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded p-2 focus:outline-none">
                                    <option value="standard">Standard</option>
                                    <option value="slub">Slub</option>
                                    <option value="chenille">Chenille</option>
                                    <option value="boucle">Bouclé</option>
                                    <option value="tweed">Tweed</option>
                                </select>
                            </div>
                        </div>

                        {yarn.construction === 'boucle' && (
                            <div className="p-3 bg-pink-950/20 border border-pink-800/50 rounded-lg space-y-4 shadow-inner">
                                <label className="text-[10px] font-bold text-pink-500 uppercase tracking-widest block -mb-2">Bouclé Architecture</label>
                                <Slider label="Overfeed Ratio" value={yarn.overfeedRatio ?? 1.5} min={1.0} max={3.0} step={0.1} onChange={v => handleParamChange('overfeedRatio', v)} subLabel="eff. length" />
                                <Slider label="Loop Rounding" value={yarn.loopRounding ?? 0.5} min={0.0} max={1.0} step={0.05} onChange={v => handleParamChange('loopRounding', v)} subLabel="(bulb)" />
                                <Slider label="Loop Scale" value={yarn.loopSize ?? 1.0} min={0.5} max={2.5} step={0.1} onChange={v => handleParamChange('loopSize', v)} />
                                <Slider label="Loop Frequency" value={yarn.loopInterval ?? 0.5} min={0.1} max={2.0} step={0.1} onChange={v => handleParamChange('loopInterval', v)} />
                                <Slider label="Twist Amount" value={yarn.twistAmount ?? 200} min={50} max={1000} step={10} onChange={v => handleParamChange('twistAmount', v)} subLabel="t/m" />
                                
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Loop Color</label>
                                        <input type="color" value={yarn.loopColor || yarn.color} onChange={e => handleParamChange('loopColor', e.target.value)} className="w-full h-8 rounded cursor-pointer border border-gray-600 p-0" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">Binder Color</label>
                                        <input type="color" value={yarn.binderColor || '#888888'} onChange={e => handleParamChange('binderColor', e.target.value)} className="w-full h-8 rounded cursor-pointer border border-gray-600 p-0" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 pt-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Core Color</label>
                                    <input type="color" value={yarn.coreColor || '#888888'} onChange={e => handleParamChange('coreColor', e.target.value)} className="w-full h-8 rounded cursor-pointer border border-gray-600 p-0" />
                                </div>
                            </div>
                        )}

                        {['mouline', 'grindle', 'melange', 'space-dyed'].includes(yarn.model) && (
                            <div className="flex items-center gap-3 bg-gray-800 p-2 rounded border border-gray-700">
                                <input type="color" value={yarn.colorB || '#ffffff'} onChange={e => handleParamChange('colorB', e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-gray-600 p-0" />
                                <div className="flex-1"><span className="text-[10px] font-bold text-gray-500 uppercase block">Second Color (B)</span></div>
                            </div>
                        )}

                        <div className="p-3 bg-emerald-950/20 border border-emerald-800/50 rounded-lg space-y-4 shadow-inner">
                            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block -mb-2">Performance Data</label>
                            <Slider label="Tensile Strength" value={yarn.strength || 15} min={5} max={50} step={0.5} onChange={v => setYarn(p => ({...p, strength: v}))} subLabel="cN/tex" />
                            <Slider label="Elongation" value={yarn.elongation || 5} min={1} max={30} step={0.1} onChange={v => setYarn(p => ({...p, elongation: v}))} subLabel="%" />
                            <Slider label="IPI Index" value={yarn.ipi || 50} min={0} max={1000} step={10} onChange={v => setYarn(p => ({...p, ipi: v}))} subLabel="Imperfections" />
                        </div>
                        
                        <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-lg space-y-4 shadow-inner">
                            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block -mb-2">Universal Physics</label>
                            <Slider label="Overlap and Spread" value={yarn.extraOverlap ?? 0} min={0} max={1} step={0.05} onChange={v => setYarn(p => ({...p, extraOverlap: v}))} subLabel="flattening" />
                            <Slider label="Float Tapering" value={yarn.floatTaper ?? 0} min={0} max={0.5} step={0.05} onChange={v => setYarn(p => ({...p, floatTaper: v}))} subLabel="compression" />
                            <Slider label="Binding Shadow (AO)" value={yarn.bindingDepth ?? 0.05} min={0} max={1} step={0.05} onChange={v => setYarn(p => ({...p, bindingDepth: v}))} subLabel="interlacement depth" />
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-emerald-900/30">
                                <Slider label="Shadow Angle" value={yarn.shadowAngle ?? 135} min={0} max={360} step={5} onChange={v => setYarn(p => ({...p, shadowAngle: v}))} subLabel="deg" />
                                <Slider label="Shadow Throw" value={yarn.shadowThrow ?? 1.0} min={0} max={2.0} step={0.1} onChange={v => setYarn(p => ({...p, shadowThrow: v}))} />
                            </div>
                        </div>

                         <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <div>
                                <label className="text-xs font-bold text-gray-200">Extra {yarnType === 'warp' ? 'Warp' : 'Weft'} Float</label>
                                <p className="text-[10px] text-gray-500 uppercase tracking-tighter italic">Lancé / Swivel effects</p>
                            </div>
                            <button 
                                onClick={() => {
                                    if (yarnType === 'warp') setYarn(p => ({...p, isExtraWarp: !p.isExtraWarp}));
                                    else setYarn(p => ({...p, isExtraWeft: !p.isExtraWeft}));
                                }} 
                                className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${isExtraEnabled ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-650'}`}
                            >
                                {isExtraEnabled ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                         </div>

                        {isExtraEnabled && (
                            <div className="space-y-4 p-4 bg-gray-950/40 rounded-lg animate-in slide-in-from-top-2 border-l-2 border-emerald-600">
                                <Slider label="Float Waviness" value={yarn.floatWaviness ?? 0} min={0} max={1} step={0.05} onChange={v => setYarn(p => ({...p, floatWaviness: v}))} />
                                <Slider label="Reverse Side Opacity" value={yarn.extraFloatOpacity ?? 0.08} min={0} max={1} step={0.01} onChange={v => setYarn(p => ({...p, extraFloatOpacity: v}))} />
                            </div>
                        )}
                    </div>
                </section>

                <section className="mb-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">Physicals</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase block mb-1">Fiber</label>
                            <select value={yarn.fiberType} onChange={e => handlePhysicalChange('fiberType', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded p-2 focus:outline-none">
                                <option>Cotton</option>
                                <option>Poly-Cotton</option>
                                <option>Acrylic</option>
                                <option>Wool</option>
                                <option>Silk</option>
                                <option>Linen</option>
                                <option>Synthetic</option>
                                <option>Lurex</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase block mb-1">System</label>
                            <select value={yarn.countSystem} onChange={e => handlePhysicalChange('countSystem', e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded p-2 focus:outline-none">
                                <option>Nm</option><option>Ne</option><option>Tex</option><option>Denier</option><option>Lea</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Slider label="Count" value={yarn.count} min={1} max={300} step={1} onChange={v => handlePhysicalChange('count', v)} /></div>
                        <div><Slider label="Ply" value={yarn.ply} min={1} max={12} step={1} onChange={v => handlePhysicalChange('ply', v)} /></div>
                    </div>
                </section>

                <section className="mb-6">
                    <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-4 border-b border-gray-800 pb-1">Fibers & Hairs</h3>
                    <Slider label="Hair Density" value={yarn.hairiness || 0} min={0} max={1.0} step={0.1} onChange={(v: number) => handleParamChange('hairiness', v)} />
                    <Slider label="Hair Length" value={yarn.hairLength || 0} min={0} max={1.0} step={0.1} onChange={(v: number) => handleParamChange('hairLength', v)} />
                    <Slider label="Hair Thickness" value={yarn.hairThickness || 1} min={1} max={5} step={0.5} onChange={(v: number) => handleParamChange('hairThickness', v)} subLabel="(px)" />
                </section>
            </div>
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded">Cancel</button>
            <button onClick={() => { onSave(yarn); onClose(); }} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded shadow-lg">Save Yarn</button>
        </div>
      </div>
    </div>
  );
};