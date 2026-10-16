
import React, { useState, useEffect, useMemo } from 'react';
import { WeaveSettings, YarnDefinition, ProductionSettings, MillTicketConfig } from '../types';
import { calculateYarnPhysics } from '../services/yarnUtilities';
import { parsePatternString, getTotalThreads, expandPatternString } from '../utils/patternParser';
import { renderGridToDataUrl } from '../services/pdfGenerator';
import { generateWif } from '../services/io/wifParser';
import { downloadFile } from '../services/io/fileHandler';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfIcon, TableIcon, CalculatorIcon, PrinterIcon, DownloadIcon } from './icons';

interface ProductionCalculatorProps {
    settings: WeaveSettings;
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    warpPatternString: string;
    weftPatternString: string;
    dentingPlan?: number[];
    draft: boolean[][];
    pegPlan: boolean[][];
    generateThumbnail: () => string; // Function to get current sim image
}

const InputRow: React.FC<{label: string, value: any, onChange: (v:any)=>void, type?: string, unit?: string}> = ({label, value, onChange, type='number', unit}) => (
    <div className="flex justify-between items-center mb-2">
        <label className="text-xs text-gray-500 font-medium">{label}</label>
        <div className="flex items-center gap-1">
            <input 
                type={type} 
                value={value} 
                onChange={e => onChange(type==='number'? (e.target.value === '' ? 0 : parseFloat(e.target.value)) : e.target.value)} 
                className="w-20 bg-gray-50 border border-gray-200 rounded p-1 text-right text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
            {unit && <span className="text-[10px] text-gray-400 w-4">{unit}</span>}
        </div>
    </div>
);

