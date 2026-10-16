
// WIF 1.1 Generator for WonderWeaves
import { WeaveSettings } from '../../types';

interface WifData {
    loom: WeaveSettings;
    draft: boolean[][];
    pegPlan: boolean[][];
    warpColors: string[]; // expanded array of hex codes
    weftColors: string[]; // expanded array of hex codes
    metadata?: {
        title?: string;
        author?: string;
        date?: string;
        notes?: string;
    };
}

// Helper: Hex to RGB 0-255
const hexToRgb = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
};

export const generateWif = (data: WifData): string => {
    const { loom, draft, pegPlan, warpColors, weftColors, metadata } = data;
    const now = new Date().toLocaleDateString();

    let wif = `[WIF]
Version=1.1
Date=${now}
Developers=WonderWeaves
Source Program=DobbyMaster v2.1
Source Version=2.1

[CONTENTS]
COLOR PALETTE=yes
TEXT=yes
WEAVING=yes
WARP=yes
WEFT=yes
COLOR TABLE=yes
WARP COLORS=yes
WEFT COLORS=yes
Symie=no

[TEXT]
Title=${metadata?.title || 'Untitled Weave'}
Author=${metadata?.author || 'WonderWeaves User'}
Date=${metadata?.date || now}
Notes=${metadata?.notes || ''}

[WARP]
Threads=${warpColors.length}
Units=Decimeters
Thickness=1

[WEFT]
Threads=${weftColors.length}
Units=Decimeters
Thickness=1

[WEAVING]
Shafts=${loom.harnesses}
Treadles=${loom.harnesses}
Rising Shed=yes

`;

    // --- COLOR PALETTE ---
    // 1. Identify unique colors
    const uniqueColors = Array.from(new Set([...warpColors, ...weftColors])).sort();
    const colorMap = new Map<string, number>(); // Hex -> WIF Index (1-based)
    
    wif += `[COLOR PALETTE]\nRange=0,255\n`;
    uniqueColors.forEach((color, index) => {
        const id = index + 1;
        colorMap.set(color, id);
        wif += `${id}=${hexToRgb(color)}\n`;
    });
    wif += `\n`;

    // --- WARP COLORS ---
    wif += `[WARP COLORS]\n`;
    warpColors.forEach((color, i) => {
        wif += `${i + 1}=${colorMap.get(color)}\n`;
    });
    wif += `\n`;

    // --- WEFT COLORS ---
    wif += `[WEFT COLORS]\n`;
    weftColors.forEach((color, i) => {
        wif += `${i + 1}=${colorMap.get(color)}\n`;
    });
    wif += `\n`;

    // --- THREADING (DRAFT) ---
    // WIF: Index=Shaft (1-based)
    wif += `[THREADING]\n`;
    const numWarp = warpColors.length;
    // Note: draft is [harness][warpIndex]
    // We assume single harness per thread for WIF 1.1 standard threading.
    // If multiple harnesses are active for one thread, WIF 1.1 typically handles this via multiple entries or specific syntax, 
    // but standard Dobby is 1 shaft per thread. We take the first active shaft.
    for (let c = 0; c < numWarp; c++) {
        // Find active harness for this warp thread column (tile draft if needed)
        // DobbyMaster repeats draft if warp > draft width, but passed `draft` might be the unit.
        // We need to map `c` to the draft unit.
        const draftWidth = draft[0]?.length || 1;
        const draftCol = c % draftWidth;
        
        let harness = 0;
        for (let r = 0; r < draft.length; r++) {
            if (draft[r][draftCol]) {
                harness = r + 1; 
                break;
            }
        }
        if (harness > 0) {
            wif += `${c + 1}=${harness}\n`;
        }
    }
    wif += `\n`;

    // --- TIEUP (PEG PLAN) ---
    // In Dobby Master, Peg Plan is often treated as "Lift Plan" (Direct Tie-up).
    // WIF supports [TIEUP] (Treadle=Shafts) and [TREADLING] (Pick=Treadle).
    // For direct lift (Peg Plan), we usually map 1 Pick = 1 Treadle, so Tieup describes the lift of that pick.
    
    // However, if we want to support "Lift Plan" directly, WIF usually uses [TIEUP] where treadles = shafts 
    // and [TREADLING] matches the lift plan.
    // Actually, for a Peg Plan (Lift Plan), the standard way in WIF is to define TIEUP where Treadle i lifts Shafts for Pick pattern i?
    // Let's stick to the convention: 
    // If it's a Dobby (Lift Plan), we usually define as many Treadles as unique Picks, OR
    // just treat it as Direct Tie-up where Treadles = Picks? No that's inefficient.
    // DobbyMaster uses 'pegPlan' which is visual.
    // Let's assume Direct Tie-up Mode: Treadle 1 = Pick 1 content. Treadling sequence = 1,2,3...
    
    // Wait, typically Peg Plan implies the sequence is linear. 
    // So we define N treadles where N = number of picks in repeat?
    
    const numPicks = weftColors.length;
    const pegHeight = pegPlan.length; // The unit repeat
    
    wif += `[TIEUP]\n`;
    for (let p = 0; p < pegHeight; p++) {
        const liftedShafts = [];
        for (let h = 0; h < loom.harnesses; h++) {
            if (pegPlan[p][h]) {
                liftedShafts.push(h + 1);
            }
        }
        // Even if empty, we might need an entry, but usually skipped.
        if (liftedShafts.length > 0) {
            // Pick p+1 corresponds to "Treadle" p+1 in a direct lift scenario
            wif += `${p + 1}=${liftedShafts.join(',')}\n`;
        }
    }
    wif += `\n`;

    // --- TREADLING ---
    // Pick=Treadle
    wif += `[TREADLING]\n`;
    for (let p = 0; p < numPicks; p++) {
        // Map current pick to the peg plan row
        const pegRow = (p % pegHeight) + 1;
        wif += `${p + 1}=${pegRow}\n`;
    }

    return wif;
};
