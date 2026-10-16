import React, { useEffect, useState, useRef, MouseEvent, WheelEvent } from 'react';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, ChevronDownIcon, DownloadIcon, FlipIcon, RulerIcon, CubeIcon, EyeOffIcon, EyeIcon, CheckIcon } from './icons';
import { YarnDefinition, DensityZone } from '../types';
import { renderFabricToCanvas } from '../services/fabricRenderer';
import { Fabric3DStudio } from './Fabric3DStudio';

// Tauri Interop
const isTauri = !!(window as any).__TAURI__;
let invoke: any = null;
if (isTauri) {
    import('@tauri-apps/api/core').then(mod => invoke = mod.invoke);
}

interface FabricSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  weavePattern: string[][];
  structure: boolean[][]; 
  epi: number;
  ppi: number;
  dentingPlan?: number[];
  weftZones?: DensityZone[];
  warpYarns: { [key: string]: YarnDefinition };
  weftYarns: { [key: string]: YarnDefinition };
  warpYarnSequence: string[];
  weftYarnSequence: string[];
  embedded?: boolean; 
}

const SVGRuler: React.FC<{
    orientation: 'horizontal' | 'vertical';
    viewportSize: number;
    zoom: number;
    pan: number;
    unit: 'inch' | 'cm';
}> = ({ orientation, viewportSize, zoom, pan, unit }) => {
    const pixelsPerUnit = unit === 'inch' ? 96 : (96 / 2.54);
    const scaledPixelsPerUnit = pixelsPerUnit * zoom;
    const divisions = unit === 'inch' ? 8 : 10;
    
    const ticks = [];
    const startIndex = Math.floor(-pan / scaledPixelsPerUnit);
    const numUnits = Math.ceil(viewportSize / scaledPixelsPerUnit) + 2;

    for (let i = 0; i < numUnits; i++) {
        const unitIndex = startIndex + i;
        const basePos = pan + (unitIndex * scaledPixelsPerUnit);
        
        if (basePos < -scaledPixelsPerUnit || basePos > viewportSize + scaledPixelsPerUnit) continue;

        ticks.push(
            <g key={`unit-${unitIndex}`} transform={orientation === 'horizontal' ? `translate(${basePos}, 0)` : `translate(0, ${basePos})`}>
                <line 
                    x1="0.5" y1="0.5" 
                    x2={orientation === 'horizontal' ? "0.5" : "15"} 
                    y2={orientation === 'horizontal' ? "15" : "0.5"} 
                    stroke="currentColor" strokeWidth="1.2" 
                />
                <text 
                    x={orientation === 'horizontal' ? "4" : "12"} 
                    y={orientation === 'horizontal' ? "12" : "3"} 
                    fontSize="9" fontWeight="bold" 
                    textAnchor={orientation === 'horizontal' ? "start" : "end"}
                    className="fill-gray-500 font-sans select-none"
                    transform={orientation === 'vertical' ? `rotate(-90 12 3)` : ''}
                >
                    {unitIndex}
                </text>
                
                {Array.from({ length: divisions - 1 }).map((_, j) => {
                    const subPos = (j + 1) * (scaledPixelsPerUnit / divisions);
                    const isHalf = (j + 1) === Math.floor(divisions / 2);
                    const h = isHalf ? 10 : 5;
                    return (
                        <line 
                            key={`sub-${unitIndex}-${j}`}
                            x1={orientation === 'horizontal' ? subPos : "0"} 
                            y1={orientation === 'horizontal' ? "0" : subPos}
                            x2={orientation === 'horizontal' ? subPos : h} 
                            y2={orientation === 'horizontal' ? h : subPos}
                            stroke="currentColor" strokeWidth="0.5"
                            className="text-gray-300"
                        />
                    );
                })}
            </g>
        );
    }

    return (
        <svg 
            className={`absolute z-30 pointer-events-none bg-white/95 backdrop-blur-sm border-gray-200 text-gray-400 ${orientation === 'horizontal' ? 'w-full h-6 border-b left-0 top-0' : 'h-full w-6 border-r left-0 top-0'}`}
        >
            {ticks}
        </svg>
    );
};

