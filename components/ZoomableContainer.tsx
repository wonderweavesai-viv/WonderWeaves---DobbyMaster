import React, { useState, useRef, WheelEvent, MouseEvent } from 'react';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon } from './icons';

interface ZoomableContainerProps {
  children: React.ReactNode;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

export const ZoomableContainer: React.FC<ZoomableContainerProps> = ({ children }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.005;
    const newScale = Math.min(Math.max(scale + delta, MIN_SCALE), MAX_SCALE);
    
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
        const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);
        
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    }
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    e.preventDefault();
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPanning(false);
  };
  
  const handleZoom = (direction: 'in' | 'out') => {
      const zoomFactor = 1.25;
      const newScale = direction === 'in' ? scale * zoomFactor : scale / zoomFactor;
      setScale(Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE));
      // Note: This button-based zoom doesn't center on mouse, it centers on view.
  }

  const resetZoom = () => {
      setScale(1);
      setOffset({ x: 0, y: 0 });
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab overflow-hidden relative"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Stop panning if mouse leaves container
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      <div
        className="transition-transform duration-75"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 bg-gray-900/70 p-1 rounded-md border border-gray-700">
        <button onClick={() => handleZoom('in')} title="Zoom In" className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ZoomInIcon className="w-5 h-5"/></button>
        <button onClick={() => handleZoom('out')} title="Zoom Out" className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ZoomOutIcon className="w-5 h-5"/></button>
        <button onClick={resetZoom} title="Reset Zoom" className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded"><ResetZoomIcon className="w-5 h-5"/></button>
      </div>
    </div>
  );
};
