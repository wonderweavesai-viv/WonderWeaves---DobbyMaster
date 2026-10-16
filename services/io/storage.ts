import { WeaveProjectFile, ShadeCard } from '../../types';

const DB_NAME = 'WonderWeavesDB';
const DB_VERSION = 2; // Incremented for palettes store

// Added missing export for StoredProjectSummary interface to fix the import error in ProjectManagerModal.tsx
export interface StoredProjectSummary {
    id: string;
    name: string;
    modified: number;
    preview: string;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('projects')) {
                db.createObjectStore('projects', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('yarns')) {
                db.createObjectStore('yarns', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('palettes')) {
                db.createObjectStore('palettes', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const StorageService = {
    saveProject: async (project: WeaveProjectFile, thumbnail: string) => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const id = project.id || Date.now().toString();
            const record = { ...project, id, thumbnail, timestamp: Date.now() }; 
            store.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // Updated return type to Promise<StoredProjectSummary[]> to fix typing in consumers
    getAllProjects: async (): Promise<StoredProjectSummary[]> => {
        const db = await openDB();
        return new Promise<StoredProjectSummary[]>((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.getAll();
            request.onsuccess = () => {
                const results: StoredProjectSummary[] = request.result.map((item: any) => ({
                    id: item.id,
                    name: item.name || 'Untitled Weave',
                    modified: item.timestamp,
                    preview: item.thumbnail
                }));
                results.sort((a, b) => b.modified - a.modified);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    loadProject: async (id: string): Promise<WeaveProjectFile> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result as WeaveProjectFile);
            request.onerror = () => reject(request.error);
        });
    },

    deleteProject: async (id: string) => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // --- PALETTE MANAGEMENT ---
    savePalette: async (card: ShadeCard) => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('palettes', 'readwrite');
            const store = tx.objectStore('palettes');
            store.put(card);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    getAllPalettes: async (): Promise<ShadeCard[]> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('palettes', 'readonly');
            const store = tx.objectStore('palettes');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    deletePalette: async (id: string) => {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction('palettes', 'readwrite');
            const store = tx.objectStore('palettes');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};