export const FabricSimulationModal: React.FC<FabricSimulationModalProps> = ({
  isOpen, onClose, weavePattern, structure, epi, ppi, dentingPlan, weftZones,
  warpYarns, weftYarns, warpYarnSequence, weftYarnSequence, embedded
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [simulationDpi, setSimulationDpi] = useState<number>(144); 
  const [smoothing, setSmoothing] = useState<'high' | 'medium' | 'low' | 'none'>('high');
  const [viewSide, setViewSide] = useState<'face' | 'back'>('face');
  const [bgMode, setBgMode] = useState<'dark' | 'light'>('dark');
  const [rulerUnit, setRulerUnit] = useState<'inch' | 'cm' | 'none'>('inch');
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');
  const [shadowAngle, setShadowAngle] = useState<number>(135);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDpiMenuOpen, setIsDpiMenuOpen] = useState(false);
  const [isSmoothingMenuOpen, setIsSmoothingMenuOpen] = useState(false);
  const [isLightMenuOpen, setIsLightMenuOpen] = useState(false);
  
  const [transform, setTransform] = useState({ scale: 1.0, rotate: 0, x: 0, y: 0 }); 
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  
  const DISPLAY_WIDTH = 1200;
  const DISPLAY_HEIGHT = 720;

  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
        if (viewportRef.current) {
            setViewportSize({
                w: viewportRef.current.clientWidth,
                h: viewportRef.current.clientHeight
            });
        }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen || !weavePattern.length || !weavePattern[0]?.length) return;

    setIsGenerating(true);
    
    const generate = async () => {
        try {
            if (isTauri && invoke) {
                console.log("Using Rust Native Fabric Tracer...");
                // Calculate physical dimensions in pixels based on DPI
                // Standard swatch size approx 8x6 inches for preview, or bigger for high res
                // Let's target a high res buffer for native render
                const targetW = Math.round((DISPLAY_WIDTH / 96) * simulationDpi);
                const targetH = Math.round((DISPLAY_HEIGHT / 96) * simulationDpi);

                // Prepare Rust Input
                const rustConfig = {
                    width: targetW,
                    height: targetH,
                    epi: epi,
                    ppi: ppi,
                    warp_yarns: warpYarns,
                    weft_yarns: weftYarns,
                    warp_pattern: warpYarnSequence.length > 0 ? warpYarnSequence : ['A'],
                    weft_pattern: weftYarnSequence.length > 0 ? weftYarnSequence : ['A'],
                    structure: viewSide === 'face' ? structure : structure.map(row => row.map(c => !c))
                };

                const b64 = await invoke('render_fabric_native', { config: rustConfig });
                setDataUrl(b64);
            } else {
                // Fallback to JS Canvas
                const canvas = renderFabricToCanvas({
                    weavePattern, structure, epi, ppi, dentingPlan, weftZones,
                    warpYarns, weftYarns,
                    warpYarnSequence: warpYarnSequence.length > 0 ? warpYarnSequence : ['A'],
                    weftYarnSequence: weftYarnSequence.length > 0 ? weftYarnSequence : ['A'],
                    viewSide,
                    dpi: simulationDpi,
                    smoothingQuality: smoothing,
                    width: DISPLAY_WIDTH,
                    height: DISPLAY_HEIGHT,
                    hideFloats: false,
                    backgroundColor: bgMode === 'dark' ? '#050505' : '#ffffff',
                    overrideShadowAngle: shadowAngle
                });
                setDataUrl(canvas.toDataURL());
            }
        } catch (err) {
            console.error("Fabric rendering failed:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    // Small delay to allow UI to render loading state
    const timer = setTimeout(generate, 50);
    return () => clearTimeout(timer);

  }, [isOpen, weavePattern, structure, epi, ppi, dentingPlan, weftZones, warpYarns, weftYarns, warpYarnSequence, weftYarnSequence, simulationDpi, smoothing, viewSide, bgMode, shadowAngle]);

  const handleDownload = () => {
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `fabric-simulation-${epi}epi-${ppi}ppi.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleWheel = (e: WheelEvent) => { 
      e.stopPropagation(); 
      e.preventDefault(); 
      const zoomStep = 0.15;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(Math.max(transform.scale + (direction * zoomStep), 0.1), 8);
      setTransform(prev => ({ ...prev, scale: Math.round(newScale * 100) / 100 })); 
  };

  const handleMouseDown = (e: MouseEvent) => { 
      if (e.button === 0) {
          e.preventDefault(); 
          setIsDragging(true); 
          setLastMousePos({ x: e.clientX, y: e.clientY });
      }
  };
  
  const handleMouseMove = (e: MouseEvent) => { 
      if (!isDragging) return; 
      e.preventDefault(); 
      const dx = e.clientX - lastMousePos.x; 
      const dy = e.clientY - lastMousePos.y; 
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); 
      setLastMousePos({ x: e.clientX, y: e.clientY }); 
  };
  
  const handleMouseUp = () => { setIsDragging(false); };
  
  const handleReset = () => { 
      setTransform({ scale: 1.0, rotate: 0, x: 0, y: 0 }); 
  };
  
  const handlePrintSize = () => {
      setTransform({ scale: 1.0, rotate: 0, x: 0, y: 0 });
  };

  const dpiOptions = [72, 96, 144, 300, 600];
  const smoothingOptions: ('high' | 'medium' | 'low' | 'none')[] = ['high', 'medium', 'low', 'none'];
  const lightPresets = [
      { angle: 45, label: 'Bottom Right (45°)' },
      { angle: 90, label: 'Bottom (90°)' },
      { angle: 135, label: 'Standard (135°)' },
      { angle: 180, label: 'Left (180°)' },
      { angle: 225, label: 'Top Left (225°)' },
      { angle: 270, label: 'Top (270°)' },
      { angle: 315, label: 'Top Right (315°)' }
  ];

  const rulerPanX = (viewportSize.w / 2) + transform.x - (DISPLAY_WIDTH * transform.scale / 2);
  const rulerPanY = (viewportSize.h / 2) + transform.y - (DISPLAY_HEIGHT * transform.scale / 2);

  if (!isOpen) return null;

  return (
    <div className={embedded ? "w-full h-full flex flex-col bg-gray-900 overflow-hidden" : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"}>
      <div className={embedded ? "flex flex-col flex-1 overflow-hidden" : "bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden"}>
        
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Fabric Simulation {isTauri && <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded ml-2 uppercase">Native Engine</span>}</h2>
                <p className="text-xs text-gray-400 font-mono mt-1">{epi} EPI × {ppi} PPI</p>
              </div>
              
              <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
                  <button onClick={() => setActiveTab('2d')} className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${activeTab === '2d' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>2D View</button>
                  <button onClick={() => setActiveTab('3d')} className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${activeTab === '3d' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>3D View</button>
              </div>

              {activeTab === '2d' && (
                  <div className="flex items-center gap-4 border-l border-gray-800 pl-4 ml-2">
                        <button
                            onClick={() => setViewSide(prev => prev === 'face' ? 'back' : 'face')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${viewSide === 'back' ? 'bg-orange-900/50 border-orange-700 text-orange-200' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                        >
                            <FlipIcon className="w-4 h-4" />
                            <span>{viewSide === 'face' ? 'Face' : 'Back'}</span>
                        </button>

                        <button
                            onClick={() => setBgMode(prev => prev === 'dark' ? 'light' : 'dark')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${bgMode === 'light' ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                        >
                            <div className={`w-3 h-3 rounded-full border ${bgMode === 'dark' ? 'bg-black border-gray-600' : 'bg-white border-gray-300'}`}></div>
                            <span>{bgMode === 'dark' ? 'Dark bg' : 'Light bg'}</span>
                        </button>

                        <div className="relative">
                            <button onClick={() => { setIsLightMenuOpen(!isLightMenuOpen); setIsSmoothingMenuOpen(false); setIsDpiMenuOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs font-bold text-gray-200 hover:bg-gray-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                                Light: {shadowAngle}° <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                            </button>
                            {isLightMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded shadow-xl overflow-hidden z-50">
                                    {lightPresets.map(preset => (
                                        <button key={preset.angle} onClick={() => { setShadowAngle(preset.angle); setIsLightMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-700 flex justify-between items-center ${shadowAngle === preset.angle ? 'text-blue-400 bg-gray-700/50' : 'text-gray-300'}`}>
                                            <span>{preset.label}</span>
                                            {shadowAngle === preset.angle && <CheckIcon className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!isTauri && (
                            <div className="relative">
                                <button onClick={() => { setIsSmoothingMenuOpen(!isSmoothingMenuOpen); setIsLightMenuOpen(false); setIsDpiMenuOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs font-bold text-gray-200 hover:bg-gray-700 transition-colors">
                                    Smoothing: {smoothing.toUpperCase()} <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                </button>
                                {isSmoothingMenuOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded shadow-xl overflow-hidden z-50">
                                        {smoothingOptions.map(opt => (
                                            <button key={opt} onClick={() => { setSmoothing(opt); setIsSmoothingMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-700 ${smoothing === opt ? 'text-blue-400' : 'text-gray-300'}`}>{opt.toUpperCase()}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="relative">
                            <button onClick={() => { setIsDpiMenuOpen(!isDpiMenuOpen); setIsLightMenuOpen(false); setIsSmoothingMenuOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs font-bold text-gray-200 hover:bg-gray-700 transition-colors">
                                {simulationDpi} DPI <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                            </button>
                            {isDpiMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded shadow-xl overflow-hidden z-50">
                                    {dpiOptions.map(dpi => (
                                        <button key={dpi} onClick={() => { setSimulationDpi(dpi); setIsDpiMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-700 ${simulationDpi === dpi ? 'text-blue-400' : 'text-gray-300'}`}>{dpi} DPI</button>
                                    ))}
                                </div>
                            )}
                        </div>
                  </div>
              )}
          </div>
          {!embedded && <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        </div>

        <div className="flex-1 bg-gray-950 overflow-hidden relative flex items-center justify-center p-0">
             {activeTab === '3d' ? (
                 <Fabric3DStudio weavePattern={weavePattern} structure={structure} warpYarns={warpYarns} weftYarns={weftYarns} warpYarnSequence={warpYarnSequence} weftYarnSequence={weftYarnSequence} textureUrl={dataUrl} epi={epi} ppi={ppi} />
             ) : (
                 <div className="w-full h-full relative overflow-hidden flex flex-col" ref={viewportRef}>
                    <div 
                        className={`flex-1 relative flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} 
                        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    >
                        {rulerUnit !== 'none' && (
                            <>
                                <SVGRuler orientation="horizontal" viewportSize={viewportSize.w} zoom={transform.scale} pan={rulerPanX} unit={rulerUnit as any} />
                                <SVGRuler orientation="vertical" viewportSize={viewportSize.h} zoom={transform.scale} pan={rulerPanY} unit={rulerUnit as any} />
                            </>
                        )}

                        <div 
                            className={`shadow-2xl shadow-black ring-1 ring-white/10 relative z-10 transition-transform ${isDragging ? 'duration-0' : 'duration-150'} ${bgMode === 'dark' ? 'bg-[#050505]' : 'bg-white'}`} 
                            style={{ 
                                width: `${DISPLAY_WIDTH}px`, 
                                height: `${DISPLAY_HEIGHT}px`, 
                                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) translateZ(0)`, 
                                transformOrigin: 'center center',
                                imageRendering: 'auto',
                                backfaceVisibility: 'hidden'
                            }}
                        >
                            {isGenerating && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div><span className="text-white font-medium text-sm">Weaving ({isTauri ? 'Native' : 'JS'})...</span></div>}
                            {dataUrl && <img src={dataUrl} alt="Fabric Simulation" className="w-full h-full object-cover" style={{ pointerEvents: 'none', display: 'block', width: `${DISPLAY_WIDTH}px`, height: `${DISPLAY_HEIGHT}px` }} />}
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur-md p-1.5 rounded-lg border border-gray-700 shadow-2xl z-40 flex items-center gap-1">
                        <button onClick={() => setTransform(prev => ({...prev, scale: Math.round(Math.max(0.1, prev.scale - 0.25) * 100) / 100}))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ZoomOutIcon className="w-5 h-5"/></button>
                        <button onClick={handlePrintSize} className="px-3 py-1.5 text-[10px] font-bold text-blue-400 hover:bg-gray-700 rounded transition-colors uppercase tracking-widest border border-blue-900/30">1:1 Zoom</button>
                        <div className="px-2 min-w-[3.5rem] text-center text-[11px] font-mono font-bold text-white select-none">{Math.round(transform.scale * 100)}%</div>
                        <button onClick={() => setTransform(prev => ({...prev, scale: Math.round(Math.min(8, prev.scale + 0.25) * 100) / 100}))} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ZoomInIcon className="w-5 h-5"/></button>
                        <button onClick={handleReset} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ResetZoomIcon className="w-5 h-5"/></button>
                        <div className="w-px h-6 bg-gray-600 mx-1"></div>
                        <button onClick={handleDownload} className="p-2 text-blue-400 hover:text-white hover:bg-blue-600 rounded"><DownloadIcon className="w-5 h-5"/></button>
                        <div className="w-px h-6 bg-gray-600 mx-1"></div>
                        <button onClick={() => setRulerUnit(prev => prev === 'inch' ? 'cm' : (prev === 'cm' ? 'none' : 'inch'))} className={`p-2 rounded ${rulerUnit !== 'none' ? 'text-blue-400 bg-blue-900/20' : 'text-gray-400'}`} title="Toggle Ruler"><RulerIcon className="w-5 h-5"/></button>
                    </div>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
};