import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { WeaveArea } from './WeaveArea';
import { TopToolbar } from './TopToolbar';
import { RightPanel } from './RightPanel';
import { ProgressiveToolbar } from './ProgressiveToolbar';
import { GlobalPaletteBar } from './GlobalPaletteBar';
import { FabricSimulationModal } from './FabricSimulationModal';
import { PatternManagerModal } from './PatternManagerModal';
import { YarnSelectorModal } from './YarnSelectorModal';
import { DraftStudioModal } from './DraftStudioModal';
import { PegPlanStudioModal } from './PegPlanStudioModal';
// Added missing import for TechStudio component to fix name error
import { TechStudio } from './TechStudio';
import { PrintStudio } from './PrintStudio';
import { VisualPatternStudio } from './VisualPatternStudio';
import { generateWeave, reconstructWeaveFromGrid, generateWeaveAsync } from '../services/weaveGenerator';
import { WeaveSettings, WeavePattern, WeaveInput, ToolType, ViewMode, FaceMode, YarnDefinition, DensityZone, Colorway, AppMode, LayoutCorner } from '../types';
import { parsePatternString, getTotalThreads, expandPatternString, compressPatternString, scalePatternString, lcm } from '../utils/patternParser';
import { LibraryWeave, WEAVE_LIBRARY } from '../services/weaveLibrary';
import { PANTONE_PALETTE } from '../services/pantoneColors';
import { generateSpecSheet } from '../services/pdfGenerator';
import { ProductionCalculator } from './ProductionCalculator'; 
import { YarnStudio } from './YarnStudio';
import { ProjectManagerModal } from './ProjectManagerModal'; 
import { ColorwayStudio } from './ColorwayStudio';
import { SaveIcon, UploadIcon, PlusIcon, WeaveIcon, TableIcon, RulerIcon, GridFillIcon, CheckIcon } from './icons';

import { WeaveProjectFile, APP_VERSION } from '../services/io/schemas';
import { downloadFile, loadFile, serializeGrid, deserializeGrid } from '../services/io/fileHandler';
import { StorageService } from '../services/io/storage'; 
import { renderFabricToCanvas } from '../services/fabricRenderer'; 

interface HistoryState {
    draft: boolean[][];
    pegPlan: boolean[][];
    warpPatternString: string;
    weftPatternString: string;
    dentingPatternString: string;
    dentingPlan: number[];
    settings: WeaveSettings;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    weftZones: DensityZone[];
}

const isTauri = !!(window as any).__TAURI__;

