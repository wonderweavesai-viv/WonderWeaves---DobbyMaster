
import React, { useEffect, useState } from 'react';
import { StorageService, StoredProjectSummary } from '../services/io/storage';
import { TrashIcon, UploadIcon, HomeIcon } from './icons';

interface ProjectManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProject: (id: string) => void;
    onImport: () => void; // Trigger existing file input
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ 
    isOpen, onClose, onLoadProject, onImport 
}) => {
    const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) loadList();
    }, [isOpen]);

    const loadList = async () => {
        setLoading(true);
        try {
            const list = await StorageService.getAllProjects();
            setProjects(list);
        } catch (e) {
            console.error("Failed to load projects", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
            await StorageService.deleteProject(id);
            loadList();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-gray-900/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden font-sans text-gray-900">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Design Studio</h2>
                        <p className="text-gray-500 text-sm">Your local library of weaves.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onImport} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors">
                            <UploadIcon className="w-4 h-4" /> Import File (.weave)
                        </button>
                        <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-500 text-sm transition-colors">
                            Start New / Close
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-100 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">Loading library...</div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                                <HomeIcon className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="font-medium">No saved projects found in this browser.</p>
                            <p className="text-sm max-w-xs text-center">Projects are saved to your browser's local storage database.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {projects.map(p => (
                                <div 
                                    key={p.id} 
                                    onClick={() => { onLoadProject(p.id); onClose(); }}
                                    className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-blue-500 transition-all cursor-pointer overflow-hidden flex flex-col h-64"
                                >
                                    <div className="flex-1 bg-gray-100 relative overflow-hidden">
                                        {p.preview ? (
                                            <img src={p.preview} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase font-bold tracking-widest">No Preview</div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                    </div>
                                    <div className="p-4 h-20 flex flex-col justify-between shrink-0 bg-white relative">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm truncate" title={p.name}>{p.name}</h3>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">{new Date(p.modified).toLocaleDateString()}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDelete(e, p.id)}
                                            className="absolute bottom-3 right-3 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Project"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
