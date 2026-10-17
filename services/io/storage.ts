import { WeaveProjectFile, ShadeCard, YarnDefinition } from '../../types';
import { Workspace, buildPaletteFile } from '../workspace/workspace';
import { PaletteFile } from '../workspace/formats';

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

    // --- PALETTE MANAGEMENT (files in the workspace folder) ---
    savePalette: async (card: ShadeCard) => {
        const items = await Workspace.list('palette');
        const existing = items.find(i => i.meta.id === card.id);
        const file = buildPaletteFile(card, existing ? { created: existing.meta.created, tags: existing.meta.tags } : {});
        await Workspace.save('palette', file, existing?.filename);
    },

    getAllPalettes: async (): Promise<ShadeCard[]> => {
        const items = await Workspace.list('palette');
        const files = await Promise.all(items.map(i => Workspace.load<PaletteFile>('palette', i.filename).catch(() => null)));
        return files.filter((f): f is PaletteFile => !!f).map(f => f.palette);
    },

    deletePalette: async (id: string) => {
        const items = await Workspace.list('palette');
        const existing = items.find(i => i.meta.id === id);
        if (existing) await Workspace.remove('palette', existing.filename);
    },

    // --- OLDER STORAGE (browser database), kept only so it can be moved into files ---
    hasLegacyData: async (): Promise<boolean> => {
        try {
            if (typeof indexedDB === 'undefined') return false;
            const db = await openDB();
            const count = (store: string) => new Promise<number>(res => {
                const r = db.transaction(store, 'readonly').objectStore(store).count();
                r.onsuccess = () => res(r.result); r.onerror = () => res(0);
            });
            const total = (await count('projects')) + (await count('palettes'));
            let yarns = 0;
            try { yarns = JSON.parse(localStorage.getItem('wonderweaves_custom_yarns') || '[]').length; } catch { /* none */ }
            return total + yarns > 0;
        } catch { return false; }
    },

    readLegacy: async (): Promise<{
        projects: { project: WeaveProjectFile; thumbnail?: string }[];
        palettes: ShadeCard[];
        yarns: { name: string; def: YarnDefinition }[];
    }> => {
        const db = await openDB();
        const all = (store: string) => new Promise<any[]>((res, rej) => {
            const r = db.transaction(store, 'readonly').objectStore(store).getAll();
            r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
        const projects = (await all('projects')).map(p => ({ project: p as WeaveProjectFile, thumbnail: p.thumbnail as string | undefined }));
        const palettes = (await all('palettes')) as ShadeCard[];
        let yarns: { name: string; def: YarnDefinition }[] = [];
        try { yarns = JSON.parse(localStorage.getItem('wonderweaves_custom_yarns') || '[]'); } catch { /* none */ }
        // Skip anything that is already in the workspace so running this twice does not duplicate.
        const have = {
            design: new Set((await Workspace.list('design')).map(i => i.meta.id)),
            palette: new Set((await Workspace.list('palette')).map(i => i.meta.id)),
            yarn: new Set((await Workspace.list('yarn')).map(i => i.meta.name)),
        };
        return {
            projects: projects.filter(p => !have.design.has(p.project.id as string)),
            palettes: palettes.filter(c => !have.palette.has(c.id)),
            yarns: yarns.filter(y => !have.yarn.has(y.name)),
        };
    }
};
