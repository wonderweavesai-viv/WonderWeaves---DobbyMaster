import React, { useRef, useEffect } from 'react';
import { DensityZone } from '../types';

interface InteractiveGridProps {
  data: (boolean | string)[][]; // The source Unit
  onCellClick?: (row: number, col: number) => void;
  onCellInteraction?: (row: number, col: number, type: 'down' | 'enter' | 'up') => void;
  isColorGrid?: boolean;
  activeColor?: string;
  cursorRow?: number | null;
  cursorCol?: number | null;
  pulseCursor?: boolean; // Blinking state for keyboard mode
  guideRow?: number | null; // Subtle highlight for cross-grid tracking
  guideCol?: number | null; // Subtle highlight for cross-grid tracking
  selectionRect?: [number, number, number, number] | null; // [startR, startC, endR, endC]
  previewShape?: { type: 'line' | 'rect' | 'circle', startR: number, startC: number, endR: number, endC: number } | null;
  gridDivision?: number;
  repeatRows?: number; 
  repeatCols?: number; 
  renderRows?: number; 
  renderCols?: number; 
  width?: number; 
  height?: number; 
  className?: string; 
  allowInteraction?: boolean; 
  showGrid?: boolean; 
  showNumbers?: boolean;
  extraRows?: boolean[]; // Map of rows that are "Extra Weft"
  extraCols?: boolean[]; // Map of cols that are "Extra Warp"
  rowZones?: DensityZone[]; // Variable density zones for rows
  numberingDirection?: 'row' | 'col';
}

