import { WeaveInput, WeavePattern } from '../types';

// Check if running in Tauri
const isTauri = !!(window as any).__TAURI__;
let invoke: any = null;

if (isTauri) {
    import('@tauri-apps/api/core').then(mod => {
        invoke = mod.invoke;
    });
}

// Helper to map each warp thread index to the first harness that controls it (JS Fallback)
export const getWarpToHarnessMap = (draft: boolean[][], numWarpThreads: number): (number | null)[] => {
    const numHarnesses = draft.length;
    if (numHarnesses === 0) return Array(numWarpThreads).fill(null);
    const draftWidth = draft[0]?.length || 1;
    
    const map: (number | null)[] = Array(numWarpThreads).fill(null);
    for (let warp = 0; warp < numWarpThreads; warp++) {
        // Tile the structural draft over the technical warp length
        const structuralCol = warp % draftWidth;
        for (let harness = 0; harness < numHarnesses; harness++) {
            if (draft[harness] && draft[harness][structuralCol]) {
                map[warp] = harness;
                break;
            }
        }
    }
    return map;
};

// Pure JS Implementation (Fallback)
const generateWeaveJS = (input: WeaveInput): WeavePattern => {
  const { draft, pegPlan, warpPattern, weftPattern } = input;

  const numHarnesses = draft.length;
  const numWarpThreads = warpPattern.length; // Technical length (LCM)
  const numWeftPicks = weftPattern.length;   // Technical length (LCM)
  
  const pattern: string[][] = Array.from({ length: numWeftPicks }, () => Array(numWarpThreads).fill('transparent'));
  const structure: boolean[][] = Array.from({ length: numWeftPicks }, () => Array(numWarpThreads).fill(false));

  if (numHarnesses === 0 || numWarpThreads === 0 || numWeftPicks === 0 || pegPlan.length === 0) {
      return { pattern, structure };
  }

  const warpToHarnessMap = getWarpToHarnessMap(draft, numWarpThreads);
  const pegHeight = pegPlan.length;

  for (let weft = 0; weft < numWeftPicks; weft++) {
    // Tile the structural peg plan over the technical weft length
    const structuralRow = weft % pegHeight;
    for (let warp = 0; warp < numWarpThreads; warp++) {
      const harnessForWarp = warpToHarnessMap[warp];

      if (harnessForWarp !== null) {
        // Use structuralRow for pegPlan lookup to repeat structural pattern
        const isLifted = pegPlan[structuralRow] && pegPlan[structuralRow][harnessForWarp];

        if (isLifted) {
          pattern[weft][warp] = warpPattern[warp] || 'transparent';
          structure[weft][warp] = true;
        } else {
          pattern[weft][warp] = weftPattern[weft] || 'transparent';
          structure[weft][warp] = false;
        }
      }
    }
  }

  return { pattern, structure };
};

export const generateWeave = (input: WeaveInput): WeavePattern => {
    // If Tauri is available, we *could* use async invoke, 
    // but generateWeave is currently used synchronously in useMemo in React.
    // To fully migrate to Rust, the React components need to handle async state.
    // For now, we keep the JS implementation for instant UI updates, 
    // but in a real migration, we would switch DobbyMaster to use async calls for large patterns.
    
    // NOTE: To enable Rust generation, components calling this must await the result.
    // Since strict refactoring of all components to async is outside minimal scope,
    // we return the JS version synchronously here. 
    
    // Ideally: 
    // if (isTauri) return await invoke('generate_weave_native', { input });
    
    return generateWeaveJS(input);
};

export const generateWeaveAsync = async (input: WeaveInput): Promise<WeavePattern> => {
    if (isTauri && invoke) {
        try {
            // Map input to match Rust struct keys (camelCase to snake_case usually handled by Tauri/Serde automatically if configured, 
            // but let's send object matching Rust struct)
            const rustInput = {
                draft: input.draft,
                peg_plan: input.pegPlan,
                warp_pattern: input.warpPattern,
                weft_pattern: input.weftPattern
            };
            return await invoke('generate_weave_native', { input: rustInput });
        } catch (e) {
            console.error("Rust computation failed, falling back to JS", e);
            return generateWeaveJS(input);
        }
    }
    return generateWeaveJS(input);
}

/**
 * Reverse engineers a Draft and Peg Plan from a full weave grid (Weave Reduction).
 */
export const reconstructWeaveFromGrid = (
  grid: boolean[][], 
  warpThreads: number, 
  weftPicks: number
): { draft: boolean[][], pegPlan: boolean[][], harnesses: number } => {
    const uniqueCols = new Map<string, number>();
    const warpToHarness = new Array(warpThreads).fill(0);
    let nextHarnessIndex = 0;
    
    for (let w = 0; w < warpThreads; w++) {
        let signature = "";
        for (let p = 0; p < weftPicks; p++) {
            signature += (grid[p] && grid[p][w]) ? "1" : "0";
        }
        
        if (!uniqueCols.has(signature)) {
            uniqueCols.set(signature, nextHarnessIndex++);
        }
        
        warpToHarness[w] = uniqueCols.get(signature)!;
    }
    
    const harnesses = Math.max(2, nextHarnessIndex);

    const newDraft = Array.from({ length: harnesses }, () => Array(warpThreads).fill(false));
    for (let w = 0; w < warpThreads; w++) {
        const h = warpToHarness[w];
        if (newDraft[h]) newDraft[h][w] = true;
    }
    
    const harnessToWarpRep = new Array(harnesses).fill(-1);
    for (let w = 0; w < warpThreads; w++) {
        const h = warpToHarness[w];
        if (harnessToWarpRep[h] === -1) harnessToWarpRep[h] = w;
    }
    
    const newPegPlan = Array.from({ length: weftPicks }, () => Array(harnesses).fill(false));
    
    for (let h = 0; h < harnesses; h++) {
        const repWarp = harnessToWarpRep[h];
        if (repWarp !== -1) {
            for (let p = 0; p < weftPicks; p++) {
                if (newPegPlan[p]) {
                    newPegPlan[p][h] = (grid[p] && grid[p][repWarp]) || false;
                }
            }
        }
    }
    
    return {
        draft: newDraft,
        pegPlan: newPegPlan,
        harnesses
    };
};