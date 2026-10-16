
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WeaveSettings, YarnDefinition, WeavePattern } from '../types';
import { renderFabricToCanvas } from './fabricRenderer';
import { parsePatternString } from '../utils/patternParser';

interface SpecSheetData {
    settings: WeaveSettings;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    warpPatternString: string;
    weftPatternString: string;
    dentingPlan?: number[];
    dentingPatternString: string;
    draft: boolean[][];
    pegPlan: boolean[][];
    weavePattern: WeavePattern;
}

const getUsagePercentage = (patternStr: string, yarns: { [key: string]: YarnDefinition }, totalLength: number): { [key: string]: number } => {
    const counts: { [key: string]: number } = {};
    const regex = /(\d+)([A-Z])/gi;
    let match;
    while ((match = regex.exec(patternStr)) !== null) {
        const count = parseInt(match[1], 10);
        const char = match[2].toUpperCase();
        counts[char] = (counts[char] || 0) + count;
    }
    
    // Normalize to percentage
    const percentages: { [key: string]: number } = {};
    let calculatedTotal = 0;
    Object.values(counts).forEach(c => calculatedTotal += c);

    Object.keys(yarns).forEach(char => {
        const count = counts[char] || 0;
        percentages[char] = calculatedTotal > 0 ? (count / calculatedTotal) * 100 : 0;
    });
    
    return percentages;
}

export const renderGridToDataUrl = (grid: boolean[][], width: number, height: number, activeColor: string = '#000'): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    const cellW = width / cols;
    const cellH = height / rows;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw Grid Lines
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) { ctx.moveTo(0, r*cellH); ctx.lineTo(width, r*cellH); }
    for (let c = 0; c <= cols; c++) { ctx.moveTo(c*cellW, 0); ctx.lineTo(c*cellW, height); }
    ctx.stroke();

    // Draw Active Cells
    ctx.fillStyle = activeColor;
    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            if (grid[r][c]) {
                ctx.fillRect(c*cellW, r*cellH, cellW, cellH);
            }
        }
    }
    
    return canvas.toDataURL('image/png');
}

// Applies a "Pinking Shears" zigzag cut to the canvas edges
// Fix: Added export keyword to allow usage in PrintStudio.tsx
export const applyZigZagBorder = (source: HTMLCanvasElement): HTMLCanvasElement => {
    const { width, height } = source;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;

    // Scale tooth size based on resolution (approx 40px for high res)
    const targetTooth = Math.max(20, Math.min(width, height) / 40); 
    
    // Calculate exact fitting teeth to ensure corners align
    const teethTop = Math.round(width / targetTooth);
    const toothX = width / teethTop;
    const halfX = toothX / 2;
    
    const teethSide = Math.round(height / targetTooth);
    const toothY = height / teethSide;
    const halfY = toothY / 2;

    // Amplitude of the cut (depth into the fabric)
    const ampX = halfX * 0.8;
    const ampY = halfY * 0.8;

    ctx.beginPath();
    ctx.moveTo(0, 0);

    // Top Edge (Left to Right)
    for(let i=0; i<teethTop; i++) {
        const startX = i * toothX;
        ctx.lineTo(startX + halfX, ampY); // Dip in
        ctx.lineTo(startX + toothX, 0);   // Peak out
    }
    
    // Right Edge (Top to Bottom)
    for(let i=0; i<teethSide; i++) {
        const startY = i * toothY;
        ctx.lineTo(width - ampX, startY + halfY);
        ctx.lineTo(width, startY + toothY);
    }
    
    // Bottom Edge (Right to Left)
    for(let i=0; i<teethTop; i++) {
        const startX = width - (i * toothX);
        ctx.lineTo(startX - halfX, height - ampY);
        ctx.lineTo(startX - toothX, height);
    }
    
    // Left Edge (Bottom to Top)
    for(let i=0; i<teethSide; i++) {
        const startY = height - (i * toothY);
        ctx.lineTo(ampX, startY - halfY);
        ctx.lineTo(0, startY - toothY);
    }
    
    ctx.closePath();
    ctx.clip();
    
    // Draw original image into clipped region
    ctx.drawImage(source, 0, 0);
    
    return canvas;
};