export const InteractiveGrid: React.FC<InteractiveGridProps> = ({
  data,
  onCellClick,
  onCellInteraction,
  isColorGrid = false,
  activeColor = "#3B82F6",
  cursorRow = null,
  cursorCol = null,
  pulseCursor = false,
  guideRow = null,
  guideCol = null,
  selectionRect = null,
  previewShape = null,
  gridDivision = 8,
  repeatRows = 99999,
  repeatCols = 99999,
  renderRows,
  renderCols,
  width,
  height,
  className = "",
  allowInteraction = true,
  showGrid = true,
  showNumbers = false,
  extraRows,
  extraCols,
  rowZones = [],
  numberingDirection = 'row'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sourceRows = data ? data.length : 0;
  const sourceCols = sourceRows > 0 && data[0] ? data[0].length : 0;
  
  const targetRows = renderRows || sourceRows;
  const targetCols = renderCols || sourceCols;
  
  const canvasWidth = width || Math.max(1, targetCols * 20);
  const canvasHeight = height || Math.max(1, targetRows * 20);

  const cellW = targetCols > 0 ? canvasWidth / targetCols : 0;
  const cellH = targetRows > 0 ? canvasHeight / targetRows : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (sourceRows > 0 && sourceCols > 0 && targetRows > 0 && targetCols > 0) {
        ctx.font = `bold ${Math.min(cellW, cellH) * 0.5}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let r = 0; r < targetRows; r++) {
            const srcR = r % sourceRows;
            const y = Math.floor(r * cellH);
            const h = Math.ceil(cellH);
            const isExtraRow = extraRows ? extraRows[srcR] : false;
            
            // Density Zone Row Background Tint
            const zone = rowZones.find(z => srcR >= z.startPick && srcR <= z.endPick);
            if (zone) {
                ctx.fillStyle = zone.color + '15'; // ~8% opacity tint
                ctx.fillRect(0, y, canvasWidth, h);
            }

            for (let c = 0; c < targetCols; c++) {
                const srcC = c % sourceCols;
                const x = Math.floor(c * cellW);
                const w = Math.ceil(cellW);
                const isExtraCol = extraCols ? extraCols[srcC] : false;
                const isExtra = !isColorGrid && (isExtraRow || isExtraCol);

                // Draw background tint for extra threads
                if (isExtra) {
                    ctx.fillStyle = '#f3f4f6'; 
                    ctx.fillRect(x, y, w, h);
                }

                const rowData = data[srcR];
                const val = rowData ? rowData[srcC] : undefined;

                let fill = null;
                if (isColorGrid) {
                    fill = val as string;
                } else if (val) {
                    if (isExtra) {
                        fill = '#4b5563'; 
                    } else {
                        fill = activeColor === '#3B82F6' ? '#111827' : activeColor;
                    }
                }

                if (fill && fill !== 'transparent') {
                    ctx.fillStyle = fill;
                    ctx.fillRect(x, y, w, h);
                }

                // Numbers Overlay
                if (showNumbers && !isColorGrid && cellW > 12) {
                    ctx.fillStyle = val ? '#ffffff' : '#e2e8f0';
                    if (isExtra && !val) ctx.fillStyle = '#d1d5db';
                    const label = numberingDirection === 'col' ? `${srcC + 1}` : `${srcR + 1}`;
                    ctx.fillText(label, x + w/2, y + h/2);
                }
            }

            // Draw Density Indicator Bar on the far right
            if (zone && cellW > 0) {
                ctx.fillStyle = zone.color;
                ctx.fillRect(canvasWidth - 4, y, 4, h);
            }
        }
    }

    // Preview Shape (Advanced Drawing)
    if (previewShape && !isColorGrid) {
        ctx.fillStyle = activeColor + '80'; // 50% opacity
        const { type, startR, startC, endR, endC } = previewShape;
        
        if (type === 'rect') {
            const minR = Math.min(startR, endR);
            const maxR = Math.max(startR, endR);
            const minC = Math.min(startC, endC);
            const maxC = Math.max(startC, endC);
            ctx.fillRect(minC * cellW, minR * cellH, (maxC - minC + 1) * cellW, (maxR - minR + 1) * cellH);
        } else if (type === 'line') {
            // Simplified line preview ( Bresenham-like dots)
            let r0 = startR, c0 = startC, r1 = endR, c1 = endC;
            let dr = Math.abs(r1 - r0), dc = -Math.abs(c1 - c0);
            let sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
            let err = dr + dc;
            while (true) {
                ctx.fillRect(c0 * cellW, r0 * cellH, cellW, cellH);
                if (r0 === r1 && c0 === c1) break;
                let e2 = 2 * err;
                if (e2 >= dc) { err += dc; r0 += sr; }
                if (e2 <= dr) { err += dr; c0 += sc; }
            }
        } else if (type === 'circle') {
            const centerR = startR, centerC = startC;
            const radius = Math.sqrt(Math.pow(endR - startR, 2) + Math.pow(endC - startC, 2));
            for (let r = Math.floor(centerR - radius); r <= Math.ceil(centerR + radius); r++) {
                for (let c = Math.floor(centerC - radius); c <= Math.ceil(centerC + radius); c++) {
                    if (r < 0 || r >= targetRows || c < 0 || c >= targetCols) continue;
                    const d = Math.sqrt(Math.pow(r - centerR, 2) + Math.pow(c - centerC, 2));
                    if (Math.abs(d - radius) < 1) {
                         ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
                    }
                }
            }
        }
    }

    // Selection Rect - High Intensity Bright Blue Outline
    if (selectionRect && !isColorGrid) {
        const [r1, c1, r2, c2] = selectionRect;
        const minR = Math.min(r1, r2);
        const maxR = Math.max(r1, r2);
        const minC = Math.min(c1, c2);
        const maxC = Math.max(c1, c2);
        
        const sx = Math.floor(minC * cellW);
        const sy = Math.floor(minR * cellH);
        const sw = Math.ceil((maxC - minC + 1) * cellW);
        const sh = Math.ceil((maxR - minR + 1) * cellH);

        // Fill color
        ctx.fillStyle = 'rgba(0, 112, 243, 0.15)';
        ctx.fillRect(sx, sy, sw, sh);
        
        // Glow effect
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 112, 243, 0.6)';
        ctx.strokeStyle = '#0070f3'; // Vivid Electric Blue
        ctx.lineWidth = 3;
        ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
        
        // Inner detail line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);
        ctx.restore();
    }

    // Guide Highlighting
    if ((guideRow !== null || guideCol !== null)) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        if (guideRow !== null) {
            ctx.fillRect(0, Math.floor(guideRow * cellH), canvasWidth, Math.ceil(cellH));
        }
        if (guideCol !== null) {
            ctx.fillRect(Math.floor(guideCol * cellW), 0, Math.ceil(cellW), canvasHeight);
        }
    }

    // Cursor Highlighting
    if ((cursorRow !== null && cursorCol !== null)) {
        const cx = Math.floor(cursorCol * cellW);
        const cy = Math.floor(cursorRow * cellH);
        const cw = Math.ceil(cellW);
        const ch = Math.ceil(cellH);

        if (pulseCursor) {
            ctx.save();
            ctx.fillStyle = '#3b82f6';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(cx, cy, cw, ch);
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3);
            ctx.restore();
        } else {
            ctx.save();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
            ctx.fillRect(cx, cy, cw, ch);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
            ctx.restore();
        }
    }

    if (showGrid && targetCols > 0 && targetRows > 0) {
        const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
            ctx.beginPath();
            ctx.moveTo(x1 + (width%2 === 1 ? 0.5 : 0), y1);
            ctx.lineTo(x2 + (width%2 === 1 ? 0.5 : 0), y2);
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.stroke();
        };

        const baseColor = '#e2e8f0'; 
        const divColor = '#94a3b8';
        const redColor = '#f87171';
        
        for (let c = 1; c <= targetCols; c++) { 
            const isRepeat = c % repeatCols === 0;
            const isDiv = c % gridDivision === 0;
            const x = Math.floor(c * cellW);
            let color = baseColor;
            let width = 1;
            if (isRepeat) { color = redColor; width = 2; } 
            else if (isDiv) { color = divColor; width = 1.5; }
            drawLine(x, 0, x, canvasHeight, color, width);
        }

        for (let r = 1; r <= targetRows; r++) {
            const isRepeat = r % repeatRows === 0;
            const isDiv = r % gridDivision === 0;
            const y = Math.floor(r * cellH);
            let color = baseColor;
            let width = 1;
            if (isRepeat) { color = redColor; width = 2; } 
            else if (isDiv) { color = divColor; width = 1.5; }
            drawLine(0, y, canvasWidth, y, color, width);
        }
    }

  }, [data, sourceRows, sourceCols, targetRows, targetCols, cellW, cellH, canvasWidth, canvasHeight, isColorGrid, activeColor, cursorRow, cursorCol, pulseCursor, guideRow, guideCol, selectionRect, previewShape, gridDivision, repeatRows, repeatCols, showGrid, showNumbers, extraRows, extraCols, rowZones, allowInteraction, numberingDirection]);

  const handleInteract = (e: React.MouseEvent, type: 'down' | 'enter' | 'up') => {
      if (!allowInteraction) return;
      if (e.button === 2) return; // Right click ignored for standard drawing

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      if (cellW <= 0 || cellH <= 0) return;
      const col = Math.floor(x / cellW);
      const row = Math.floor(y / cellH);
      if (col < 0 || col >= targetCols || row < 0 || row >= targetRows) return;
      
      if (type === 'down') {
          e.stopPropagation();
          onCellInteraction?.(row, col, 'down');
          onCellClick?.(row, col);
      } else if (type === 'enter') {
          onCellInteraction?.(row, col, 'enter');
      } else if (type === 'up') {
          onCellInteraction?.(row, col, 'up');
      }
  };

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className={`${className} block bg-white outline-none`}
      style={{ width: canvasWidth, height: canvasHeight }}
      onMouseDown={(e) => handleInteract(e, 'down')}
      onMouseMove={(e) => handleInteract(e, 'enter')}
      onMouseUp={(e) => handleInteract(e, 'up')}
      onMouseLeave={() => allowInteraction && onCellInteraction?.(0,0,'up')}
      onContextMenu={(e) => {
          if (!allowInteraction) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const col = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / cellW);
          const row = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / cellH);
          onCellInteraction?.(row, col, 'up'); // Stop any dragging
      }}
    />
  );
};