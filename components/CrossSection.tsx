
import React, { useEffect, useRef } from 'react';

interface CrossSectionProps {
    orientation: 'horizontal' | 'vertical';
    structure: boolean[]; // Array of booleans representing Over/Under (True=Warp Up)
    yarnColors: string[]; // Colors of the stationary threads (Circles)
    activeThreadColor: string; // Color of the weaving thread (Line)
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    renderCount: number; // Number of items to render
}

export const CrossSection: React.FC<CrossSectionProps> = ({
    orientation, structure, yarnColors, activeThreadColor, width, height, cellWidth, cellHeight, renderCount
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, width, height);
        
        // Settings
        const threadRadius = Math.min(cellWidth, cellHeight) * 0.35;
        const waveAmplitude = orientation === 'horizontal' ? height * 0.3 : width * 0.3;
        const centerY = height / 2;
        const centerX = width / 2;

        const pathPoints: {x: number, y: number}[] = [];

        // 1. Draw Stationary Threads (Circles)
        for(let i=0; i<renderCount; i++) {
            const isActive = structure[i % structure.length];
            const color = yarnColors[i % yarnColors.length];
            
            ctx.fillStyle = color;
            ctx.beginPath();
            
            let cx, cy;
            
            if (orientation === 'horizontal') {
                // Top View: Stationary Warp Ends
                cx = (i * cellWidth) + (cellWidth / 2);
                cy = centerY;
                
                // Calculate Weft Path Point
                // If Warp Up (active=true), Weft is Down (Under)
                // If Warp Down (active=false), Weft is Up (Over)
                const py = isActive ? centerY + waveAmplitude : centerY - waveAmplitude;
                pathPoints.push({ x: cx, y: py });

            } else {
                // Side View: Stationary Weft Picks
                cx = centerX;
                cy = (i * cellHeight) + (cellHeight / 2);
                
                // Calculate Warp Path Point
                // If Warp Up (active=true), Warp is Left/Top (Over)
                // If Warp Down (active=false), Warp is Right/Bottom (Under)
                // Let's assume Left is Over
                const px = isActive ? centerX - waveAmplitude : centerX + waveAmplitude;
                pathPoints.push({ x: px, y: cy });
            }

            ctx.arc(cx, cy, threadRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Add subtle shadow/stroke for definition
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 2. Draw Active Thread (The Path)
        if (pathPoints.length > 0) {
            ctx.strokeStyle = activeThreadColor;
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            
            // Start slightly before first point
            if (orientation === 'horizontal') {
                 ctx.moveTo(pathPoints[0].x - cellWidth/2, pathPoints[0].y);
            } else {
                 ctx.moveTo(pathPoints[0].x, pathPoints[0].y - cellHeight/2);
            }
            
            // Simple curve fitting
            for (let i = 0; i < pathPoints.length; i++) {
                 const curr = pathPoints[i];
                 const next = pathPoints[i+1];
                 if (next) {
                     const midX = (curr.x + next.x) / 2;
                     const midY = (curr.y + next.y) / 2;
                     
                     // Direct line or curve?
                     // Standard cross section diagrams usually show sinusoidal waves
                     // For simplicity, lineTo center of circles
                     ctx.lineTo(curr.x, curr.y);
                     ctx.lineTo(midX, midY); // Interpolate for smoothness
                 } else {
                     ctx.lineTo(curr.x, curr.y);
                 }
            }
             // Extend slightly after last
            const last = pathPoints[pathPoints.length-1];
             if (orientation === 'horizontal') {
                 ctx.lineTo(last.x + cellWidth/2, last.y);
            } else {
                 ctx.lineTo(last.x, last.y + cellHeight/2);
            }

            ctx.stroke();
            
            // Active Thread Highlight/Sheen
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

    }, [orientation, structure, yarnColors, activeThreadColor, width, height, cellWidth, cellHeight, renderCount]);

    return (
        <canvas ref={canvasRef} width={width} height={height} className="block" />
    );
};
