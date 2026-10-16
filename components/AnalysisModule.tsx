
import React, { useState } from 'react';
import { analyzeWeaveStructure, analyzeFabricImage, generateWeaveFromPrompt } from '../services/gemini';
import { TechnicalReconstruction, WeaveInput } from '../types';
import { MagicWandIcon, UploadIcon, CameraIcon, TableIcon, CheckIcon, LayersIcon, GridFillIcon } from './icons';

interface AnalysisModuleProps {
    onApplyReconstruction: (recon: TechnicalReconstruction) => void;
}

export const AnalysisModule: React.FC<AnalysisModuleProps> = ({ onApplyReconstruction }) => {
    const [mode, setMode] = useState<'prompt' | 'image'>('prompt');
    const [prompt, setPrompt] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePromptReconstruct = async () => {
        if (!prompt.trim()) return;
        setIsAnalyzing(true);
        setError(null);
        try {
            // We use a high-resolution request for reconstruction
            const data = await generateWeaveFromPrompt(prompt, {
                harnesses: 8,
                warp: 24,
                weft: 24
            });
            
            if (data && data.draft && data.pegPlan) {
                const recon: TechnicalReconstruction = {
                    explanation: data.explanation || "AI Reconstructed Structure",
                    harnesses: 8,
                    warpThreads: 24,
                    weftPicks: 24,
                    epi: 108,
                    ppi: 80,
                    draft: data.draft,
                    pegPlan: data.pegPlan,
                    warpPatternString: data.warpPattern || "24A",
                    weftPatternString: data.weftPattern || "24A"
                };
                setResult(recon);
            } else {
                setError("Could not extract technical data from response.");
            }
        } catch (err) {
            console.error(err);
            setError("Analysis failed. Please check your connection.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = (ev.target?.result as string).split(',')[1];
                const text = await analyzeFabricImage(base64);
                setResult({ explanation: text, isRawAnalysis: true });
                setIsAnalyzing(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setError("Image analysis failed.");
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 text-white overflow-hidden font-sans">
            {/* Header */}
            <div className="p-8 border-b border-gray-800 bg-gray-900/50 backdrop-blur shrink-0">
                <div className="max-w-4xl mx-auto flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                                <MagicWandIcon className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter">AI Analysis Lab</h1>
                        </div>
                        <p className="text-gray-400 text-sm font-medium tracking-wide">Deconstruct and reconstruct fabric structures using Gemini Vision & Reasoning.</p>
                    </div>
                    <div className="flex bg-black/40 rounded-xl p-1 border border-gray-800">
                        <button 
                            onClick={() => { setMode('prompt'); setResult(null); }}
                            className={`px-6 py-2 text-xs font-black uppercase rounded-lg transition-all ${mode === 'prompt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Prompt Mode
                        </button>
                        <button 
                            onClick={() => { setMode('image'); setResult(null); }}
                            className={`px-6 py-2 text-xs font-black uppercase rounded-lg transition-all ${mode === 'image' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Vision Mode
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0a0a0f]">
                <div className="max-w-4xl mx-auto grid grid-cols-1 gap-8">
                    
                    {/* Input Section */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-xl">
                        {mode === 'prompt' ? (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-2">Technical Description</label>
                                <textarea 
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe a structure to reconstruct, e.g., 'A 2/2 herringbone twill with 4-pick borders'..."
                                    className="w-full h-32 bg-black/50 border border-gray-700 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                                />
                                <button 
                                    onClick={handlePromptReconstruct}
                                    disabled={isAnalyzing || !prompt.trim()}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    {isAnalyzing ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <MagicWandIcon className="w-5 h-5" />
                                    )}
                                    Run Technical Reconstruction
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-2">Fabric Visual Input</label>
                                <div className="border-2 border-dashed border-gray-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer relative group">
                                    <input type="file" onChange={handleImageUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CameraIcon className="w-8 h-8 text-gray-400 group-hover:text-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-bold block text-gray-300">Upload high-res fabric scan</span>
                                        <span className="text-[10px] text-gray-500 uppercase font-black mt-1">PNG, JPG, TIFF up to 10MB</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result Section */}
                    {isAnalyzing && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-pulse">
                            <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Consulting LLM Intelligence...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-xl text-red-400 text-sm font-medium flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Explanation Card */}
                            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="p-4 bg-indigo-600/10 border-b border-gray-800 flex items-center gap-2">
                                    <TableIcon className="w-4 h-4 text-indigo-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Analysis Summary</span>
                                </div>
                                <div className="p-6">
                                    <p className="text-gray-300 leading-relaxed text-sm italic">{result.explanation}</p>
                                </div>
                            </div>

                            {/* Technical Visualization (if prompt mode) */}
                            {!result.isRawAnalysis && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-black/40 border border-gray-800 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <LayersIcon className="w-4 h-4 text-indigo-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reconstructed Draft</span>
                                        </div>
                                        <div className="aspect-square bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-center p-2 overflow-hidden">
                                            {result.draft && (
                                                <div className="w-full h-full opacity-80 hover:opacity-100 transition-opacity">
                                                     <div className="flex flex-col gap-px">
                                                        {result.draft.map((row: any, ri: number) => (
                                                            <div key={ri} className="flex gap-px">
                                                                {row.map((cell: any, ci: number) => (
                                                                    <div key={ci} className={`w-3 h-3 ${cell ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]' : 'bg-gray-900/50'}`} />
                                                                ))}
                                                            </div>
                                                        ))}
                                                     </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-black/40 border border-gray-800 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <GridFillIcon className="w-4 h-4 text-pink-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reconstructed Peg Plan</span>
                                        </div>
                                        <div className="aspect-square bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-center p-2 overflow-hidden">
                                             {result.pegPlan && (
                                                <div className="w-full h-full opacity-80 hover:opacity-100 transition-opacity">
                                                     <div className="flex flex-col gap-px">
                                                        {result.pegPlan.map((row: any, ri: number) => (
                                                            <div key={ri} className="flex gap-px">
                                                                {row.map((cell: any, ci: number) => (
                                                                    <div key={ci} className={`w-3 h-3 ${cell ? 'bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.5)]' : 'bg-gray-900/50'}`} />
                                                                ))}
                                                            </div>
                                                        ))}
                                                     </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="md:col-span-2">
                                        <button 
                                            onClick={() => onApplyReconstruction(result)}
                                            className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 active:scale-95"
                                        >
                                            <CheckIcon className="w-6 h-6" />
                                            Apply Technical Data to Global Loom
                                        </button>
                                        <p className="text-center text-[10px] text-gray-500 font-bold uppercase mt-4 tracking-tighter">Warning: This will overwrite current draft and peg plan settings.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Footer Status */}
            <div className="h-8 bg-gray-900 border-t border-gray-800 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Gemini LLM v3 Online</span>
                    </div>
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Secure AI Processing</span>
            </div>
        </div>
    );
};