export const ProductionCalculator: React.FC<ProductionCalculatorProps> = ({
    settings, warpYarns, weftYarns, warpPatternString, weftPatternString, dentingPlan, draft, pegPlan, generateThumbnail
}) => {
    // --- State ---
    const [prodSettings, setProdSettings] = useState<ProductionSettings & { loomSpeed: number, efficiency: number, hourlyRate: number, setupTime: number, metersPerPirn: number }>({
        clientName: '',
        orderNumber: '',
        loomId: '',
        weaverName: '',
        finishedWidth: 140, // cm
        finishedLength: 50, // meters
        warpTakeUp: 8, // %
        weftContraction: 5, // %
        warpWaste: 0.8, // m (loom waste)
        weftWaste: 2, // %
        priceCurrency: '€',
        loomSpeed: 120, // PPM (Picks Per Minute)
        efficiency: 85, // %
        hourlyRate: 25, // Currency/hr
        setupTime: 4, // Hours
        metersPerPirn: 300 // Standard shuttle pirn capacity
    });

    const [ticketConfig, setTicketConfig] = useState<MillTicketConfig>({
        showDraft: true,
        showPegPlan: true,
        showYarns: true,
        showCosting: true,
        showSwatch: true,
        showWarpPattern: true,
        showWeftPattern: true,
        paperSize: 'A4'
    });

    // --- Calculations ---
    const calculations = useMemo(() => {
        // 1. Dimensions
        // Reed Width = Finished Width / (1 - Contraction)
        const reedWidthCm = prodSettings.finishedWidth / (1 - (prodSettings.weftContraction / 100));
        
        // Total Warp Length = Finished Length / (1 - TakeUp) + Waste
        const totalWarpLengthM = (prodSettings.finishedLength / (1 - (prodSettings.warpTakeUp / 100))) + prodSettings.warpWaste;
        
        // Total Ends
        // Assumes EPI is "Ends Per Inch in Reed". 
        // Reed Width (cm) -> Inch. Ends = ReedWidthIn * EPI.
        const reedWidthInch = reedWidthCm / 2.54;
        const totalEnds = Math.ceil(reedWidthInch * settings.epi);
        
        // Total Picks
        // Picks = Finished Length * PPI (assuming PPI is finished picks?)
        // Standard: PPI is usually counted on finished fabric.
        const finLengthInch = prodSettings.finishedLength * 39.37;
        const totalPicks = Math.ceil(finLengthInch * settings.ppi);

        // 2. Yarn Consumption
        // Helper: Get pattern ratios
        const getRatios = (patternStr: string, total: number) => {
            const counts: {[k:string]:number} = {};
            const parsed = parsePatternString(patternStr, {A:'A',B:'B',C:'C',D:'D',E:'E',F:'F',G:'G',H:'H'});
            if (parsed.length === 0) return {};
            parsed.forEach(c => counts[c] = (counts[c] || 0) + 1);
            const patLen = parsed.length;
            const ratios: {[k:string]:number} = {};
            Object.keys(counts).forEach(k => ratios[k] = counts[k] / patLen);
            return ratios;
        };

        const warpRatios = getRatios(warpPatternString, totalEnds);
        const weftRatios = getRatios(weftPatternString, totalPicks);

        const yarnRequirements: {
            id: string; type: 'warp' | 'weft'; def: YarnDefinition; 
            endsOrPicks: number; totalMeters: number; weightKg: number; cost: number;
            packages: number; // Pirns or Beams
        }[] = [];

        let totalWeightKg = 0;
        let totalMaterialCost = 0;

        // Warp Calcs
        Object.keys(warpYarns).forEach(key => {
            if (warpRatios[key]) {
                const ends = Math.ceil(totalEnds * warpRatios[key]);
                const meters = ends * totalWarpLengthM;
                const phys = calculateYarnPhysics(warpYarns[key]);
                const weightKg = (meters * phys.tex) / 1000 / 1000; // Tex = g/km -> m * (g/km) / 1000 = g -> /1000 = kg
                const cost = weightKg * (warpYarns[key].price || 0);
                
                yarnRequirements.push({
                    id: key, type: 'warp', def: warpYarns[key],
                    endsOrPicks: ends, totalMeters: meters, weightKg, cost,
                    packages: 1 // Usually 1 warp beam unless sectional, but let's keep it simple
                });
                totalWeightKg += weightKg;
                totalMaterialCost += cost;
            }
        });

        // Weft Calcs
        // Weft Length per Pick = Reed Width (m) * (1 + WeftWaste)
        const weftLenPerPickM = (reedWidthCm / 100) * (1 + (prodSettings.weftWaste / 100));
        
        Object.keys(weftYarns).forEach(key => {
            if (weftRatios[key]) {
                const picks = Math.ceil(totalPicks * weftRatios[key]);
                const meters = picks * weftLenPerPickM;
                const phys = calculateYarnPhysics(weftYarns[key]);
                const weightKg = (meters * phys.tex) / 1000 / 1000;
                const cost = weightKg * (weftYarns[key].price || 0);
                
                // Bobbin/Pirn Calculation
                const bobbins = Math.ceil(meters / Math.max(1, prodSettings.metersPerPirn));

                yarnRequirements.push({
                    id: key, type: 'weft', def: weftYarns[key],
                    endsOrPicks: picks, totalMeters: meters, weightKg, cost,
                    packages: bobbins
                });
                totalWeightKg += weightKg;
                totalMaterialCost += cost;
            }
        });

        // 3. Technical Specs
        const finishedSqM = (prodSettings.finishedWidth / 100) * prodSettings.finishedLength;
        const gsm = finishedSqM > 0 ? (totalWeightKg * 1000) / finishedSqM : 0;
        const glm = prodSettings.finishedLength > 0 ? (totalWeightKg * 1000) / prodSettings.finishedLength : 0;

        // Cover Factor (Peirce)
        // K = ends/inch / sqrt(Ne) + picks/inch / sqrt(Ne)
        // Approximate using average Tex
        const warpAvgTex = yarnRequirements.filter(y=>y.type==='warp').reduce((a,b) => a + calculateYarnPhysics(b.def).tex, 0) / Math.max(1, Object.keys(warpRatios).length);
        const weftAvgTex = yarnRequirements.filter(y=>y.type==='weft').reduce((a,b) => a + calculateYarnPhysics(b.def).tex, 0) / Math.max(1, Object.keys(weftRatios).length);
        
        const warpCover = settings.epi * (Math.sqrt(warpAvgTex) / 28); // Approximation from Tex
        const weftCover = settings.ppi * (Math.sqrt(weftAvgTex) / 28); 
        const coverFactor = warpCover + weftCover;

        // 4. Heddle Counts
        const heddleCounts: number[] = new Array(settings.harnesses).fill(0);
        // We need to iterate over TOTAL warp ends. 
        // Logic: (Total Ends / Draft Width) * Draft Heddles per Col + Remainder
        const draftWidth = draft[0]?.length || 1;
        
        if (draftWidth > 0) {
            for (let i = 0; i < totalEnds; i++) {
                const draftCol = i % draftWidth;
                for (let h = 0; h < settings.harnesses; h++) {
                    // Check if draft has entry at [h][col]
                    // Handle resizing where draft might be smaller than harness count momentarily
                    if (h < draft.length && draft[h][draftCol]) {
                        heddleCounts[h]++;
                    }
                }
            }
        }

        // 5. Time & Labor
        // Total picks / (Speed * Efficiency)
        // Efficiency 85% means actual PPM = Speed * 0.85
        const actualPPM = prodSettings.loomSpeed * (prodSettings.efficiency / 100);
        const weavingMinutes = totalPicks / Math.max(1, actualPPM);
        const weavingHours = weavingMinutes / 60;
        const totalHours = weavingHours + prodSettings.setupTime;
        const laborCost = totalHours * prodSettings.hourlyRate;
        const totalProjectCost = totalMaterialCost + laborCost;

        return {
            reedWidthCm,
            totalWarpLengthM,
            totalEnds,
            totalPicks,
            yarnRequirements,
            totalWeightKg,
            totalMaterialCost,
            gsm,
            glm,
            coverFactor,
            heddleCounts,
            weavingHours,
            totalHours,
            laborCost,
            totalProjectCost
        };
    }, [prodSettings, settings, warpYarns, weftYarns, warpPatternString, weftPatternString, draft]);

    const handlePrint = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = 20;

        const checkPageBreak = (neededHeight: number) => {
            if (y + neededHeight > pageHeight - margin) {
                doc.addPage();
                y = 20;
            }
        };

        // Header
        doc.setFontSize(22);
        doc.text("Loom Ticket", margin, y);
        y += 8;
        
        doc.setFontSize(10);
        const headerInfo = [
            `Client: ${prodSettings.clientName || 'Internal'}`,
            `Order: ${prodSettings.orderNumber || 'N/A'}`,
            `Loom: ${prodSettings.loomId || 'Unassigned'}`,
            `Weaver: ${prodSettings.weaverName || 'Unassigned'}`,
            `Date: ${new Date().toLocaleDateString()}`
        ];
        
        let xPos = margin;
        headerInfo.forEach((info, i) => {
            if (i === 3) { // Break to next line for weaver/date if needed or just space out
                 xPos = margin; 
                 y += 6; 
            }
            doc.text(info, xPos, y);
            xPos += 60;
        });
        
        y += 10;
        doc.line(margin, y, 210-margin, y);
        y += 10;

        // Dimensions
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Production Parameters", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        const dimData = [
            ['Finished Width', `${prodSettings.finishedWidth} cm`, 'Finished Length', `${prodSettings.finishedLength} m`],
            ['Reed Width', `${calculations.reedWidthCm.toFixed(1)} cm`, 'Warp Length', `${calculations.totalWarpLengthM.toFixed(1)} m`],
            ['Warp Crimp', `${prodSettings.warpTakeUp}%`, 'Weft Shrink', `${prodSettings.weftContraction}%`],
            ['Total Ends', `${calculations.totalEnds}`, 'Total Picks', `${calculations.totalPicks}`],
            ['GSM', `${Math.round(calculations.gsm)} g/m²`, 'Cover Factor', `${calculations.coverFactor.toFixed(1)}`]
        ];

        autoTable(doc, {
            startY: y,
            head: [],
            body: dimData,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 1.5 },
            margin: { left: margin, right: margin }
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // Heddle Count Table
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Loom Setup (Heddle Count)", margin, y);
        y += 6;
        
        // Group heddles into rows of 8 for display if many harnesses
        const heddleRows = [];
        let chunk = [];
        for(let i=0; i<calculations.heddleCounts.length; i++) {
            chunk.push(`S${i+1}: ${calculations.heddleCounts[i]}`);
            if (chunk.length === 8 || i === calculations.heddleCounts.length - 1) {
                heddleRows.push(chunk);
                chunk = [];
            }
        }

        autoTable(doc, {
            startY: y,
            head: [],
            body: heddleRows,
            theme: 'plain',
            styles: { fontSize: 9, font: 'mono', cellPadding: 1 },
            margin: { left: margin, right: margin }
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // Material Table
        if (ticketConfig.showYarns) {
            checkPageBreak(60);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Material Requirements", margin, y);
            y += 6;

            const matBody = calculations.yarnRequirements.map(y => [
                y.type.toUpperCase(),
                y.id,
                `${y.def.ply}/${y.def.count} ${y.def.countSystem} ${y.def.fiberType}`,
                y.def.color,
                `${Math.ceil(y.totalMeters).toLocaleString()} m`,
                y.type === 'weft' ? `${y.packages} Pirns` : '-',
                `${y.weightKg.toFixed(3)} kg`,
                ticketConfig.showCosting ? `${prodSettings.priceCurrency}${y.cost.toFixed(2)}` : '-'
            ]);

            autoTable(doc, {
                startY: y,
                head: [['Type', 'ID', 'Description', 'Color', 'Length', 'Pirns/Pkg', 'Weight', 'Cost']],
                body: matBody,
                theme: 'striped',
                styles: { fontSize: 9 },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 3) {
                        const color = matBody[data.row.index][3];
                        doc.setFillColor(color as string);
                        doc.rect(data.cell.x + 2, data.cell.y + 2, 4, 4, 'FD');
                    }
                },
                margin: { left: margin, right: margin }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Commercials (Labor & Time)
        if (ticketConfig.showCosting) {
            checkPageBreak(40);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Time & Cost Estimation", margin, y);
            y += 6;
            
            const costData = [
                ['Setup Time', `${prodSettings.setupTime} hrs`, 'Hourly Rate', `${prodSettings.priceCurrency}${prodSettings.hourlyRate}`],
                ['Weaving Time', `${calculations.weavingHours.toFixed(1)} hrs`, 'Est. Labor', `${prodSettings.priceCurrency}${calculations.laborCost.toFixed(2)}`],
                ['Total Time', `${calculations.totalHours.toFixed(1)} hrs`, 'Total Material', `${prodSettings.priceCurrency}${calculations.totalMaterialCost.toFixed(2)}`],
                ['', '', 'TOTAL COST', `${prodSettings.priceCurrency}${calculations.totalProjectCost.toFixed(2)}`]
            ];

            autoTable(doc, {
                startY: y,
                head: [],
                body: costData,
                theme: 'grid',
                styles: { fontSize: 9 },
                columnStyles: { 3: { fontStyle: 'bold' } },
                margin: { left: margin, right: margin }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Pattern Sequences
        if (ticketConfig.showWarpPattern || ticketConfig.showWeftPattern) {
            checkPageBreak(40);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Pattern Sequences", margin, y);
            y += 6;
            doc.setFont("courier", "normal");
            doc.setFontSize(9);

            if (ticketConfig.showWarpPattern) {
                doc.text("Warp:", margin, y);
                const splitWarp = doc.splitTextToSize(warpPatternString, pageWidth - margin - 40);
                doc.text(splitWarp, margin + 20, y);
                y += (splitWarp.length * 4) + 4;
            }

            if (ticketConfig.showWeftPattern) {
                doc.text("Weft:", margin, y);
                const splitWeft = doc.splitTextToSize(weftPatternString, pageWidth - margin - 40);
                doc.text(splitWeft, margin + 20, y);
                y += (splitWeft.length * 4) + 8;
            }
            // Add spacing before next section
            y += 4;
        }

        // Grids (Draft & Peg Plan)
        if (ticketConfig.showDraft || ticketConfig.showPegPlan) {
            checkPageBreak(80);
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Weave Structure", margin, y);
            y += 10;

            const maxGridWidth = (pageWidth - (margin * 3)) / 2;
            const draftImg = ticketConfig.showDraft ? renderGridToDataUrl(draft, 300, Math.min(300, draft.length * 20), '#000') : null;
            const pegImg = ticketConfig.showPegPlan ? renderGridToDataUrl(pegPlan, 300, Math.min(300, pegPlan.length * 20), '#000') : null;

            if (draftImg) {
                // Determine height based on aspect ratio
                const draftRows = draft.length || 1;
                const draftCols = draft[0]?.length || 1;
                const draftHeight = maxGridWidth * (draftRows / draftCols);
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text("Draft (Threading)", margin, y - 2);
                doc.addImage(draftImg, 'PNG', margin, y, maxGridWidth, draftHeight);
            }

            if (pegImg) {
                const pegRows = pegPlan.length || 1;
                const pegCols = pegPlan[0]?.length || 1;
                const pegHeight = maxGridWidth * (pegRows / pegCols);
                const xPos = ticketConfig.showDraft ? margin + maxGridWidth + margin : margin;

                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text("Peg Plan (Lifting)", xPos, y - 2);
                doc.addImage(pegImg, 'PNG', xPos, y, maxGridWidth, pegHeight);
            }
            
            // Advance Y by max height of grids + padding
            const dH = draftImg ? (maxGridWidth * ((draft.length||1) / (draft[0]?.length||1))) : 0;
            const pH = pegImg ? (maxGridWidth * ((pegPlan.length||1) / (pegPlan[0]?.length||1))) : 0;
            y += Math.max(dH, pH) + 15;
        }

        // Add Thumbnail
        if (ticketConfig.showSwatch) {
            checkPageBreak(90);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Weave Simulation", margin, y);
            y += 6;
            const thumb = generateThumbnail();
            if (thumb) {
                doc.addImage(thumb, 'PNG', margin, y, 180, 80);
                y += 85;
            }
        }

        doc.save("mill-ticket.pdf");
    };

    const handleExportWif = () => {
        // Prepare Data for WIF
        // Need to expand pattern strings to full arrays for color sequences
        const warpChars = expandPatternString(warpPatternString);
        const weftChars = expandPatternString(weftPatternString);
        
        // If expansion returns empty (invalid string), fallback to A
        const safeWarpChars = warpChars.length > 0 ? warpChars : Array(settings.warpThreads).fill('A');
        const safeWeftChars = weftChars.length > 0 ? weftChars : Array(settings.weftPicks).fill('A');

        const warpColors = safeWarpChars.map(char => warpYarns[char]?.color || '#FFFFFF');
        const weftColors = safeWeftChars.map(char => weftYarns[char]?.color || '#FFFFFF');

        const wifContent = generateWif({
            loom: settings,
            draft,
            pegPlan,
            warpColors,
            weftColors,
            metadata: {
                title: prodSettings.orderNumber ? `${prodSettings.clientName} - ${prodSettings.orderNumber}` : 'Production Draft',
                author: prodSettings.weaverName,
                notes: `Reed Width: ${calculations.reedWidthCm.toFixed(1)}cm | Ends: ${calculations.totalEnds} | Picks: ${calculations.totalPicks}`
            }
        });

        downloadFile(wifContent, `production-draft-${Date.now()}.wif`, 'text/plain');
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* HEADER */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Production Engine</h2>
                    <p className="text-xs text-gray-500">Commercial costing and mill ticket generation.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportWif}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm font-bold text-xs transition-colors"
                        title="Download Weaving Information File"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export WIF
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm font-bold text-xs transition-colors"
                    >
                        <PrinterIcon className="w-4 h-4" />
                        Print Mill Ticket
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* LEFT: INPUTS */}
                <div className="w-80 border-r border-gray-200 overflow-y-auto custom-scrollbar p-6 bg-white">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Order Details</h3>
                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Client / Project</label>
                            <input type="text" value={prodSettings.clientName} onChange={e => setProdSettings({...prodSettings, clientName: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="e.g. Autumn Collection" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Order #</label>
                                <input type="text" value={prodSettings.orderNumber} onChange={e => setProdSettings({...prodSettings, orderNumber: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Currency</label>
                                <select value={prodSettings.priceCurrency} onChange={e => setProdSettings({...prodSettings, priceCurrency: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm">
                                    <option value="€">EUR (€)</option>
                                    <option value="$">USD ($)</option>
                                    <option value="£">GBP (£)</option>
                                    <option value="₹">INR (₹)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 mb-6"></div>

                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Loom Setup</h3>
                    <div className="space-y-3 mb-6">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Loom ID</label>
                                <input type="text" value={prodSettings.loomId || ''} onChange={e => setProdSettings({...prodSettings, loomId: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Loom #1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Weaver</label>
                                <input type="text" value={prodSettings.weaverName || ''} onChange={e => setProdSettings({...prodSettings, weaverName: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Speed (PPM)</label>
                                <input type="number" value={prodSettings.loomSpeed} onChange={e => setProdSettings({...prodSettings, loomSpeed: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Efficiency %</label>
                                <input type="number" max="100" value={prodSettings.efficiency} onChange={e => setProdSettings({...prodSettings, efficiency: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Labor Rate</label>
                                <input type="number" value={prodSettings.hourlyRate} onChange={e => setProdSettings({...prodSettings, hourlyRate: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Setup (Hrs)</label>
                                <input type="number" value={prodSettings.setupTime} onChange={e => setProdSettings({...prodSettings, setupTime: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 mb-6"></div>

                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Fabric Dimensions</h3>
                    <InputRow label="Finished Width" value={prodSettings.finishedWidth} onChange={v => setProdSettings({...prodSettings, finishedWidth: v})} unit="cm" />
                    <InputRow label="Finished Length" value={prodSettings.finishedLength} onChange={v => setProdSettings({...prodSettings, finishedLength: v})} unit="m" />
                    
                    <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-100">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Process Factors</h4>
                        <InputRow label="Weft Contraction" value={prodSettings.weftContraction} onChange={v => setProdSettings({...prodSettings, weftContraction: v})} unit="%" />
                        <InputRow label="Warp Take-up" value={prodSettings.warpTakeUp} onChange={v => setProdSettings({...prodSettings, warpTakeUp: v})} unit="%" />
                        <InputRow label="Warp Waste (Loom)" value={prodSettings.warpWaste} onChange={v => setProdSettings({...prodSettings, warpWaste: v})} unit="m" />
                        <InputRow label="Weft Waste" value={prodSettings.weftWaste} onChange={v => setProdSettings({...prodSettings, weftWaste: v})} unit="%" />
                        <div className="h-px bg-gray-200 my-2"></div>
                        <InputRow label="Meters per Pirn" value={prodSettings.metersPerPirn} onChange={v => setProdSettings({...prodSettings, metersPerPirn: v})} unit="m" />
                    </div>

                    <div className="h-px bg-gray-100 my-6"></div>

                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">Ticket Options</h3>
                    <div className="space-y-2">
                        {[
                            {k:'showWarpPattern', l:'Include Warp Pat.'},
                            {k:'showWeftPattern', l:'Include Weft Pat.'},
                            {k:'showDraft', l:'Include Draft'},
                            {k:'showPegPlan', l:'Include Peg Plan'},
                            {k:'showYarns', l:'Include Material List'},
                            {k:'showCosting', l:'Show Prices'},
                            {k:'showSwatch', l:'Include Image'}
                        ].map(opt => (
                            <label key={opt.k} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={(ticketConfig as any)[opt.k]} onChange={e => setTicketConfig({...ticketConfig, [opt.k]: e.target.checked})} className="rounded text-blue-600" />
                                <span className="text-sm text-gray-600">{opt.l}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* RIGHT: DASHBOARD */}
                <div className="flex-1 bg-gray-50 overflow-y-auto custom-scrollbar p-8">
                    
                    {/* KPI CARDS */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reed Width</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">{calculations.reedWidthCm.toFixed(1)} <span className="text-sm text-gray-400 font-normal">cm</span></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Warp Length</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">{calculations.totalWarpLengthM.toFixed(1)} <span className="text-sm text-gray-400 font-normal">m</span></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Weight (GSM)</span>
                            <div className="text-2xl font-bold text-blue-600 mt-1">{Math.round(calculations.gsm)} <span className="text-sm text-gray-400 font-normal">g/m²</span></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Project</span>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{prodSettings.priceCurrency}{calculations.totalProjectCost.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* BOM TABLE */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Bill of Materials</h3>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Total Weight: {calculations.totalWeightKg.toFixed(2)} kg</span>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Yarn ID</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3 text-right">Required (m)</th>
                                    <th className="px-6 py-3 text-right">Pirns/Pkg</th>
                                    <th className="px-6 py-3 text-right">Weight (kg)</th>
                                    <th className="px-6 py-3 text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {calculations.yarnRequirements.map((req, i) => (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${req.type==='warp'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{req.type}</span>
                                        </td>
                                        <td className="px-6 py-3 font-mono font-bold text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full border border-gray-200 shadow-sm" style={{backgroundColor: req.def.color}}></div>
                                                {req.id}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600 text-xs">
                                            {req.def.code || `${req.def.ply}/${req.def.count} ${req.def.countSystem}`} • {req.def.fiberType}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">{Math.ceil(req.totalMeters).toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right font-mono text-gray-600">
                                            {req.type === 'weft' ? (
                                                <span className="font-bold bg-gray-100 px-2 py-0.5 rounded">{req.packages}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono font-bold">{req.weightKg.toFixed(3)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-gray-500">{prodSettings.priceCurrency}{req.cost.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        {/* Heddle Count Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Heddle Count (Cast Out)</h3>
                            </div>
                            <div className="p-4 grid grid-cols-4 gap-2">
                                {calculations.heddleCounts.map((count, idx) => (
                                    <div key={idx} className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-100">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Shaft {idx + 1}</span>
                                        <span className="text-lg font-mono font-bold text-blue-600">{count}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-right">
                                Total Ends: <strong>{calculations.totalEnds}</strong>
                            </div>
                        </div>

                        {/* Time & Labor */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Production Time & Labor</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Setup Time</span>
                                    <span className="font-mono">{prodSettings.setupTime} hrs</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Weaving Time ({Math.round(prodSettings.loomSpeed * (prodSettings.efficiency/100))} PPM actual)</span>
                                    <span className="font-mono">{calculations.weavingHours.toFixed(1)} hrs</span>
                                </div>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <div className="flex justify-between items-center text-sm font-bold text-gray-700">
                                    <span>Total Hours</span>
                                    <span className="font-mono">{calculations.totalHours.toFixed(1)} hrs</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-blue-600">
                                    <span>Labor Cost</span>
                                    <span className="font-mono">{prodSettings.priceCurrency}{calculations.laborCost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Technical Details */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Technical Specifications</h3>
                        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm space-y-2">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Total Ends</span>
                                <span className="font-mono font-bold">{calculations.totalEnds}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Total Picks</span>
                                <span className="font-mono font-bold">{calculations.totalPicks}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">Cover Factor (Peirce)</span>
                                <span className="font-mono font-bold">{calculations.coverFactor.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-500">Linear Weight (GLM)</span>
                                <span className="font-mono font-bold">{Math.round(calculations.glm)} g/m</span>
                            </div>
                        </div>
                    </div>
                        
                    {/* Notes */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Production Notes</h3>
                        <textarea className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:border-blue-500 focus:outline-none resize-none" placeholder="Add technical notes for the loom technician..."></textarea>
                    </div>

                </div>
            </div>
        </div>
    );
};