export const generateSpecSheet = async (data: SpecSheetData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    // --- PAGE 1: Overview ---
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    doc.text("Fabric Technical Specification", margin, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 28);
    doc.text(`Ref: DobbyMaster-${Date.now().toString().slice(-6)}`, pageWidth - margin - 40, 28);

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 32, pageWidth - margin, 32);

    // 1. Fabric Simulation (Actual Size Swatch)
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Fabric Swatch (Actual Size)", margin, 42);

    // Prepare helper for sequence IDs
    const expandIds = (str: string) => {
        const res = [];
        const regex = /(\d+)([A-Z])/gi;
        let match;
        while ((match = regex.exec(str)) !== null) {
            const count = parseInt(match[1]);
            const char = match[2].toUpperCase();
            for(let i=0; i<count; i++) res.push(char);
        }
        return res;
    };

    // Calculate Physical Scale Dimensions
    // We want the swatch to be the full width of the printable area, and a fixed height.
    const swatchWidthMm = pageWidth - (margin * 2); // e.g. 180mm
    const swatchHeightMm = 100; // 10cm tall swatch
    
    const dpi = 300; // High resolution for print
    
    // renderFabricToCanvas expects width/height in CSS pixels (96dpi), 
    // then it multiplies by (dpi/96) internally to get actual canvas pixels.
    // To get 'Actual Size' content, we pass the physical dimensions converted to 96 DPI CSS units.
    const widthCssPx = (swatchWidthMm / 25.4) * 96;
    const heightCssPx = (swatchHeightMm / 25.4) * 96;

    const simCanvas = renderFabricToCanvas({
        weavePattern: data.weavePattern.pattern,
        structure: data.weavePattern.structure,
        epi: data.settings.epi,
        ppi: data.settings.ppi,
        dentingPlan: data.dentingPlan,
        warpYarns: data.warpYarns,
        weftYarns: data.weftYarns,
        warpYarnSequence: expandIds(data.warpPatternString),
        weftYarnSequence: expandIds(data.weftPatternString),
        viewSide: 'face',
        dpi: dpi, 
        width: widthCssPx,
        height: heightCssPx
    });
    
    // Apply ZigZag Pinking Shears Effect
    const cutCanvas = applyZigZagBorder(simCanvas);
    
    const simImgData = cutCanvas.toDataURL('image/png');
    doc.addImage(simImgData, 'PNG', margin, 46, swatchWidthMm, swatchHeightMm);

    // 2. Construction Specs
    const statsY = 155;
    doc.setFontSize(12);
    doc.text("Construction Details", margin, statsY);
    
    autoTable(doc, {
        startY: statsY + 4,
        head: [['Property', 'Value', 'Property', 'Value']],
        body: [
            ['Warp Ends / Inch (EPI)', data.settings.epi.toString(), 'Repeat Width (Ends)', data.settings.warpThreads.toString()],
            ['Weft Picks / Inch (PPI)', data.settings.ppi.toString(), 'Repeat Height (Picks)', data.settings.weftPicks.toString()],
            ['Harnesses', data.settings.harnesses.toString(), 'Denting Pattern', data.dentingPatternString],
        ],
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin }
    });

    // 3. Yarn Tables
    // autoTable assigns state to doc.lastAutoTable
    const yarnTableY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Material Bill of Quantity (Yarns)", margin, yarnTableY);

    const warpUsage = getUsagePercentage(data.warpPatternString, data.warpYarns, data.settings.warpThreads);
    const weftUsage = getUsagePercentage(data.weftPatternString, data.weftYarns, data.settings.weftPicks);

    const warpRows = Object.entries(data.warpYarns).filter(([id]) => warpUsage[id] > 0).map(([id, y]) => [
        `Warp ${id}`, 
        y.color, 
        `${y.ply}/${y.count} ${y.countSystem} ${y.fiberType}`, 
        `${warpUsage[id].toFixed(1)}%`
    ]);
    
    const weftRows = Object.entries(data.weftYarns).filter(([id]) => weftUsage[id] > 0).map(([id, y]) => [
        `Weft ${id}`, 
        y.color, 
        `${y.ply}/${y.count} ${y.countSystem} ${y.fiberType}`, 
        `${weftUsage[id].toFixed(1)}%`
    ]);

    autoTable(doc, {
        startY: yarnTableY + 4,
        head: [['Role', 'Color', 'Description', 'Pattern Usage']],
        body: [...warpRows, ...weftRows],
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
                data.cell.text = ''; // Clear text
            }
        },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
                const color = [...warpRows, ...weftRows][data.row.index][1]; // Get color hex
                doc.setFillColor(color);
                doc.setDrawColor(200, 200, 200);
                const dim = data.cell.height - 4;
                doc.rect(data.cell.x + 2, data.cell.y + 2, dim, dim, 'FD');
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                doc.text(color, data.cell.x + dim + 4, data.cell.y + dim/2 + 2);
            }
        },
        styles: { fontSize: 9, cellPadding: 1.5 },
        margin: { left: margin, right: margin }
    });


    // --- PAGE 2: Technical ---
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setTextColor(0,0,0);
    doc.text("Weave Structure & Pattern", margin, 20);

    // 4. Pattern Sequences
    doc.setFontSize(11);
    doc.setTextColor(50,50,50);
    doc.text("Warp Pattern Sequence:", margin, 30);
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    
    // Wrap text logic
    const splitWarp = doc.splitTextToSize(data.warpPatternString, pageWidth - (margin*2));
    doc.text(splitWarp, margin, 36);
    
    const nextY = 36 + (splitWarp.length * 5) + 5;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Weft Pattern Sequence:", margin, nextY);
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    
    const splitWeft = doc.splitTextToSize(data.weftPatternString, pageWidth - (margin*2));
    doc.text(splitWeft, margin, nextY + 6);
    
    // 5. Grids
    const gridY = nextY + (splitWeft.length * 5) + 15;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Technical Grids", margin, gridY);

    const draftImg = renderGridToDataUrl(data.draft, 300, Math.min(300, data.draft.length * 20), '#000');
    const pegImg = renderGridToDataUrl(data.pegPlan, 300, Math.min(300, data.pegPlan.length * 20), '#000');
    
    // Layout side by side
    const maxGridWidth = (pageWidth - (margin*3)) / 2;
    
    doc.addImage(draftImg, 'PNG', margin, gridY + 10, maxGridWidth, maxGridWidth * (data.draft.length / (data.draft[0]?.length || 1)));
    doc.setFontSize(9);
    doc.text("Draft (Threading)", margin, gridY + 8);
    
    doc.addImage(pegImg, 'PNG', margin + maxGridWidth + margin, gridY + 10, maxGridWidth, maxGridWidth * (data.pegPlan.length / (data.pegPlan[0]?.length || 1)));
    doc.text("Peg Plan (Lifting)", margin + maxGridWidth + margin, gridY + 8);
    
    // Save
    doc.save(`spec-sheet-${Date.now()}.pdf`);
};
