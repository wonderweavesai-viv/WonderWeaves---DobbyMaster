
import React, { useRef, useEffect } from 'react';
import { WarpBeam } from '../types';

interface MultiBeamDraftProps {
    draft: boolean[][]; // Global draft
    beams: WarpBeam[];
    beamSequence: number[]; // Which beam owns which column index (0-based)
    onCellClick: (harnessIndex: number, warpIndex: number) => void;
    gridDivision: number;
    activeHarnesses?: Set<number>;
}

export const MultiBeamDraft: React.FC<MultiBeamDraftProps> = ({
    draft, beams, beamSequence, onCellClick, gridDivision
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const CELL_SIZE = 20;
    const HEADER_HEIGHT = 24;
    const GAP_BETWEEN_BEAMS = 10;

    // Calculate dimensions
    const totalWarpEnds = draft[0]?.length || 0;
    
    // Calculate total height needed based on beams
    const totalHeight = beams.reduce((acc, beam) => {
        return acc + (beam.harnesses.length * CELL_SIZE) + HEADER_HEIGHT + GAP_BETWEEN_BEAMS;
    }, 0);

    const width = Math.max(100, totalWarpEnds * CELL_SIZE);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#111827'; // Dark bg
        ctx.fillRect(0, 0, width, totalHeight);

        let currentY = 0;

        beams.forEach((beam, beamIndex) => {
            // Draw Header
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(0, currentY, width, HEADER_HEIGHT);
            
            ctx.fillStyle = beam.color;
            ctx.fillRect(0, currentY, 4, HEADER_HEIGHT);
            
            ctx.fillStyle = '#e5e7eb';
            ctx.font = '10px monospace';
            ctx.fillText(beam.name.toUpperCase(), 10, currentY + 16);
            ctx.fillStyle = '#9ca3af';
            ctx.fillText(`Shafts: ${Math.min(...beam.harnesses) + 1}-${Math.max(...beam.harnesses) + 1}`, 100, currentY + 16);

            const gridTop = currentY + HEADER_HEIGHT;
            
            // Draw Grid
            beam.harnesses.forEach((globalHarnessIndex, localRowIndex) => {
                const y = gridTop + (localRowIndex * CELL_SIZE);
                
                for (let x = 0; x < totalWarpEnds; x++) {
                    const cx = x * CELL_SIZE;
                    
                    // Is this column owned by this beam?
                    const ownerBeamIndex = beamSequence[x % beamSequence.length];
                    const isOwner = ownerBeamIndex === beamIndex;

                    if (!isOwner) {
                        // Disabled Cell
                        ctx.fillStyle = '#1f2937'; // Slightly lighter than bg
                        ctx.fillRect(cx, y, CELL_SIZE, CELL_SIZE);
                        // Hatching
                        ctx.strokeStyle = '#374151';
                        ctx.beginPath();
                        ctx.moveTo(cx, y); ctx.lineTo(cx+CELL_SIZE, y+CELL_SIZE);
                        ctx.stroke();
                    } else {
                        // Active Cell Area
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(cx, y, CELL_SIZE, CELL_SIZE);
                        
                        // Check if marked
                        if (draft[globalHarnessIndex] && draft[globalHarnessIndex][x]) {
                            ctx.fillStyle = '#000000';
                            ctx.fillRect(cx + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                        }
                    }

                    // Grid Lines
                    ctx.strokeStyle = '#e5e7eb';
                    ctx.lineWidth = 1;
                    if (x % gridDivision === 0) ctx.lineWidth = 2;
                    ctx.strokeRect(cx, y, CELL_SIZE, CELL_SIZE);
                }
            });

            currentY += HEADER_HEIGHT + (beam.harnesses.length * CELL_SIZE) + GAP_BETWEEN_BEAMS;
        });

    }, [draft, beams, beamSequence, width, totalHeight, gridDivision]);

    const handleClick = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / CELL_SIZE);
        if (col < 0 || col >= totalWarpEnds) return;

        let currentY = 0;
        
        // Find which beam/harness was clicked
        for(const beam of beams) {
            const headerH = HEADER_HEIGHT;
            const gridH = beam.harnesses.length * CELL_SIZE;
            
            const relativeY = y - currentY - headerH;
            
            if (relativeY >= 0 && relativeY < gridH) {
                // Inside Grid
                const row = Math.floor(relativeY / CELL_SIZE);
                const globalHarness = beam.harnesses[row];
                
                // Only allow click if this beam owns this column
                const ownerBeamIndex = beamSequence[col % beamSequence.length];
                const myIndex = beams.findIndex(b => b.id === beam.id); // Simple index check assuming order
                
                // Check if current beam is the owner
                if (ownerBeamIndex === myIndex) {
                    onCellClick(globalHarness, col);
                }
                return;
            }
            
            currentY += headerH + gridH + GAP_BETWEEN_BEAMS;
        }
    };

    return (
        <div ref={containerRef} className="overflow-auto custom-scrollbar bg-gray-900 border border-gray-700 rounded-lg">
            <canvas 
                ref={canvasRef}
                width={width}
                height={totalHeight}
                onClick={handleClick}
                className="cursor-pointer block"
            />
        </div>
    );
};
