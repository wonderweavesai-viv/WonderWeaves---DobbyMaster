import React, { useEffect, useRef } from 'react';
import { LibraryWeave } from '../services/weaveLibrary';

export const WeaveThumbnail: React.FC<{ weave: LibraryWeave, className?: string }> = ({ weave, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { draft, pegPlan } = weave;
    const harnesses = draft.length;
    const width = draft[0].length;
    const height = pegPlan.length;

    // Scale logic
    const scale = Math.min(12, Math.floor(120 / Math.max(width, height)));
    
    canvas.width = width * scale;
    canvas.height = height * scale;

    ctx.fillStyle = '#111827'; // Dark bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const warpToHarness = new Array(width).fill(-1);
    for(let w=0; w<width; w++) {
        for(let h=0; h<harnesses; h++) {
            if(draft[h][w] === 1) {
                warpToHarness[w] = h;
                break;
            }
        }
    }

    for(let y=0; y<height; y++) {
        for(let x=0; x<width; x++) {
            const harness = warpToHarness[x];
            let isWarpUp = false;
            if(harness !== -1 && pegPlan[y] && pegPlan[y][harness] === 1) {
                isWarpUp = true;
            }

            if (isWarpUp) {
                ctx.fillStyle = '#E5E7EB'; // Gray-200
                ctx.fillRect(x*scale, y*scale, scale, scale);
            }
        }
    }

  }, [weave]);

  return (
    <div className={`bg-gray-950 rounded border border-gray-800 flex items-center justify-center overflow-hidden ${className}`}>
        <canvas ref={canvasRef} className="image-pixelated" />
    </div>
  );
};