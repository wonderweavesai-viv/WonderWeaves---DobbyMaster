
import React from 'react';
import { TrashIcon, InvertIcon, ShiftUpIcon, ShiftDownIcon, ShiftLeftIcon, ShiftRightIcon, CopyIcon } from './icons';

interface GridToolbarProps {
  onClear: () => void;
  onInvert: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onShiftLeft: () => void;
  onShiftRight: () => void;
  onDouble: () => void;
}

const ToolButton: React.FC<{ onClick: () => void; children: React.ReactNode; label: string }> = ({ onClick, children, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
  >
    {children}
  </button>
);

export const GridToolbar: React.FC<GridToolbarProps> = ({
  onClear, onInvert, onShiftUp, onShiftDown, onShiftLeft, onShiftRight, onDouble
}) => {
  const iconClass = "w-5 h-5";
  return (
    <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-md border border-gray-700">
      <ToolButton onClick={onClear} label="Clear grid"><TrashIcon className={iconClass} /></ToolButton>
      <ToolButton onClick={onInvert} label="Invert grid"><InvertIcon className={iconClass} /></ToolButton>
      <div className="w-px h-5 bg-gray-700 mx-1" />
      <ToolButton onClick={onShiftUp} label="Shift up"><ShiftUpIcon className={iconClass} /></ToolButton>
      <ToolButton onClick={onShiftDown} label="Shift down"><ShiftDownIcon className={iconClass} /></ToolButton>
      <ToolButton onClick={onShiftLeft} label="Shift left"><ShiftLeftIcon className={iconClass} /></ToolButton>
      <ToolButton onClick={onShiftRight} label="Shift right"><ShiftRightIcon className={iconClass} /></ToolButton>
      <div className="w-px h-5 bg-gray-700 mx-1" />
      <ToolButton onClick={onDouble} label="Double / Duplicate"><CopyIcon className={iconClass} /></ToolButton>
    </div>
  );
};
