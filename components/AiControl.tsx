
import React, { useState, useEffect } from 'react';
import { generateWeaveFromPrompt, analyzeWeaveStructure } from '../services/gemini';
import { WeaveInput, WeaveSettings } from '../types';

interface AiControlProps {
  currentInput: WeaveInput;
  settings: WeaveSettings;
  onApplyGenerated: (data: any) => void;
}

export const AiControl: React.FC<AiControlProps> = ({ currentInput, settings, onApplyGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [mode, setMode] = useState<'generate' | 'analyze'>('generate');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || isOffline) return;
    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const result = await generateWeaveFromPrompt(prompt, {
        harnesses: settings.harnesses,
        warp: settings.warpThreads,
        weft: settings.weftPicks
      });
      onApplyGenerated(result);
      if (result.explanation) {
          setAnalysisResult(result.explanation);
      }
    } catch (e) {
      console.error(e);
      setAnalysisResult("Error generating pattern. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (isOffline) return;
    setIsLoading(true);
    try {
      const result = await analyzeWeaveStructure(currentInput);
      setAnalysisResult(result || "No analysis available.");
    } catch (e) {
      console.error(e);
      setAnalysisResult("Error analyzing pattern. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-gray-700 pt-4 mt-4 relative">
      {isOffline && (
        <div className="absolute inset-0 z-10 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
          <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-xl text-center">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Offline Mode</p>
            <p className="text-[9px] text-gray-400 mt-1">AI features require internet connection.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg">
        <button 
            onClick={() => { setMode('generate'); setAnalysisResult(null); }}
            className={`flex-1 py-1 px-2 rounded-md text-sm font-medium transition-colors ${mode === 'generate' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
            Designer
        </button>
        <button 
            onClick={() => { setMode('analyze'); setAnalysisResult(null); }}
            className={`flex-1 py-1 px-2 rounded-md text-sm font-medium transition-colors ${mode === 'analyze' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
            Analyst
        </button>
      </div>

      {mode === 'generate' ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Describe a Pattern</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A blue and white herringbone twill..."
            className="w-full h-20 p-2 rounded-md bg-gray-900 border border-gray-600 text-sm text-gray-200 focus:border-blue-500 focus:outline-none resize-none"
            disabled={isOffline}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || isOffline}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white font-semibold text-sm shadow-lg transition-all"
          >
            {isLoading ? 'Designing...' : 'Generate Pattern'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-400">Analyze the current weave for structural details, float length, and suitable applications.</p>
            <button
                onClick={handleAnalyze}
                disabled={isLoading || isOffline}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white font-semibold text-sm shadow-lg transition-all"
            >
                {isLoading ? 'Analyzing...' : 'Analyze Structure'}
            </button>
        </div>
      )}

      {analysisResult && (
        <div className="bg-gray-900/80 p-3 rounded-md border border-gray-600 animate-in fade-in slide-in-from-top-2 duration-300">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {mode === 'generate' ? 'Result' : 'Analysis'}
          </h4>
          <div className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none leading-relaxed whitespace-pre-line">
            {analysisResult}
          </div>
        </div>
      )}
    </div>
  );
};
