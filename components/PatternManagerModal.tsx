
import React from 'react';
import { PatternManager, PatternManagerProps } from './PatternManager';

interface PatternManagerModalProps extends PatternManagerProps {
    isOpen: boolean;
}

export const PatternManagerModal: React.FC<PatternManagerModalProps> = (props) => {
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-6">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] h-auto flex flex-col overflow-hidden border border-gray-400 font-sans text-gray-900 transition-all">
                <PatternManager {...props} className="h-full w-full border-none" />
            </div>
        </div>
    );
};
