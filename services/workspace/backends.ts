import { ItemKind, EXT, FOLDER, KINDS } from './formats';

export interface FileEntry {
  filename: string; // e.g. "Navy herringbone.wwdesign"
  modified: number; // ms since epoch
  size: number;
}

export interface ImportedFile {
  name: string;
  text: string;
}

/** One implementation per platform. The rest of the app only talks to this. */
export interface FileBackend {
  id: 'electron' | 'android' | 'browser';
  /** Short description shown in the UI, e.g. "Folder on this computer". */
  describe(): string;
  /** True when the user can point the app at any folder (including network drives). */
  canChooseFolder: boolean;
  /** True when the OS can show a file in its file manager. */
  canReveal: boolean;
  init(): Promise<void>;
  getRoot(): Promise<string>;
  chooseRoot(): Promise<string | null>;
  list(kind: ItemKind): Promise<FileEntry[]>;
  read(kind: ItemKind, filename: string): Promise<string>;
  write(kind: ItemKind, filename: string, text: string): Promise<void>;
  remove(kind: ItemKind, filename: string): Promise<void>;
  exists(kind: ItemKind, filename: string): Promise<boolean>;
  reveal(kind: ItemKind, filename: string): Promise<void>;
  pickFiles(): Promise<ImportedFile[]>;
  exportFile(suggestedName: string, text: string): Promise<boolean>;
  /** Files the OS asked the app to open (double-click on a .wwdesign). Returns an unsubscribe function. */
  onOpenFile(cb: (file: ImportedFile) => void): () => void;
}

const ACCEPT = KINDS.map(k => EXT[k]).concat(['.weave', '.json']).join(',');

/** Browser file picker used by the browser and Android backends. */
const pickWithInput = (): Promise<ImportedFile[]> =>
  new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPT;
    input.style.display = 'none';
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      const files = Array.from(input.files || []);
      const out: ImportedFile[] = [];
      for (const f of files) out.push({ name: f.name, text: await f.text() });
      input.remove();
      resolve(out);
    };
    input.addEventListener('change', finish);
    input.addEventListener('cancel', () => { if (!done) { done = true; input.remove(); resolve([]); } });
    document.body.appendChild(input);
    input.click();
  });

/* ------------------------------------------------------------------ */
/* Electron (Windows and Mac): real folders, including network drives. */
/* ------------------------------------------------------------------ */

interface WwFsBridge {
  getRoot(): Promise<string>;
  chooseRoot(): Promise<string | null>;
  list(folder: string): Promise<FileEntry[]>;
  read(folder: string, filename: string): Promise<string>;
  write(folder: string, filename: string, text: string): Promise<void>;
  remove(folder: string, filename: string): Promise<void>;
  exists(folder: string, filename: string): Promise<boolean>;
  reveal(folder: string, filename: string): Promise<void>;
  saveAs(suggestedName: string, text: string): Promise<boolean>;
  onOpenFile(cb: (file: ImportedFile) => void): () => void;
}

export const hasElectronBridge = (): boolean => !!(window as any).wwFS;

export const electronBackend = (): FileBackend => {
  const fs = (): WwFsBridge => (window as any).wwFS;
  return {
    id: 'electron',
    describe: () => 'Folder on this computer or network',
    canChooseFolder: true,
    canReveal: true,
    init: async () => { await fs().getRoot(); },
    getRoot: () => fs().getRoot(),
    chooseRoot: () => fs().chooseRoot(),
    list: kind => fs().list(FOLDER[kind]),
    read: (kind, f) => fs().read(FOLDER[kind], f),
    write: (kind, f, t) => fs().write(FOLDER[kind], f, t),
    remove: (kind, f) => fs().remove(FOLDER[kind], f),
    exists: (kind, f) => fs().exists(FOLDER[kind], f),
    reveal: (kind, f) => fs().reveal(FOLDER[kind], f),
    pickFiles: pickWithInput,
    exportFile: (name, text) => fs().saveAs(name, text),
    onOpenFile: cb => fs().onOpenFile(cb),
  };
};

/* ------------------------------------------------------------------ */
/* Android tablet: Documents/WonderWeaves, import/export via the system */
/* file picker and share sheet (these reach Google Drive).             */
/* ------------------------------------------------------------------ */

export const isAndroidApp = (): boolean => {
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
};

