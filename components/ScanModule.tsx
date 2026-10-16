import React, { useState, useRef, useEffect } from 'react';
import { processImage, QuantizationResult } from '../services/imageProcessor';
import { analyzeFabricImage } from '../services/gemini';
import { UploadIcon, MagicWandIcon } from './icons';

export const ScanModule: React.FC = () => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [processed, setProcessed] = useState<QuantizationResult | null>(null);
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [colorCount, setColorCount] = useState(6);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setProcessed(null);
                    setAnalysis('');
                };
                img.src = ev.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProcess = () => {
        if (!image) return;
        try {
            const result = processImage(image, colorCount, 400);
            setProcessed(result);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAnalyze = async () => {
        if (!image) return;
        setIsLoading(true);
        try {
            // Get base64 stripped
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.min(image.width, 512));
            canvas.height = Math.max(1, Math.min(image.height, 512));
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/png').split(',')[1];
                const text = await analyzeFabricImage(base64);
                setAnalysis(text || "No analysis returned.");
            }
        } catch (e) {
            setAnalysis("Error connecting to analysis service.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (processed && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            const w = Math.max(1, processed.width);
            const h = Math.max(1, processed.height);
            if (ctx) {
                const imgData = ctx.createImageData(w, h);
                const data = imgData.data;
                for (let i = 0; i < processed.pixels.length; i++) {
                    const paletteIdx = processed.pixels[i];
                    const hex = processed.palette[paletteIdx] || '#000000';
                    const r = parseInt(hex.slice(1, 3), 16) || 0;
                    const g = parseInt(hex.slice(3, 5), 16) || 0;
                    const b = parseInt(hex.slice(5, 7), 16) || 0;
                    data[i * 4] = r;
                    data[i * 4 + 1] = g;
                    data[i * 4 + 2] = b;
                    data[i * 4 + 3] = 255;
                }
                ctx.putImageData(imgData, 0, 0);
            }
        }
    }, [processed]);

    return (
        <div className="flex-1 bg-gray-900 text-white p-8 flex flex-col h-full overflow-hidden">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight mb-2">Fabric Analysis Lab</h1>
                <p className="text-gray-400">Upload a scan or photo of a fabric to analyze its structure and color composition.</p>
            </header>

            <div className="flex flex-1 gap-8 min-h-0">
                {/* Left Panel: Inputs */}
                <div className="w-1/3 flex flex-col gap-6 bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:bg-gray-700/50 transition-all cursor-pointer relative">
                        <input type="file" onChange={handleUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                        <UploadIcon className="w-8 h-8 mb-2" />
                        <span className="text-sm font-bold">Upload Image</span>
                    </div>

                    {image && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Quantization Colors</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" min="2" max="16" value={colorCount} 
                                        onChange={(e) => setColorCount(parseInt(e.target.value))} 
                                        className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="font-mono text-blue-400">{colorCount}</span>
                                </div>
                            </div>
                            
                            <button onClick={handleProcess} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-sm transition-colors">
                                Process Colors
                            </button>
                            
                            <button onClick={handleAnalyze} disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <MagicWandIcon className="w-4 h-4" />
                                )}
                                AI Structure Analysis
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel: Visualization */}
                <div className="flex-1 bg-gray-950 rounded-xl border border-gray-800 p-6 overflow-y-auto custom-scrollbar">
                    {!image ? (
                        <div className="h-full flex items-center justify-center text-gray-600 font-mono text-sm">
                            NO IMAGE LOADED
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            <div className="flex gap-4 h-64">
                                <div className="flex-1 bg-black rounded-lg overflow-hidden border border-gray-800 relative group">
                                    <img src={image.src} className="w-full h-full object-contain" />
                                    <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs font-bold">Original</div>
                                </div>
                                <div className="flex-1 bg-black rounded-lg overflow-hidden border border-gray-800 relative">
                                    {processed ? (
                                        <canvas ref={canvasRef} width={processed.width} height={processed.height} className="w-full h-full object-contain image-pixelated" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">Awaiting Process...</div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs font-bold">Quantized</div>
                                </div>
                            </div>

                            {processed && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Extracted Palette</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {processed.palette.map((color, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1">
                                                <div className="w-12 h-12 rounded-lg shadow-sm border border-gray-700" style={{backgroundColor: color}}></div>
                                                <span className="text-[10px] font-mono text-gray-500">{color}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {analysis && (
                                <div className="bg-blue-900/20 border border-blue-800 p-6 rounded-xl animate-in fade-in">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <MagicWandIcon className="w-4 h-4" /> AI Report
                                    </h3>
                                    <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-line leading-relaxed">
                                        {analysis}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};