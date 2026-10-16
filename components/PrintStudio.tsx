import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { WeaveSettings, YarnDefinition, WeavePattern, Colorway } from '../types';
import { PrinterIcon, CheckIcon, LayersIcon, GridFillIcon, PaletteIcon, SwatchIcon, TableIcon, GridIcon, ChevronDownIcon } from './icons';
import { renderFabricToCanvas } from '../services/fabricRenderer';
import { applyZigZagBorder, renderGridToDataUrl } from '../services/pdfGenerator';
import { expandPatternString } from '../utils/patternParser';

interface PrintStudioProps {
    settings: WeaveSettings;
    draft: boolean[][];
    pegPlan: boolean[][];
    warpYarns: Record<string, YarnDefinition>;
    weftYarns: Record<string, YarnDefinition>;
    warpPatternString: string;
    weftPatternString: string;
    weavePattern: WeavePattern;
    dentingPlan: number[];
    colorways: Colorway[];
}

type PrintSubModule = 'swatch' | 'colorways' | 'multi';

const DPI_OPTIONS = [72, 144, 192, 300, 600];

export const PrintStudio: React.FC<PrintStudioProps> = ({
    settings, draft, pegPlan, warpYarns, weftYarns, warpPatternString, weftPatternString, weavePattern, dentingPlan, colorways
}) => {
    const [activeModule, setActiveModule] = useState<PrintSubModule>('swatch');
    
    // Swatch Print Settings
    const [swatchOptions, setSwatchOptions] = useState({
        widthMm: 120,
        heightMm: 80,
        edgeStyle: 'pinking' as 'straight' | 'pinking',
        dpi: 300,
        showPalette: true,
        showPatterns: true,
        showGrids: true
    });

    // Colorways Print Settings
    const [colorwayOptions, setColorwayOptions] = useState({
        selectedIds: [] as string[],
        widthMm: 80,
        heightMm: 60,
        edgeStyle: 'pinking' as 'straight' | 'pinking',
        dpi: 192,
        showPalette: true
    });

    const toggleColorwaySelection = (id: string) => {
        setColorwayOptions(prev => {
            const next = { ...prev };
            if (next.selectedIds.includes(id)) {
                next.selectedIds = next.selectedIds.filter(i => i !== id);
            } else {
                next.selectedIds = [...next.selectedIds, id];
            }
            return next;
        });
    };

    const handlePrintSwatch = async () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let currentY = 25;

        // Title
        doc.setFontSize(18);
        doc.text("Design Swatch Print", margin, currentY);
        currentY += 10;

        // Swatch Rendering
        const dpi = swatchOptions.dpi;
        const widthPx = (swatchOptions.widthMm / 25.4) * 96;
        const heightPx = (swatchOptions.heightMm / 25.4) * 96;

        const canvas = renderFabricToCanvas({
            weavePattern: weavePattern.pattern,
            structure: weavePattern.structure,
            epi: settings.epi,
            ppi: settings.ppi,
            dentingPlan,
            warpYarns,
            weftYarns,
            warpYarnSequence: expandPatternString(warpPatternString),
            weftYarnSequence: expandPatternString(weftPatternString),
            viewSide: 'face',
            dpi: dpi,
            width: widthPx,
            height: heightPx
        });

        const finalSwatch = swatchOptions.edgeStyle === 'pinking' ? applyZigZagBorder(canvas) : canvas;
        doc.addImage(finalSwatch.toDataURL('image/png'), 'PNG', margin, currentY, swatchOptions.widthMm, swatchOptions.heightMm);
        currentY += swatchOptions.heightMm + 15;

        // Metadata
        doc.setFontSize(10);
        doc.text(`Dimensions: ${settings.warpThreads} Ends x ${settings.weftPicks} Picks | Set: ${settings.epi} EPI x ${settings.ppi} PPI`, margin, currentY);
        currentY += 10;

        // Grids
        if (swatchOptions.showGrids) {
            const gridWidth = (pageWidth - (margin * 3)) / 2;
            const draftUrl = renderGridToDataUrl(draft, 400, 400 * (draft.length / draft[0].length));
            const pegUrl = renderGridToDataUrl(pegPlan, 400, 400 * (pegPlan.length / pegPlan[0].length));
            
            doc.addImage(draftUrl, 'PNG', margin, currentY, gridWidth, gridWidth * (draft.length / draft[0].length));
            doc.addImage(pegUrl, 'PNG', margin + gridWidth + margin, currentY, gridWidth, gridWidth * (pegPlan.length / pegPlan[0].length));
            
            doc.setFontSize(8);
            doc.text("Threading Draft", margin, currentY - 2);
            doc.text("Treadling Peg Plan", margin + gridWidth + margin, currentY - 2);
            
            currentY += Math.max(gridWidth * (draft.length / draft[0].length), gridWidth * (pegPlan.length / pegPlan[0].length)) + 15;
        }

        // Palette
        if (swatchOptions.showPalette) {
            doc.setFontSize(12);
            doc.text("Color Palette", margin, currentY);
            currentY += 6;
            const uniqueColors = Array.from(new Set([
                ...expandPatternString(warpPatternString).map(c => warpYarns[c]?.color),
                ...expandPatternString(weftPatternString).map(c => weftYarns[c]?.color)
            ])).filter(Boolean) as string[];

            let chipX = margin;
            uniqueColors.forEach((color, i) => {
                doc.setFillColor(color);
                doc.rect(chipX, currentY, 10, 10, 'F');
                chipX += 12;
                if (chipX > pageWidth - margin - 10) {
                    chipX = margin;
                    currentY += 12;
                }
            });
        }

        doc.save(`swatch-${Date.now()}.pdf`);
    };

    const handlePrintColorways = async () => {
        if (colorwayOptions.selectedIds.length === 0) {
            alert("Please select at least one colorway.");
            return;
        }

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let currentY = 25;

        doc.setFontSize(18);
        doc.text("Colorway Collection", margin, currentY);
        currentY += 15;

        const dpi = colorwayOptions.dpi;

        for (const id of colorwayOptions.selectedIds) {
            const cw = colorways.find(c => c.id === id);
            if (!cw) continue;

            // Page Break Check
            if (currentY + colorwayOptions.heightMm + 20 > 280) {
                doc.addPage();
                currentY = 25;
            }

            doc.setFontSize(12);
            doc.text(cw.name, margin, currentY);
            currentY += 5;

            const widthPx = (colorwayOptions.widthMm / 25.4) * 96;
            const heightPx = (colorwayOptions.heightMm / 25.4) * 96;

            const canvas = renderFabricToCanvas({
                weavePattern: weavePattern.pattern,
                structure: weavePattern.structure,
                epi: settings.epi,
                ppi: settings.ppi,
                dentingPlan,
                warpYarns: cw.warpYarns,
                weftYarns: cw.weftYarns,
                warpYarnSequence: expandPatternString(warpPatternString),
                weftYarnSequence: expandPatternString(weftPatternString),
                viewSide: 'face',
                dpi: dpi,
                width: widthPx,
                height: heightPx
            });

            const finalImg = colorwayOptions.edgeStyle === 'pinking' ? applyZigZagBorder(canvas) : canvas;
            doc.addImage(finalImg.toDataURL('image/png'), 'PNG', margin, currentY, colorwayOptions.widthMm, colorwayOptions.heightMm);

            if (colorwayOptions.showPalette) {
                const uniqueColors = Array.from(new Set([
                    ...expandPatternString(warpPatternString).map(c => cw.warpYarns[c]?.color),
                    ...expandPatternString(weftPatternString).map(c => cw.weftYarns[c]?.color)
                ])).filter(Boolean) as string[];

                let chipX = margin + colorwayOptions.widthMm + 10;
                let chipY = currentY;
                uniqueColors.forEach(color => {
                    doc.setFillColor(color);
                    doc.rect(chipX, chipY, 8, 8, 'F');
                    chipY += 10;
                    if (chipY > currentY + colorwayOptions.heightMm - 8) {
                        chipY = currentY;
                        chipX += 10;
                    }
                });
            }

            currentY += colorwayOptions.heightMm + 20;
        }

        doc.save(`colorways-${Date.now()}.pdf`);
    };

    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden font-sans text-gray-900">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold tracking-tight">Print Studio</h2>
                    <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Document Production</p>
                </div>
                <div className="flex-1 p-4 space-y-2">
                    <button 
                        onClick={() => setActiveModule('swatch')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${activeModule === 'swatch' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <SwatchIcon className="w-5 h-5" /> Design Swatch
                    </button>
                    <button 
                        onClick={() => setActiveModule('colorways')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${activeModule === 'colorways' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <PaletteIcon className="w-5 h-5" /> Colorways
                    </button>
                    <button 
                        disabled
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm text-gray-300 cursor-not-allowed"
                    >
                        <GridIcon className="w-5 h-5" /> Multi Design <span className="text-[8px] bg-gray-100 text-gray-400 px-1 rounded">Soon</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
                <div className="flex-1 overflow-y-auto p-10">
                    {activeModule === 'swatch' && (
                        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-10 animate-in fade-in slide-in-from-bottom-4">
                            {/* Options Panel */}
                            <div className="w-full md:w-80 space-y-8 shrink-0">
                                <section>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Swatch Geometry</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Width (mm)</label>
                                            <input 
                                                type="number" 
                                                value={swatchOptions.widthMm} 
                                                onChange={e => setSwatchOptions({...swatchOptions, widthMm: parseInt(e.target.value) || 10})}
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Height (mm)</label>
                                            <input 
                                                type="number" 
                                                value={swatchOptions.heightMm} 
                                                onChange={e => setSwatchOptions({...swatchOptions, heightMm: parseInt(e.target.value) || 10})}
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Quality & Presentation</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                            <span className="text-xs font-bold text-gray-700">Simulation DPI</span>
                                            <select 
                                                value={swatchOptions.dpi}
                                                onChange={e => setSwatchOptions({...swatchOptions, dpi: parseInt(e.target.value)})}
                                                className="bg-gray-100 border-none rounded text-[10px] font-bold py-1 px-2 focus:ring-0 outline-none"
                                            >
                                                {DPI_OPTIONS.map(dpi => (
                                                    <option key={dpi} value={dpi}>{dpi} DPI</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                            <span className="text-xs font-bold text-gray-700">Edge Finish</span>
                                            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                                <button onClick={() => setSwatchOptions({...swatchOptions, edgeStyle: 'straight'})} className={`px-2 py-1 text-[9px] font-bold rounded ${swatchOptions.edgeStyle === 'straight' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Straight</button>
                                                <button onClick={() => setSwatchOptions({...swatchOptions, edgeStyle: 'pinking'})} className={`px-2 py-1 text-[9px] font-bold rounded ${swatchOptions.edgeStyle === 'pinking' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Pinking</button>
                                            </div>
                                        </div>
                                        
                                        {[
                                            {id: 'showPalette', label: 'Color Legend'},
                                            {id: 'showPatterns', label: 'Pattern Strings'},
                                            {id: 'showGrids', label: 'Technical Grids'}
                                        ].map(opt => (
                                            <label key={opt.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer group">
                                                <span className="text-xs font-bold text-gray-700">{opt.label}</span>
                                                <input 
                                                    type="checkbox" 
                                                    checked={(swatchOptions as any)[opt.id]} 
                                                    onChange={e => setSwatchOptions({...swatchOptions, [opt.id]: e.target.checked})}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </section>

                                <button 
                                    onClick={handlePrintSwatch}
                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all active:scale-95"
                                >
                                    <PrinterIcon className="w-5 h-5" /> Generate Swatch PDF
                                </button>
                            </div>

                            {/* Preview Panel */}
                            <div className="flex-1 flex flex-col gap-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">A4 Page Simulation</h3>
                                <div className="aspect-[210/297] bg-white shadow-2xl rounded border border-gray-200 relative p-12 flex flex-col overflow-hidden">
                                    <div className="text-xl font-bold text-gray-800 mb-8">Design Swatch Print</div>
                                    <div className={`border-2 border-dashed border-gray-100 relative bg-gray-50 flex items-center justify-center overflow-hidden`} style={{ width: `${(swatchOptions.widthMm / 210) * 100}%`, height: `${(swatchOptions.heightMm / 297) * 100}%` }}>
                                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">
                                            {swatchOptions.edgeStyle === 'pinking' ? 'ZigZag Swatch Area' : 'Straight Swatch Area'}
                                            <div className="mt-1 font-mono text-[8px]">{swatchOptions.widthMm} x {swatchOptions.heightMm} mm</div>
                                            <div className="text-[7px] text-gray-400 mt-0.5">{swatchOptions.dpi} DPI Simulation</div>
                                        </div>
                                    </div>
                                    
                                    {swatchOptions.showGrids && (
                                        <div className="mt-10 grid grid-cols-2 gap-4">
                                            <div className="h-20 bg-gray-50 border border-gray-100 rounded flex items-center justify-center text-[8px] font-bold text-gray-300 uppercase">Draft Grid</div>
                                            <div className="h-20 bg-gray-50 border border-gray-100 rounded flex items-center justify-center text-[8px] font-bold text-gray-300 uppercase">Peg Plan</div>
                                        </div>
                                    )}

                                    {swatchOptions.showPalette && (
                                        <div className="mt-10 flex gap-2">
                                            {[1,2,3,4].map(i => <div key={i} className="w-6 h-6 rounded bg-gray-100"></div>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeModule === 'colorways' && (
                        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-10 animate-in fade-in slide-in-from-bottom-4">
                            {/* Options Panel */}
                            <div className="w-full md:w-80 space-y-8 shrink-0">
                                <section>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Selection</h3>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar border border-gray-200 rounded-xl bg-white p-2">
                                        {colorways.map(cw => (
                                            <button 
                                                key={cw.id}
                                                onClick={() => toggleColorwaySelection(cw.id)}
                                                className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-bold transition-all mb-1 ${colorwayOptions.selectedIds.includes(cw.id) ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm' : 'text-gray-500 hover:bg-gray-50 border border-transparent'}`}
                                            >
                                                <span>{cw.name}</span>
                                                {colorwayOptions.selectedIds.includes(cw.id) && <CheckIcon className="w-3 h-3" />}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Layout & Quality</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                            <span className="text-xs font-bold text-gray-700">Simulation DPI</span>
                                            <select 
                                                value={colorwayOptions.dpi}
                                                onChange={e => setColorwayOptions({...colorwayOptions, dpi: parseInt(e.target.value)})}
                                                className="bg-gray-100 border-none rounded text-[10px] font-bold py-1 px-2 focus:ring-0 outline-none"
                                            >
                                                {DPI_OPTIONS.map(dpi => (
                                                    <option key={dpi} value={dpi}>{dpi} DPI</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Width (mm)</label>
                                                <input 
                                                    type="number" 
                                                    value={colorwayOptions.widthMm} 
                                                    onChange={e => setColorwayOptions({...colorwayOptions, widthMm: parseInt(e.target.value) || 10})}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm outline-none font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Height (mm)</label>
                                                <input 
                                                    type="number" 
                                                    value={colorwayOptions.heightMm} 
                                                    onChange={e => setColorwayOptions({...colorwayOptions, heightMm: parseInt(e.target.value) || 10})}
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm outline-none font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                            <span className="text-xs font-bold text-gray-700">Edge Finish</span>
                                            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                                <button onClick={() => setColorwayOptions({...colorwayOptions, edgeStyle: 'straight'})} className={`px-2 py-1 text-[9px] font-bold rounded ${colorwayOptions.edgeStyle === 'straight' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Straight</button>
                                                <button onClick={() => setColorwayOptions({...colorwayOptions, edgeStyle: 'pinking'})} className={`px-2 py-1 text-[9px] font-bold rounded ${colorwayOptions.edgeStyle === 'pinking' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Pinking</button>
                                            </div>
                                        </div>
                                        <label className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer group">
                                            <span className="text-xs font-bold text-gray-700">Include Swatches</span>
                                            <input 
                                                type="checkbox" 
                                                checked={colorwayOptions.showPalette} 
                                                onChange={e => setColorwayOptions({...colorwayOptions, showPalette: e.target.checked})}
                                                className="w-4 h-4 rounded text-blue-600 border-gray-300"
                                            />
                                        </label>
                                    </div>
                                </section>

                                <button 
                                    onClick={handlePrintColorways}
                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all active:scale-95"
                                >
                                    <PrinterIcon className="w-5 h-5" /> Generate Collection PDF
                                </button>
                            </div>

                            {/* Preview Panel */}
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Collection Layout</h3>
                                    <span className="text-[10px] font-bold text-gray-400">{colorwayOptions.dpi} DPI Resolution</span>
                                </div>
                                <div className="bg-white shadow-2xl rounded border border-gray-200 p-8 min-h-[500px]">
                                    {colorwayOptions.selectedIds.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                                            <PaletteIcon className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="font-bold text-sm">Select colorways to preview layout</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-12">
                                            {colorwayOptions.selectedIds.map(id => {
                                                const cw = colorways.find(c => c.id === id);
                                                return (
                                                    <div key={id} className="border-b border-gray-100 pb-8 flex items-start gap-8">
                                                        <div className="flex-1">
                                                            <div className="text-sm font-black text-gray-800 mb-4">{cw?.name}</div>
                                                            <div className="bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-200 uppercase tracking-[0.2em]" style={{ width: '100%', height: 100 }}>
                                                                Colorway Area
                                                            </div>
                                                        </div>
                                                        {colorwayOptions.showPalette && (
                                                            <div className="grid grid-cols-2 gap-1 content-start mt-10">
                                                                {[1,2,3,4,5,6].map(i => <div key={i} className="w-5 h-5 rounded bg-gray-100"></div>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};