export const androidBackend = (): FileBackend => {
  const BASE = 'WonderWeaves';
  const mods = async () => {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    return { Filesystem, Directory, Encoding, Share };
  };
  const dirOf = (kind: ItemKind) => `${BASE}/${FOLDER[kind]}`;
  return {
    id: 'android',
    describe: () => 'Documents/WonderWeaves on this tablet',
    canChooseFolder: false,
    canReveal: false,
    init: async () => {
      const { Filesystem, Directory } = await mods();
      for (const k of KINDS) {
        try { await Filesystem.mkdir({ path: dirOf(k), directory: Directory.Documents, recursive: true }); } catch { /* exists */ }
      }
    },
    getRoot: async () => 'Documents/WonderWeaves',
    chooseRoot: async () => null,
    list: async kind => {
      const { Filesystem, Directory } = await mods();
      try {
        const res = await Filesystem.readdir({ path: dirOf(kind), directory: Directory.Documents });
        return res.files
          .filter(f => f.name.toLowerCase().endsWith(EXT[kind]))
          .map(f => ({ filename: f.name, modified: Number((f as any).mtime || 0), size: Number(f.size || 0) }));
      } catch { return []; }
    },
    read: async (kind, filename) => {
      const { Filesystem, Directory, Encoding } = await mods();
      const r = await Filesystem.readFile({ path: `${dirOf(kind)}/${filename}`, directory: Directory.Documents, encoding: Encoding.UTF8 });
      return typeof r.data === 'string' ? r.data : await (r.data as Blob).text();
    },
    write: async (kind, filename, text) => {
      const { Filesystem, Directory, Encoding } = await mods();
      await Filesystem.writeFile({ path: `${dirOf(kind)}/${filename}`, directory: Directory.Documents, data: text, encoding: Encoding.UTF8, recursive: true });
    },
    remove: async (kind, filename) => {
      const { Filesystem, Directory } = await mods();
      await Filesystem.deleteFile({ path: `${dirOf(kind)}/${filename}`, directory: Directory.Documents });
    },
    exists: async (kind, filename) => {
      const { Filesystem, Directory } = await mods();
      try { await Filesystem.stat({ path: `${dirOf(kind)}/${filename}`, directory: Directory.Documents }); return true; } catch { return false; }
    },
    reveal: async () => {},
    pickFiles: pickWithInput,
    exportFile: async (name, text) => {
      const { Filesystem, Directory, Encoding, Share } = await mods();
      const path = `${BASE}/exports/${name}`;
      await Filesystem.writeFile({ path, directory: Directory.Cache, data: text, encoding: Encoding.UTF8, recursive: true });
      const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
      try { await Share.share({ title: name, url: uri.uri, dialogTitle: 'Save or send file' }); return true; } catch { return false; }
    },
    onOpenFile: () => () => {},
  };
};

/* ------------------------------------------------------------------ */
/* Browser: a private library inside the browser, plus import/export.  */
/* ------------------------------------------------------------------ */

export const browserBackend = (): FileBackend => {
  const DB = 'WonderWeavesWorkspace';
  const STORE = 'files';
  let dbp: Promise<IDBDatabase> | null = null;
  const memory = new Map<string, { text: string; modified: number }>();
  let useMemory = false;

  const open = (): Promise<IDBDatabase> => {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(DB, 1);
          req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
      });
    }
    return dbp;
  };
  const key = (kind: ItemKind, filename: string) => `${FOLDER[kind]}/${filename}`;
  const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  };

  return {
    id: 'browser',
    describe: () => 'Library stored in this browser',
    canChooseFolder: false,
    canReveal: false,
    init: async () => { try { await open(); } catch { useMemory = true; } },
    getRoot: async () => 'Browser library',
    chooseRoot: async () => null,
    list: async kind => {
      const prefix = FOLDER[kind] + '/';
      if (useMemory) {
        return [...memory.entries()].filter(([k]) => k.startsWith(prefix))
          .map(([k, v]) => ({ filename: k.slice(prefix.length), modified: v.modified, size: v.text.length }));
      }
      const keys = (await tx('readonly', s => s.getAllKeys())) as string[];
      const out: FileEntry[] = [];
      for (const k of keys.filter(k => String(k).startsWith(prefix))) {
        const v = await tx('readonly', s => s.get(k)) as { text: string; modified: number } | undefined;
        if (v) out.push({ filename: String(k).slice(prefix.length), modified: v.modified, size: v.text.length });
      }
      return out;
    },
    read: async (kind, f) => {
      const v = useMemory ? memory.get(key(kind, f)) : await tx('readonly', s => s.get(key(kind, f))) as any;
      if (!v) throw new Error('File not found: ' + f);
      return v.text;
    },
    write: async (kind, f, text) => {
      const rec = { text, modified: Date.now() };
      if (useMemory) memory.set(key(kind, f), rec); else await tx('readwrite', s => s.put(rec, key(kind, f)));
    },
    remove: async (kind, f) => {
      if (useMemory) memory.delete(key(kind, f)); else await tx('readwrite', s => s.delete(key(kind, f)));
    },
    exists: async (kind, f) => {
      if (useMemory) return memory.has(key(kind, f));
      return !!(await tx('readonly', s => s.get(key(kind, f))));
    },
    reveal: async () => {},
    pickFiles: pickWithInput,
    exportFile: async (name, text) => {
      try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
      } catch { return false; }
    },
    onOpenFile: () => () => {},
  };
};

export const pickBackend = (): FileBackend => {
  if (hasElectronBridge()) return electronBackend();
  if (isAndroidApp()) return androidBackend();
  return browserBackend();
};
