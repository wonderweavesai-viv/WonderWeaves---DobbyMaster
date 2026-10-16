
import React from 'react';

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    separator?: boolean;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
    onItemClick: (id: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose, onItemClick }) => {
    return (
        <>
            <div className="fixed inset-0 z-[1000]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div 
                className="fixed z-[1001] bg-white border border-gray-200 rounded-lg shadow-2xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100 font-sans"
                style={{ left: x, top: y }}
                onContextMenu={(e) => e.preventDefault()}
            >
                {items.map((item, i) => (
                    <React.Fragment key={item.id + i}>
                        {item.separator && <div className="h-px bg-gray-100 my-1 mx-1" />}
                        <button
                            onClick={() => { onItemClick(item.id); onClose(); }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-3 text-xs font-bold transition-colors ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
                        >
                            {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
                            <span>{item.label}</span>
                        </button>
                    </React.Fragment>
                ))}
            </div>
        </>
    );
};