export const DobbyMaster: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [appMode, setAppMode] = useState<AppMode>('weave');
  const [showStartup, setShowStartup] = useState(true);
  const [startupMode, setStartupMode] = useState<'choice' | 'new'>('choice');
  
  const [newParams, setNewParams] = useState({
      shafts: 8,
      draftRepeat: 24,
      pegRepeat: 24,
      denting: '2',
      epi: 108,
      ppi: 80
  });

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
  };

  const [showSimModal, setShowSimModal] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false); 
  const [showDraftStudio, setShowDraftStudio] = useState(false);
  const [showPegPlanStudio, setShowPegPlanStudio] = useState(false);
  const [layoutCorner, setLayoutCorner] = useState<LayoutCorner>('TL');

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<WeaveSettings>({
    warpThreads: 24, weftPicks: 24, harnesses: 8, epi: 108, ppi: 80, gridDivision: 4
  });

  const [projectName, setProjectName] = useState('Untitled Project'); 
  const [paletteColors] = useState<string[]>(PANTONE_PALETTE);
  const [customWeaves, setCustomWeaves] = useState<LibraryWeave[]>([]);

  const createDefaultYarn = (color: string | undefined): YarnDefinition => ({
      color: color || '#CCCCCC', 
      model: 'simple', construction: 'standard', fiberType: 'Cotton', countSystem: 'Nm', count: 28, ply: 1, thickness: 1.0, twist: 'Z', tpi: 15, sheen: 0.5, roughness: 0.5, price: 0,
      bindingDepth: 0.05, shadowStrength: 0.20
  });

  const defaultWarp: { [key: string]: YarnDefinition } = { 'A': createDefaultYarn(PANTONE_PALETTE[38]), 'B': createDefaultYarn(PANTONE_PALETTE[20]), 'C': createDefaultYarn(PANTONE_PALETTE[30]) };
  const defaultWeft: { [key: string]: YarnDefinition } = { 'A': createDefaultYarn(PANTONE_PALETTE[38]), 'B': createDefaultYarn(PANTONE_PALETTE[20]), 'C': createDefaultYarn(PANTONE_PALETTE[30]) };

  const [warpYarns, setWarpYarns] = useState<{ [key: string]: YarnDefinition }>(defaultWarp);
  const [weftYarns, setWeftYarns] = useState<{ [key: string]: YarnDefinition }>(defaultWeft);

  const [colorways, setColorways] = useState<Colorway[]>([]);

  const warpColors = useMemo(() => {
      const map: {[key:string]: string} = {};
      Object.entries(warpYarns).forEach(([k,v]) => { if(v) map[k] = (v as YarnDefinition).color; });
      return map;
  }, [warpYarns]);

  const weftColors = useMemo(() => {
      const map: {[key:string]: string} = {};
      Object.entries(weftYarns).forEach(([k,v]) => { if(v) map[k] = (v as YarnDefinition).color; });
      return map;
  }, [weftYarns]);

  const [selectedColorIndex, setSelectedColorIndex] = useState(0); 
  const [activeYarnId, setActiveYarnId] = useState<string>('A');
  const [selectedYarnType, setSelectedYarnType] = useState<'warp' | 'weft'>('warp');
  const [studioYarnDef, setStudioYarnDef] = useState<YarnDefinition>(defaultWarp['A']);

  useEffect(() => {
      const source = selectedYarnType === 'warp' ? warpYarns : weftYarns;
      if (source[activeYarnId]) setStudioYarnDef(source[activeYarnId]);
  }, [activeYarnId, selectedYarnType, warpYarns, weftYarns]); 

  const [warpPatternString, setWarpPatternString] = useState('18A18B32C18B18A');
  const [weftPatternString, setWeftPatternString] = useState('14A14B24C14B14A');
  const [isWeftScaled, setIsWeftScaled] = useState(false);
  const [isWarpScaled, setIsWarpScaled] = useState(false);

  const [weftZones, setWeftZones] = useState<DensityZone[]>([]);
  
  const [dentingPatternString, setDentingPatternString] = useState('2');
  const [dentingPlan, setDentingPlan] = useState<number[]>(() => Array(8).fill(2));

  const [draft, setDraft] = useState<boolean[][]>(() => Array.from({ length: 8 }, (_, h) => Array.from({ length: 24 }, (_, w) => (w % 8) === h)));
  const [pegPlan, setPegPlan] = useState<boolean[][]>(() => Array.from({ length: 24 }, (_, p) => Array.from({ length: 8 }, (_, h) => ((p % 8) === h))));
  
  const [history, setHistory] = useState<{ past: HistoryState[], future: HistoryState[] }>({ past: [], future: [] });

  // Holds the asynchronously calculated weave
  const [weavePattern, setWeavePattern] = useState<WeavePattern>({ pattern: [], structure: [] });

  const copyGrid = (grid: boolean[][]) => grid.map(row => [...row]);

  useEffect(() => {
      const parts = dentingPatternString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
      setDentingPlan(parts.length > 0 ? parts : [2]);
  }, [dentingPatternString]);

  useEffect(() => {
    if (isWeftScaled) {
        const ratio = settings.ppi / settings.epi;
        const newWeft = scalePatternString(warpPatternString, ratio, 2);
        if (newWeft !== weftPatternString) {
            setWeftPatternString(newWeft);
        }
    }
  }, [warpPatternString, isWeftScaled, settings.epi, settings.ppi]);

  useEffect(() => {
    if (isWarpScaled) {
        const ratio = settings.epi / settings.ppi;
        const newWarp = scalePatternString(weftPatternString, ratio, 2);
        if (newWarp !== warpPatternString) {
            setWarpPatternString(newWarp);
        }
    }
  }, [weftPatternString, isWarpScaled, settings.epi, settings.ppi]);

  const saveHistory = useCallback(() => {
    setHistory(prev => {
        const currentSnapshot: HistoryState = {
            draft: copyGrid(draft), pegPlan: copyGrid(pegPlan), warpPatternString, weftPatternString, dentingPatternString, dentingPlan: [...dentingPlan], settings: { ...settings }, warpYarns: { ...warpYarns }, weftYarns: { ...weftYarns }, weftZones: [...weftZones]
        };
        const newPast = [...prev.past, currentSnapshot];
        if (newPast.length > 50) newPast.shift(); 
        return { past: newPast, future: [] };
    });
  }, [draft, pegPlan, warpPatternString, weftPatternString, dentingPatternString, dentingPlan, settings, warpYarns, weftYarns, weftZones]);

  const undo = useCallback(() => {
      setHistory(prev => {
          if (prev.past.length === 0) return prev;
          const previous = prev.past[prev.past.length - 1];
          const newPast = prev.past.slice(0, -1);
          setDraft(previous.draft); setPegPlan(previous.pegPlan); setWarpPatternString(previous.warpPatternString); setWeftPatternString(previous.weftPatternString); setDentingPatternString(previous.dentingPatternString || '2'); setDentingPlan(previous.dentingPlan || [2]); setSettings(previous.settings); setWarpYarns(previous.warpYarns); setWeftYarns(previous.weftYarns); setWeftZones(previous.weftZones || []);
          return { past: newPast, future: [previous, ...prev.future] }; 
      });
  }, []);

  const handleQuickYarnSelect = (id: string, type: 'warp' | 'weft') => {
      setActiveYarnId(id);
      setSelectedYarnType(type);
  };

  const handleYarnSelect = (id: string, type: 'warp' | 'weft') => {
      handleQuickYarnSelect(id, type);
  };

  const handleUpdateYarnColor = (id: string, type: 'warp' | 'weft', hex: string) => {
      saveHistory();
      if (type === 'warp') {
          setWarpYarns(prev => ({ ...prev, [id]: { ...prev[id], color: hex } }));
      } else {
          setWeftYarns(prev => ({ ...prev, [id]: { ...prev[id], color: hex } }));
      }
  };

  const handleApplyStudioYarn = () => {
      saveHistory();
      if (selectedYarnType === 'warp') {
          setWarpYarns(prev => ({ ...prev, [activeYarnId]: studioYarnDef }));
      } else {
          setWeftYarns(prev => ({ ...prev, [activeYarnId]: studioYarnDef }));
      }
  };

  const technicalWarpLen = useMemo(() => {
      const pLen = getTotalThreads(warpPatternString);
      return pLen > 0 ? lcm(pLen, settings.warpThreads) : settings.warpThreads;
  }, [warpPatternString, settings.warpThreads]);

  const technicalWeftLen = useMemo(() => {
      const pLen = getTotalThreads(weftPatternString);
      return pLen > 0 ? lcm(pLen, settings.weftPicks) : settings.weftPicks;
  }, [weftPatternString, settings.weftPicks]);

  const warpPattern = useMemo(() => {
    const parsed = parsePatternString(warpPatternString, warpColors);
    if (parsed.length === 0) return Array(technicalWarpLen).fill('#888888');
    return Array.from({ length: technicalWarpLen }, (_, i) => parsed[i % parsed.length]);
  }, [warpPatternString, warpColors, technicalWarpLen]);

  const weftPattern = useMemo(() => {
    const parsed = parsePatternString(weftPatternString, weftColors);
     if (parsed.length === 0) return Array(technicalWeftLen).fill('#888888');
    return Array.from({ length: technicalWeftLen }, (_, i) => parsed[i % parsed.length]);
  }, [weftPatternString, weftColors, technicalWeftLen]);

  // --- ASYNC WEAVE GENERATION (RUST SUPPORT) ---
  useEffect(() => {
      let active = true;
      const gen = async () => {
          // If in Tauri, this runs in Rust. If web, runs in JS.
          const res = await generateWeaveAsync({ draft, pegPlan, warpPattern, weftPattern });
          if (active) setWeavePattern(res);
      };
      gen();
      return () => { active = false; };
  }, [draft, pegPlan, warpPattern, weftPattern]);

  const getProjectObject = useCallback((): WeaveProjectFile => ({
      fileType: 'wonderweaves-project', version: APP_VERSION, timestamp: Date.now(), name: projectName, loom: settings,
      grids: { draft: serializeGrid(draft), pegPlan: serializeGrid(pegPlan), denting: dentingPlan },
      patterns: { warpString: warpPatternString, weftString: weftPatternString },
      resources: { warpYarns, weftYarns, weftZones, palette: paletteColors }
  }), [projectName, settings, draft, pegPlan, dentingPlan, warpPatternString, weftPatternString, warpYarns, weftYarns, weftZones, paletteColors]);

  const generateThumbnail = useCallback(() => {
      const thumbCanvas = renderFabricToCanvas({
          weavePattern: weavePattern.pattern, structure: weavePattern.structure, epi: settings.epi, ppi: settings.ppi, dentingPlan, warpYarns, weftYarns, warpYarnSequence: expandPatternString(warpPatternString), weftYarnSequence: expandPatternString(weftPatternString), viewSide: 'face', dpi: 72, width: 600, height: 300
      });
      return thumbCanvas.toDataURL('image/jpeg', 0.8);
  }, [weavePattern, settings, dentingPlan, warpYarns, weftYarns, warpPatternString, weftPatternString]);

  const handleSaveToLibrary = async () => {
      try {
          const thumb = generateThumbnail();
          const project = getProjectObject();
          const id = currentProjectId || Date.now().toString();
          const projectToSave = { ...project, id };
          await StorageService.saveProject(projectToSave, thumb);
          setCurrentProjectId(id);
          alert("Project saved to local library.");
      } catch (e) { console.error(e); alert("Failed to save project."); }
  };

  const handleExport = useCallback(async () => {
      try {
          const projectData = getProjectObject();
          const cleanName = (projectName || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
          downloadFile(JSON.stringify(projectData, null, 2), `${cleanName}-${new Date().toISOString().split('T')[0]}.weave`);
      } catch (e) { console.error(e); }
  }, [projectName, getProjectObject]);

  const loadProjectData = (data: WeaveProjectFile) => {
      saveHistory();
      setCurrentProjectId(data.id || null);
      setProjectName(data.name || 'Untitled');
      setSettings(data.loom);
      setDraft(deserializeGrid(data.grids.draft));
      setPegPlan(deserializeGrid(data.grids.pegPlan));
      setDentingPlan(data.grids.denting);
      setDentingPatternString(data.grids.denting.join(', '));
      setWarpPatternString(data.patterns.warpString);
      setWeftPatternString(data.patterns.weftString);
      setWarpYarns(data.resources.warpYarns);
      setWeftYarns(data.resources.weftYarns);
      setWeftZones(data.resources.weftZones || []);
      setShowStartup(false);
  };

  const handleLoadFromFile = async (event?: React.ChangeEvent<HTMLInputElement>) => {
      if (isTauri && !event) {
          // Native Tauri File Picker
          try {
              const content = await loadFile();
              if (content && content.includes('wonderweaves-project')) {
                  loadProjectData(JSON.parse(content));
              }
          } catch (e) { console.error(e); }
          return;
      }

      const file = event?.target.files?.[0];
      if (!file) return;
      try {
          const content = await loadFile(file);
          if (!content.includes('wonderweaves-project')) { alert("Invalid project file format."); return; }
          loadProjectData(JSON.parse(content));
      } catch (e) { console.error(e); alert("Failed to load design."); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleLoadFromStorage = async (id: string) => {
      try { const data = await StorageService.loadProject(id); loadProjectData(data); } catch (e) { console.error(e); }
  };

  const handleNewDesign = () => {
      saveHistory();
      const s = {
          ...settings,
          harnesses: newParams.shafts,
          warpThreads: newParams.draftRepeat,
          weftPicks: newParams.pegRepeat,
          epi: newParams.epi,
          ppi: newParams.ppi
      };
      setSettings(s);
      
      setDraft(Array.from({ length: s.harnesses }, () => Array(s.warpThreads).fill(false)));
      setPegPlan(Array.from({ length: s.weftPicks }, () => Array(s.harnesses).fill(false)));
      setDentingPatternString(newParams.denting);
      
      const parts = newParams.denting.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
      setDentingPlan(parts.length > 0 ? parts : [2]);
      
      setWarpPatternString(`${s.warpThreads}A`);
      setWeftPatternString(`${s.weftPicks}A`);
      setProjectName('New Design');
      setCurrentProjectId(null);
      
      setShowStartup(false);
  };

  const handlePdfDownload = () => {
      generateSpecSheet({ settings, warpYarns, weftYarns, warpPatternString, weftPatternString, dentingPlan, dentingPatternString, draft, pegPlan, weavePattern });
  };

  const [patternManagerState, setPatternManagerState] = useState<{ isOpen: boolean; type: 'warp' | 'weft'; }>({ isOpen: false, type: 'warp' });
  const [yarnSelectorState, setYarnSelectorState] = useState<{ isOpen: boolean; type: 'warp' | 'weft'; }>({ isOpen: false, type: 'warp' });

  const [currentTool, setCurrentTool] = useState<ToolType>('pencil');
  const [viewMode, setViewMode] = useState<ViewMode>('interlace');
  const [faceMode, setFaceMode] = useState<FaceMode>('face');
  const [currentFillPatternId, setCurrentFillPatternId] = useState<string>('twill-2-2');
  
  const isDrawing = useRef(false);
  const drawVal = useRef(true);

  const dentingGrid = useMemo(() => {
      const dents = dentingPlan.length > 0 ? dentingPlan : [2];
      const row0: string[] = [];
      const row1: string[] = [];
      let dentIndex = 0, threadCount = 0, currentDentSize = dents[0];
      for(let i=0; i<technicalWarpLen; i++) {
          let loopGuard = 0;
          while(currentDentSize === 0 && loopGuard < dents.length * 2) {
              dentIndex++;
              currentDentSize = dents[dentIndex % dents.length];
              loopGuard++;
          }
          const isTop = dentIndex % 2 === 0;
          row0.push(isTop ? '#000000' : '#ffffff');
          row1.push(!isTop ? '#000000' : '#ffffff');
          threadCount++;
          if(threadCount >= currentDentSize) {
              dentIndex++;
              threadCount = 0;
              currentDentSize = dents[dentIndex % dents.length];
          }
      }
      return [row0, row1]; 
  }, [dentingPlan, technicalWarpLen]);

  const handleSettingsChange = (newSettings: WeaveSettings) => {
      saveHistory();
      const oldH = settings.harnesses;
      const oldW = settings.warpThreads;
      const oldP = settings.weftPicks;

      setDraft(prevDraft => {
          if (newSettings.harnesses === prevDraft.length && newSettings.warpThreads === prevDraft[0]?.length) {
              return prevDraft;
          }
          return Array.from({ length: newSettings.harnesses }, (_, h) => 
              Array.from({ length: newSettings.warpThreads }, (_, w) => {
                  if (h < oldH) {
                      return prevDraft[h] ? prevDraft[h][w % oldW] : false;
                  }
                  return false;
              })
          );
      });

      setPegPlan(prevPeg => {
          if (newSettings.weftPicks === prevPeg.length && newSettings.harnesses === (prevPeg[0]?.length || 0)) {
              return prevPeg;
          }
          return Array.from({ length: newSettings.weftPicks }, (_, p) => 
              Array.from({ length: newSettings.harnesses }, (_, h) => {
                  const sourceRow = p % oldP;
                  if (h < oldH) {
                      return prevPeg[sourceRow] ? prevPeg[sourceRow][h] : false;
                  }
                  return false;
              })
          );
      });

      if (newSettings.warpThreads !== oldW) {
          const seq = expandPatternString(warpPatternString);
          if (seq.length > 0) {
              const newSeq = Array.from({ length: newSettings.warpThreads }, (_, i) => seq[i % seq.length]);
              setWarpPatternString(compressPatternString(newSeq));
          }
      }
      
      if (newSettings.weftPicks !== oldP) {
          const seq = expandPatternString(weftPatternString);
          if (seq.length > 0) {
              const newSeq = Array.from({ length: newSettings.weftPicks }, (_, i) => seq[i % seq.length]);
              setWeftPatternString(compressPatternString(newSeq));
          }
      }

      setSettings(newSettings);
  };

  const handleSyncGridDimensions = (warpLen: number, weftLen: number) => {
      saveHistory();
      handleSettingsChange({ ...settings, warpThreads: warpLen, weftPicks: weftLen });
  };

  const handleDraftInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      if (type === 'down' || (type === 'enter' && isDrawing.current)) {
          if (type === 'down') { saveHistory(); isDrawing.current = true; }
          const targetCol = col % settings.warpThreads;
          if (draft[row] && draft[row][targetCol] === true && type === 'enter') return;
          
          const newDraft = copyGrid(draft);
          for (let h = 0; h < newDraft.length; h++) if (newDraft[h]) newDraft[h][targetCol] = false;
          if (newDraft[row]) newDraft[row][targetCol] = true;
          setDraft(newDraft);
      } else if (type === 'up') isDrawing.current = false;
  };

  const handlePegPlanInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      if (type === 'down') {
          saveHistory(); isDrawing.current = true;
          const targetRow = row % settings.weftPicks;
          drawVal.current = pegPlan[targetRow] ? !pegPlan[targetRow][col] : true;
          const newPeg = copyGrid(pegPlan);
          if (newPeg[targetRow]) newPeg[targetRow][col] = drawVal.current;
          setPegPlan(newPeg);
      } else if (type === 'enter' && isDrawing.current) {
          const targetRow = row % settings.weftPicks;
          if (pegPlan[targetRow] && pegPlan[targetRow][col] === drawVal.current) return;
          const newPeg = copyGrid(pegPlan);
          if (newPeg[targetRow]) {
              newPeg[targetRow][col] = drawVal.current;
              setPegPlan(newPeg);
          }
      } else if (type === 'up') isDrawing.current = false;
  };

  const handleDrawdownInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      if (currentTool === 'fill') {
          if (type === 'down') {
              saveHistory();
              const targetW = WEAVE_LIBRARY.find(w => w.id === currentFillPatternId) || customWeaves.find(w => w.id === currentFillPatternId);
              if (targetW) {
                  const { structure: libS } = generateWeave({ 
                      draft: targetW.draft.map(r=>r.map(c=>c===1)), 
                      pegPlan: targetW.pegPlan.map(r=>r.map(c=>c===1)), 
                      warpPattern: Array(targetW.draft[0].length).fill('A'), 
                      weftPattern: Array(targetW.pegPlan.length).fill('A') 
                  });
                  const fullGrid = Array.from({ length: settings.weftPicks }, (_, r) => 
                      Array.from({ length: settings.warpThreads }, (_, c) => libS[r % libS.length][c % libS[0].length])
                  );
                  const { draft: nD, pegPlan: nP, harnesses: nH } = reconstructWeaveFromGrid(fullGrid, settings.warpThreads, settings.weftPicks);
                  setSettings(prev => ({ ...prev, harnesses: nH }));
                  setDraft(nD);
                  setPegPlan(nP);
              }
          }
          return;
      }

      if (currentTool === 'brush') {
          if (type === 'down') { saveHistory(); isDrawing.current = true; }
          if (isDrawing.current || type === 'down') {
              const targetColIdx = col % technicalWarpLen;
              const wSeq = expandPatternString(warpPatternString);
              while(wSeq.length < technicalWarpLen) wSeq.push(wSeq[wSeq.length % (wSeq.length || 1)] || 'A');
              const patternIdx = targetColIdx % (wSeq.length || 1);
              if (wSeq[patternIdx] !== activeYarnId) { 
                wSeq[patternIdx] = activeYarnId; 
                setWarpPatternString(compressPatternString(wSeq));
              }
          }
          if (type === 'up') isDrawing.current = false;
          return;
      }

      if (currentTool === 'pencil') {
          if (type === 'down' || (type === 'enter' && isDrawing.current)) {
              if (type === 'down') { saveHistory(); isDrawing.current = true; }
              
              const targetCol = col % settings.warpThreads;
              const targetRow = row % settings.weftPicks;
              
              const currentStructure = weavePattern.structure.map(r => [...r]);
              // Guard against async loading where structure might be empty
              if (!currentStructure[targetRow]) return;

              const targetVal = type === 'down' ? !currentStructure[row][col] : drawVal.current;
              if (type === 'down') drawVal.current = targetVal;
              
              const structuralUnit = Array.from({length: settings.weftPicks}, (_, r) => 
                Array.from({length: settings.warpThreads}, (_, c) => {
                    if (r === targetRow && c === targetCol) return targetVal;
                    return currentStructure[r % weavePattern.structure.length][c % weavePattern.structure[0].length];
                })
              );

              const { draft: nD, pegPlan: nP, harnesses: nH } = reconstructWeaveFromGrid(
                structuralUnit, settings.warpThreads, settings.weftPicks
              );
              
              setSettings(prev => ({ ...prev, harnesses: nH }));
              setDraft(nD);
              setPegPlan(nP);
          }
          if (type === 'up') isDrawing.current = false;
          return;
      }

      if (type === 'up') isDrawing.current = false;
  };

  const handleWarpColorInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      const targetIdx = col % technicalWarpLen;
      if (currentTool === 'brush' || currentTool === 'pencil') {
          if (type === 'down') { saveHistory(); isDrawing.current = true; }
          if (isDrawing.current || type === 'down') {
              const seq = expandPatternString(warpPatternString);
              while(seq.length < technicalWarpLen) { seq.push(seq[seq.length % (seq.length || 1)] || 'A'); }
              const patternIdx = targetIdx % (seq.length || 1);
              if (seq[patternIdx] !== activeYarnId) { 
                  seq[patternIdx] = activeYarnId; 
                  setWarpPatternString(compressPatternString(seq)); 
              }
          }
      } else if (type === 'down') { 
          const currentSeq = expandPatternString(warpPatternString);
          handleYarnSelect(currentSeq[targetIdx % currentSeq.length], 'warp'); 
      }
      if (type === 'up') isDrawing.current = false;
  };

  const handleWeftColorInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      const targetIdx = row % technicalWeftLen;
      if (currentTool === 'brush' || currentTool === 'pencil') {
          if (type === 'down') { saveHistory(); isDrawing.current = true; }
          if (isDrawing.current || type === 'down') {
              const seq = expandPatternString(weftPatternString);
              while(seq.length < technicalWeftLen) { seq.push(seq[seq.length % (seq.length || 1)] || 'A'); }
              const patternIdx = targetIdx % (seq.length || 1);
              if (seq[patternIdx] !== activeYarnId) { 
                  setWeftPatternString(compressPatternString(seq)); 
              }
          }
      } else if (type === 'down') { 
          const currentSeq = expandPatternString(weftPatternString);
          handleYarnSelect(currentSeq[targetIdx % currentSeq.length], 'weft'); 
      }
      if (type === 'up') isDrawing.current = false;
  };

  const handleDentingInteraction = (row: number, col: number, type: 'down' | 'enter' | 'up') => {
      const currentPlan = dentingPlan.length > 0 ? dentingPlan : [2], boolMap: boolean[] = [];
      let state = true, pIdx = 0;
      while(boolMap.length < technicalWarpLen) {
          for(let k=0; k<currentPlan[pIdx % currentPlan.length]; k++) boolMap.push(state);
          state = !state; pIdx++;
      }
      let changed = false;
      const targetCol = col % technicalWarpLen;
      if (type === 'down') { saveHistory(); isDrawing.current = true; drawVal.current = row === 0; if (boolMap[targetCol] !== drawVal.current) { boolMap[targetCol] = drawVal.current; changed = true; } }
      else if (type === 'enter' && isDrawing.current) { if (boolMap[targetCol] !== drawVal.current) { boolMap[targetCol] = drawVal.current; changed = true; } }
      // Corrected typo 'iisDrawing' to 'isDrawing'
      else if (type === 'up') { isDrawing.current = false; return; }
      if (changed) {
          const newPlan: number[] = [];
          if (boolMap.length > 0) {
              if (boolMap[0] === false) newPlan.push(0);
              let run = 1, last = boolMap[0];
              for(let i=1; i<boolMap.length; i++) { if (boolMap[i] === last) run++; else { newPlan.push(run); last = boolMap[i]; run = 1; } }
              newPlan.push(run);
          }
          setDentingPlan(newPlan); setDentingPatternString(newPlan.join(','));
      }
  };

  const handleLoadWeave = (weave: LibraryWeave) => {
      saveHistory();
      handleSettingsChange({ ...settings, harnesses: weave.harnesses });
      setDraft(Array.from({ length: weave.harnesses }, (_, h) => Array.from({ length: settings.warpThreads }, (_, w) => weave.draft[h][w % weave.draft[0].length] === 1)));
      setPegPlan(Array.from({ length: settings.weftPicks }, (_, p) => Array.from({ length: weave.harnesses }, (_, h) => weave.pegPlan[p % weave.pegPlan.length][h] === 1)));
  };

  const handlePatternApply = (type: 'warp' | 'weft', newPattern: string, zones?: DensityZone[]) => {
      saveHistory();
      if (type === 'warp') {
          setWarpPatternString(newPattern);
      } else {
          setWeftPatternString(newPattern); if (zones) setWeftZones(zones);
      }
  };

  const handleStructureApply = (char: string, dent?: number) => {
      saveHistory();
      const isWarp = yarnSelectorState.type === 'warp';
      const totalWarpEnds = settings.warpThreads;
      const baseSeq = expandPatternString(warpPatternString);
      const fullWarpSeq: string[] = [];
      while(fullWarpSeq.length < totalWarpEnds) { fullWarpSeq.push(...baseSeq); }
      fullWarpSeq.length = totalWarpEnds;
      const seq = isWarp ? fullWarpSeq : expandPatternString(weftPatternString);
      const indices = seq.map((c, i) => c === char ? i : -1).filter(i => i !== -1);
      const targetW = WEAVE_LIBRARY.find(w => w.id === currentFillPatternId) || customWeaves.find(w => w.id === currentFillPatternId);
      if (indices.length && targetW) {
        const { structure: libS } = generateWeave({ draft: targetW.draft.map(r=>r.map(c=>c===1)), pegPlan: targetW.pegPlan.map(r=>r.map(c=>c===1)), warpPattern: Array(targetW.draft[0].length).fill('A'), weftPattern: Array(targetW.pegPlan.length).fill('A') });
        const { structure: currentS } = generateWeave({ draft, pegPlan, warpPattern: Array.from({length: settings.warpThreads}, () => 'A'), weftPattern: Array.from({length: settings.weftPicks}, () => 'A') });
        const nG = currentS.map(row => [...row]);
        indices.forEach(idx => {
            if (isWarp) for(let r=0; r<settings.weftPicks; r++) nG[r][idx] = libS[r % libS.length][idx % libS[0].length];
            else for(let c=0; c<settings.warpThreads; c++) nG[idx][c] = libS[idx % libS.length][c % libS[0].length];
        });
        const { draft: nD, pegPlan: nP, harnesses: nH } = reconstructWeaveFromGrid(nG, settings.warpThreads, settings.weftPicks);
        handleSettingsChange({ ...settings, harnesses: nH }); setDraft(nD); setPegPlan(nP);
      }
      if (isWarp && dent !== undefined && dent > 0) {
          const threadDents: number[] = [];
          const currentPlan = dentingPlan.length > 0 ? dentingPlan : [2];
          let pIdx = 0, tIdx = 0;
          while(tIdx < totalWarpEnds) { const size = currentPlan[pIdx % currentPlan.length]; for(let k=0; k<size && tIdx < totalWarpEnds; k++) threadDents[tIdx++] = size; pIdx++; }
          let i = 0;
          while (i < totalWarpEnds) {
              if (fullWarpSeq[i] === char) { let run = 0; while (i + run < totalWarpEnds && fullWarpSeq[i + run] === char && run < dent) run++; for (let k = 0; k < run; k++) threadDents[i + k] = run; i += run; }
              else i++;
          }
          const newPlan: number[] = [];
          let cursor = 0;
          while (cursor < totalWarpEnds) { const groupSize = threadDents[cursor] || 2; newPlan.push(groupSize); cursor += groupSize; }
          setDentingPlan(newPlan); setDentingPatternString(newPlan.join(', '));
      }
  };

  const handleDropWeaveOnYarn = (weaveId: string, yarnId: string, type: 'warp' | 'weft') => {
      setCurrentFillPatternId(weaveId);
      setYarnSelectorState({ isOpen: true, type });
  };

  const isYarnMode = appMode === 'yarn', isSpecsMode = appMode === 'specs', isWeaveMode = appMode === 'weave', isPatternMode = appMode === 'pattern', isColorwayMode = appMode === 'colorways', isSimMode = appMode === 'sim', isTechStudioMode = appMode === 'tech-studio', isPrintMode = appMode === 'print';
  const rightPanelTab = isSpecsMode ? 'construction' : (isYarnMode ? 'yarns' : 'weave');

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden relative">
         <input type="file" ref={fileInputRef} onChange={handleLoadFromFile} accept=".weave" style={{ display: 'none' }} />
         
         {showStartup && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col font-sans">
                     <div className="bg-blue-600 p-8 text-white flex flex-col items-center gap-4">
                         <WeaveIcon className="w-16 h-16 text-white" />
                         <div className="text-center">
                             <h1 className="text-3xl font-black uppercase tracking-tighter">WonderWeaves</h1>
                             <p className="text-blue-100 font-medium tracking-wide">Dobby Master Technical Studio</p>
                         </div>
                     </div>
                     
                     <div className="p-8">
                         {startupMode === 'choice' ? (
                             <div className="grid grid-cols-2 gap-6">
                                 <button onClick={() => setStartupMode('new')} className="group flex flex-col items-center gap-4 p-8 border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all rounded-2xl text-center">
                                     <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                         <PlusIcon className="w-8 h-8 text-blue-600" />
                                     </div>
                                     <div>
                                         <h3 className="font-bold text-gray-800 text-lg">New Design</h3>
                                         <p className="text-sm text-gray-500">Configure parameters manually</p>
                                     </div>
                                 </button>
                                 <button onClick={() => isTauri ? handleLoadFromFile() : fileInputRef.current?.click()} className="group flex flex-col items-center gap-4 p-8 border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all rounded-2xl text-center">
                                     <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                         <UploadIcon className="w-8 h-8 text-emerald-600" />
                                     </div>
                                     <div>
                                         <h3 className="font-bold text-gray-800 text-lg">Load Design</h3>
                                         <p className="text-sm text-gray-500">Import a .weave project file</p>
                                     </div>
                                 </button>
                             </div>
                         ) : (
                             <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                                 <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><TableIcon className="w-3 h-3"/> Shafts (Harnesses)</label>
                                         <input type="number" min="2" max="24" value={newParams.shafts} onChange={e => setNewParams({...newParams, shafts: parseInt(e.target.value) || 8})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><GridFillIcon className="w-3 h-3"/> Draft Repeat</label>
                                         <input type="number" min="4" max="512" value={newParams.draftRepeat} onChange={e => setNewParams({...newParams, draftRepeat: parseInt(e.target.value) || 24})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><GridFillIcon className="w-3 h-3 transform rotate-90"/> Peg Plan Repeat</label>
                                         <input type="number" min="4" max="512" value={newParams.pegRepeat} onChange={e => setNewParams({...newParams, pegRepeat: parseInt(e.target.value) || 24})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><RulerIcon className="w-3 h-3"/> Denting Order</label>
                                         <input type="text" value={newParams.denting} onChange={e => setNewParams({...newParams, denting: e.target.value})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" placeholder="e.g. 2,2" />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><RulerIcon className="w-3 h-3"/> Ends Per Inch (EPI)</label>
                                         <input type="number" min="1" max="500" value={newParams.epi} onChange={e => setNewParams({...newParams, epi: parseInt(e.target.value) || 108})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" />
                                     </div>
                                     <div className="flex flex-col gap-1">
                                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><RulerIcon className="w-3 h-3 transform rotate-90"/> Picks Per Inch (PPI)</label>
                                         <input type="number" min="1" max="500" value={newParams.ppi} onChange={e => setNewParams({...newParams, ppi: parseInt(e.target.value) || 80})} className="border-b-2 border-gray-200 focus:border-blue-500 p-2 text-xl font-bold font-mono outline-none" />
                                     </div>
                                 </div>
                                 <div className="flex gap-4 pt-4 border-t border-gray-100">
                                     <button onClick={() => setStartupMode('choice')} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Go Back</button>
                                     <button onClick={handleNewDesign} className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2">Initialize Workspace <CheckIcon className="w-4 h-4"/></button>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}

         <TopToolbar 
            currentTool={currentTool} onToolChange={setCurrentTool} viewMode={viewMode} onViewModeChange={setViewMode}
            faceMode={faceMode} onFaceModeChange={setFaceMode} currentFillPatternId={currentFillPatternId}
            onFillPatternChange={setCurrentFillPatternId} 
            layoutCorner={layoutCorner} onLayoutCornerChange={setLayoutCorner}
            canUndo={history.past.length > 0} canRedo={false}
            onUndo={undo} onRedo={()=>{}} onSaveToLibrary={handleSaveToLibrary} onSave={handleExport} onLoad={() => setShowProjectManager(true)}
            onImport={() => isTauri ? handleLoadFromFile() : fileInputRef.current?.click()}
            onDownloadPdf={handlePdfDownload} onApplyToWarp={() => { setYarnSelectorState({ isOpen: true, type: 'warp' }); }}
            onApplyToWeft={() => { setYarnSelectorState({ isOpen: true, type: 'weft' }); }}
        />
        
        <GlobalPaletteBar 
            appMode={appMode}
            warpYarns={warpYarns}
            weftYarns={weftYarns}
            activeYarnId={activeYarnId}
            selectedYarnType={selectedYarnType}
            onSelectYarn={(id, type) => { handleYarnSelect(id, type); }}
            onDropWeaveOnYarn={handleDropWeaveOnYarn}
            onUpdateYarnColor={handleUpdateYarnColor}
        />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur px-4 py-1 rounded-full shadow-sm border border-gray-200 hidden md:block">
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-transparent text-center font-bold text-gray-700 text-xs focus:outline-none focus:text-blue-600 w-48" placeholder="Untitled Project" />
        </div>
        
        <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative bg-white">
            <div className="shrink-0 h-full border-r border-gray-200 z-40 bg-gray-900">
                <ProgressiveToolbar mode={appMode} onModeChange={handleModeChange} />
            </div>
            
            <div className="flex-1 flex flex-row min-w-0 relative overflow-hidden">
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {isYarnMode && <YarnStudio yarn={studioYarnDef} onChange={setStudioYarnDef} onApply={handleApplyStudioYarn} />}
                    {isColorwayMode && <ColorwayStudio initialWarpYarns={warpYarns} initialWeftYarns={weftYarns} warpPatternString={warpPatternString} weftPatternString={weftPatternString} dentingPlan={dentingPlan} epi={settings.epi} ppi={settings.ppi} weavePattern={weavePattern} colorways={colorways} onColorwaysChange={setColorways} onApplyColorway={(w, p) => { saveHistory(); setWarpYarns(w); setWeftYarns(p); }} expandPatternString={expandPatternString} />}
                    {isSimMode && (
                        <div className="flex-1 relative bg-gray-50 overflow-hidden">
                            <FabricSimulationModal 
                                isOpen={true} 
                                onClose={() => setAppMode('weave')} 
                                weavePattern={weavePattern.pattern} 
                                structure={weavePattern.structure} 
                                epi={settings.epi} 
                                ppi={settings.ppi} 
                                dentingPlan={dentingPlan} 
                                weftZones={weftZones} 
                                warpYarns={warpYarns} 
                                weftYarns={weftYarns} 
                                warpYarnSequence={expandPatternString(warpPatternString)} 
                                weftYarnSequence={expandPatternString(weftPatternString)} 
                                embedded={true} 
                            />
                        </div>
                    )}
                    {isTechStudioMode && (
                        <TechStudio 
                            settings={settings} draft={draft} pegPlan={pegPlan} warpYarns={warpYarns} weftYarns={weftYarns} 
                            warpPatternString={warpPatternString} weftPatternString={weftPatternString} weavePattern={weavePattern} 
                            weftZones={weftZones} dentingPlan={dentingPlan} dentingPatternString={dentingPatternString} 
                            onUpdateDraft={setDraft} onUpdatePegPlan={setPegPlan} onUpdateWarpPattern={setWarpPatternString} 
                            onUpdateWeftPattern={(s, z) => handlePatternApply('weft', s, z)} 
                            onUpdateDenting={(plan, str) => { setDentingPlan(plan); setDentingPatternString(str); }} 
                            onUpdateSettings={handleSettingsChange} onSyncDimensions={handleSyncGridDimensions} onSnapshot={saveHistory} 
                            onEditYarn={(char, type) => { handleYarnSelect(char, type); handleModeChange('yarn'); }} 
                            isWarpScaled={isWarpScaled} onToggleWarpScale={() => { setIsWarpScaled(!isWarpScaled); if (!isWarpScaled) setIsWeftScaled(false); }} 
                            isWeftScaled={isWeftScaled} onToggleWeftScale={() => { setIsWeftScaled(!isWarpScaled); if (!isWarpScaled) setIsWarpScaled(false); }} 
                        />
                    )}
                    {isPrintMode && (
                        <PrintStudio 
                            settings={settings}
                            draft={draft}
                            pegPlan={pegPlan}
                            warpYarns={warpYarns}
                            weftYarns={weftYarns}
                            warpPatternString={warpPatternString}
                            weftPatternString={weftPatternString}
                            weavePattern={weavePattern}
                            dentingPlan={dentingPlan}
                            colorways={colorways}
                        />
                    )}
                    {isPatternMode && (
                        <VisualPatternStudio 
                            warpPatternString={warpPatternString}
                            weftPatternString={weftPatternString}
                            onUpdateWarpPattern={setWarpPatternString}
                            onUpdateWeftPattern={setWeftPatternString}
                            warpYarns={warpYarns}
                            weftYarns={weftYarns}
                            structure={weavePattern.structure}
                            activeYarnId={activeYarnId}
                            selectedYarnType={selectedYarnType}
                            onSnapshot={saveHistory}
                            epi={settings.epi}
                            ppi={settings.ppi}
                            dentingPlan={dentingPlan}
                            weftZones={weftZones}
                            onSelectYarn={handleYarnSelect}
                            onDropWeaveOnYarn={handleDropWeaveOnYarn}
                        />
                    )}
                    {(isWeaveMode || isSpecsMode) && (
                        <div className="flex-1 relative bg-gray-50 overflow-hidden">
                            <WeaveArea 
                              draft={draft} 
                              pegPlan={pegPlan} 
                              warpPattern={warpPattern} 
                              weftPattern={weftPattern} 
                              weavePattern={weavePattern.pattern} 
                              structure={weavePattern.structure} 
                              handleDraftInteraction={handleDraftInteraction} 
                              handlePegPlanInteraction={handlePegPlanInteraction} 
                              handleDrawdownInteraction={handleDrawdownInteraction} 
                              handleWarpColorInteraction={handleWarpColorInteraction} 
                              handleWeftColorInteraction={handleWeftColorInteraction} 
                              handleDentingInteraction={handleDentingInteraction} 
                              pegPlanActiveColor="#3B82F6" 
                              draftActiveColor="#3B82F6" 
                              currentTool={currentTool} 
                              gridDivision={settings.gridDivision} 
                              viewMode={viewMode} 
                              faceMode={faceMode} 
                              epi={settings.epi} 
                              ppi={settings.ppi} 
                              warpRepeat={technicalWarpLen} 
                              weftRepeat={technicalWeftLen} 
                              dentingGrid={dentingGrid} 
                              weftZones={weftZones} 
                              warpYarns={warpYarns} 
                              weftYarns={weftYarns} 
                              warpYarnSequence={expandPatternString(warpPatternString)} 
                              weftYarnSequence={expandPatternString(weftPatternString)} 
                              layoutCorner={layoutCorner} 
                              initialScale={0.5} 
                              gridRepeatW={settings.warpThreads} 
                              gridRepeatP={settings.weftPicks} 
                              onUpdatePegPlan={setPegPlan}
                              onUpdateDraft={setDraft}
                              onUpdateSettings={handleSettingsChange}
                              onUpdateWarpPattern={setWarpPatternString}
                              onUpdateWeftPattern={setWeftPatternString}
                              onSnapshot={saveHistory}
                              settings={settings}
                            />
                        </div>
                    )}
                    {appMode === 'tech' && <ProductionCalculator settings={settings} warpYarns={warpYarns} weftYarns={weftYarns} warpPatternString={warpPatternString} weftPatternString={weftPatternString} dentingPlan={dentingPlan} draft={draft} pegPlan={pegPlan} generateThumbnail={generateThumbnail} />}
                </div>

                {(isWeaveMode || isSpecsMode || isYarnMode || isSimMode || isPatternMode) && (
                    <RightPanel
                        settings={settings} onSettingsChange={handleSettingsChange} dentingPattern={dentingPatternString} onDentingChange={setDentingPatternString} onSnapshot={saveHistory} onLoadWeave={handleLoadWeave} customWeaves={customWeaves} onAddWeave={(w)=>setCustomWeaves(p=>[...p,w])} onUpdateWeave={(w)=>setCustomWeaves(p=>p.map(cw=>cw.id===w.id?w:cw))} onDeleteWeave={(id)=>setCustomWeaves(p=>(p as LibraryWeave[]).filter(cw=>cw.id!==id))} warpYarns={warpYarns} weftYarns={weftYarns} onUpdateWarpYarn={(c,d)=>setWarpYarns(p=>({...p,[c]:d}))} onUpdateWeftYarn={(c,d)=>setWeftYarns(p=>({...p,[c]:d}))} onUpdateAllYarns={(t,y)=>t==='warp'?setWarpYarns(y):setWeftYarns(y)} paletteColors={paletteColors} warpPatternString={warpPatternString} setWarpPatternString={setWarpPatternString} weftPatternString={weftPatternString} setWeftPatternString={setWeftPatternString} onOpenGridEditor={(t)=>setPatternManagerState({isOpen:true,type:t})} onOpenPatternGenerator={(t)=>setPatternManagerState({isOpen:true,type:t})} currentInput={{draft,pegPlan,warpPattern,weftPattern}} onApplyGenerated={(res)=>{saveHistory();if(res.draft)setDraft(deserializeGrid(res.draft));if(res.pegPlan)setPegPlan(deserializeGrid(res.pegPlan));if(res.warpPattern)setWarpPatternString(res.warpPattern);if(res.weftPattern)setWarpPatternString(res.weftPattern);}} onSimulate={()=>setShowSimModal(true)} selectedColorIndex={selectedColorIndex} onSelectColor={setSelectedColorIndex} onOpenDraftStudio={() => setShowDraftStudio(true)} onOpenPegPlanStudio={() => setShowPegPlanStudio(true)} activeYarnId={activeYarnId} selectedYarnType={selectedYarnType} onSelectYarn={(id, type) => { handleYarnSelect(id, type); handleModeChange('yarn'); }} onActiveYarnChange={(id) => { setActiveYarnId(id); handleModeChange('yarn'); }} forcedTab={rightPanelTab as any} onSyncGridDimensions={handleSyncGridDimensions}
                        isWeftScaled={isWeftScaled} onToggleWeftScale={() => { setIsWeftScaled(!isWeftScaled); if (!isWarpScaled) setIsWeftScaled(false); }}
                        isWarpScaled={isWarpScaled} onToggleWarpScale={() => { setIsWarpScaled(!isWarpScaled); if (!isWarpScaled) setIsWeftScaled(false); }}
                        onDropWeaveOnYarn={handleDropWeaveOnYarn}
                    />
                )}
            </div>
        </div>

        <FabricSimulationModal isOpen={showSimModal} onClose={()=>setShowSimModal(false)} weavePattern={weavePattern.pattern} structure={weavePattern.structure} epi={settings.epi} ppi={settings.ppi} dentingPlan={dentingPlan} weftZones={weftZones} warpYarns={warpYarns} weftYarns={weftYarns} warpYarnSequence={expandPatternString(warpPatternString)} weftYarnSequence={expandPatternString(weftPatternString)} />
        <PatternManagerModal isOpen={patternManagerState.isOpen} onClose={()=>setPatternManagerState({...patternManagerState,isOpen:false})} target={patternManagerState.type==='warp'?'Warp':'Weft'} patternString={patternManagerState.type==='warp'?warpPatternString:weftPatternString} onApply={(s,z)=>handlePatternApply(patternManagerState.type,s,z)} availableChars={Object.keys(patternManagerState.type==='warp'?warpYarns:weftYarns)} colorMap={patternManagerState.type==='warp'?warpColors:weftColors} onEditYarn={(c)=>handleYarnSelect(c,patternManagerState.type)} totalPicks={settings.weftPicks} initialZones={weftZones} yarns={patternManagerState.type==='warp'?warpYarns:weftYarns} onUpdateYarn={(c,d)=>{saveHistory();if(patternManagerState.type==='warp')setWarpYarns(p=>({...p,[c]:d}));else setWeftYarns(p=>({...p,[c]:d}))}} isScaled={patternManagerState.type==='warp' ? isWarpScaled : isWeftScaled} onToggleScale={patternManagerState.type==='warp' ? (() => { setIsWarpScaled(!isWarpScaled); if (!isWarpScaled) setIsWeftScaled(false); }) : (() => { setIsWeftScaled(!isWeftScaled); if (!isWarpScaled) setIsWarpScaled(false); })} />
        <YarnSelectorModal isOpen={yarnSelectorState.isOpen} onClose={()=>setYarnSelectorState({...yarnSelectorState,isOpen:false})} title={`Select ${yarnSelectorState.type==='warp'?'Warp':'Weft'} Yarn`} yarns={yarnSelectorState.type==='warp'?warpYarns:weftYarns} onSelect={(c, d)=>handleStructureApply(c, d)} isWarp={yarnSelectorState.type==='warp'} />
        <ProjectManagerModal isOpen={showProjectManager} onClose={()=>setShowProjectManager(false)} onLoadProject={handleLoadFromStorage} onImport={() => isTauri ? handleLoadFromFile() : fileInputRef.current?.click()} />
        <DraftStudioModal isOpen={showDraftStudio} onClose={() => setShowDraftStudio(false)} draft={draft} dentingPlan={dentingPlan} harnesses={settings.harnesses} warpThreads={settings.warpThreads} onSave={(d, de, w) => { saveHistory(); const newSettings = { ...settings, warpThreads: w }; handleSettingsChange(newSettings); setDraft(d); setDentingPlan(de); setShowDraftStudio(false); }} />
        <PegPlanStudioModal isOpen={showPegPlanStudio} onClose={() => setShowPegPlanStudio(false)} pegPlan={pegPlan} harnesses={settings.harnesses} weftPicks={settings.weftPicks} onSave={(p, h) => { saveHistory(); const newSettings = { ...settings, weftPicks: h }; handleSettingsChange(newSettings); setPegPlan(p); setShowPegPlanStudio(false); }} />
    </div>
  );
};