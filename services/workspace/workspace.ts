import {
  ItemKind, KINDS, EXT, FILE_TYPE, FORMAT_VERSION, AnyItemFile, DesignFile, WeaveFile, YarnFile, PaletteFile,
  ItemMeta, kindOfFileType, kindOfFilename, slug, newId,
} from './formats';
import { FileBackend, ImportedFile, pickBackend } from './backends';
import { WeaveProjectFile, ShadeCard, YarnDefinition } from '../../types';
import { LibraryWeave } from '../weaveLibrary';

/** A file in the workspace with its facts already read, ready to show in a list. */
export interface WorkspaceItem {
  kind: ItemKind;
  filename: string;
  modified: number;
  meta: ItemMeta;
  thumbnail?: string;
}

type Listener = () => void;

let backend: FileBackend | null = null;
let ready: Promise<void> | null = null;
const listeners = new Set<Listener>();
const cache = new Map<string, WorkspaceItem>(); // key: kind/filename@modified

const notify = () => listeners.forEach(l => { try { l(); } catch { /* ignore */ } });

const ensure = async (): Promise<FileBackend> => {
  if (!backend) backend = pickBackend();
  if (!ready) ready = backend.init();
  await ready;
  return backend;
};

const summarise = (kind: ItemKind, filename: string, modified: number, file: AnyItemFile): WorkspaceItem => ({
  kind, filename, modified,
  meta: file.meta,
  thumbnail: (file as DesignFile | WeaveFile).thumbnail,
});

export const parseItemFile = (text: string): AnyItemFile | null => {
  try {
    const data = JSON.parse(text);
    const kind = kindOfFileType(data?.fileType);
    if (!kind || !data.meta) return null;
    return data as AnyItemFile;
  } catch { return null; }
};

export const Workspace = {
  async info() {
    const b = await ensure();
    return {
      backendId: b.id,
      description: b.describe(),
      root: await b.getRoot(),
      canChooseFolder: b.canChooseFolder,
      canReveal: b.canReveal,
    };
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },

  async chooseFolder(): Promise<boolean> {
    const b = await ensure();
    const picked = await b.chooseRoot();
    if (!picked) return false;
    cache.clear();
    notify();
    return true;
  },

  /** Lists every item of a kind. `onBatch` receives partial results so big libraries show up quickly. */
  async list(kind: ItemKind, onBatch?: (items: WorkspaceItem[]) => void): Promise<WorkspaceItem[]> {
    const b = await ensure();
    const entries = await b.list(kind);
    const items: WorkspaceItem[] = [];
    const CHUNK = 12;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      const got = await Promise.all(slice.map(async e => {
        const key = `${kind}/${e.filename}@${e.modified}`;
        const hit = cache.get(key);
        if (hit) return hit;
        try {
          const file = parseItemFile(await b.read(kind, e.filename));
          if (!file || kindOfFileType(file.fileType) !== kind) return null;
          const item = summarise(kind, e.filename, e.modified, file);
          cache.set(key, item);
          return item;
        } catch { return null; }
      }));
      got.forEach(g => { if (g) items.push(g); });
      if (onBatch) onBatch([...items]);
    }
    items.sort((a, b2) => b2.modified - a.modified);
    return items;
  },

  async load<T extends AnyItemFile = AnyItemFile>(kind: ItemKind, filename: string): Promise<T> {
    const b = await ensure();
    const file = parseItemFile(await b.read(kind, filename));
    if (!file || kindOfFileType(file.fileType) !== kind) throw new Error('This file could not be read: ' + filename);
    return file as T;
  },

  /** Picks a file name that does not overwrite someone else's file. */
  async uniqueFilename(kind: ItemKind, name: string): Promise<string> {
    const b = await ensure();
    const base = slug(name);
    let candidate = base + EXT[kind];
    let n = 2;
    while (await b.exists(kind, candidate)) { candidate = `${base} (${n})${EXT[kind]}`; n++; }
    return candidate;
  },

  async save(kind: ItemKind, file: AnyItemFile, filename?: string): Promise<string> {
    const b = await ensure();
    const name = filename || (await Workspace.uniqueFilename(kind, file.meta.name));
    file.meta.modified = Date.now();
    await b.write(kind, name, JSON.stringify(file));
    notify();
    return name;
  },

  async remove(kind: ItemKind, filename: string) {
    const b = await ensure();
    await b.remove(kind, filename);
    notify();
  },

  async rename(kind: ItemKind, filename: string, newName: string): Promise<string> {
    const b = await ensure();
    const file = await Workspace.load(kind, filename);
    file.meta.name = newName;
    const target = await Workspace.uniqueFilename(kind, newName);
    file.meta.modified = Date.now();
    await b.write(kind, target, JSON.stringify(file));
    await b.remove(kind, filename);
    notify();
    return target;
  },

  async update(kind: ItemKind, filename: string, patch: Partial<ItemMeta>) {
    const b = await ensure();
    const file = await Workspace.load(kind, filename);
    file.meta = { ...file.meta, ...patch, modified: Date.now() };
    await b.write(kind, filename, JSON.stringify(file));
    notify();
  },

  async reveal(kind: ItemKind, filename: string) {
    const b = await ensure();
    await b.reveal(kind, filename);
  },

  async exportCopy(kind: ItemKind, filename: string): Promise<boolean> {
    const b = await ensure();
    const text = await b.read(kind, filename);
    return b.exportFile(filename, text);
  },

  async exportText(name: string, text: string): Promise<boolean> {
    const b = await ensure();
    return b.exportFile(name, text);
  },

  /** Lets the user pick files from anywhere (including Google Drive on Android) and files them in the right folders. */
  async importFromPicker(): Promise<{ added: number; skipped: string[]; items: WorkspaceItem[] }> {
    const b = await ensure();
    const picked = await b.pickFiles();
    return Workspace.importFiles(picked);
  },

  async importFiles(files: ImportedFile[]): Promise<{ added: number; skipped: string[]; items: WorkspaceItem[] }> {
    const b = await ensure();
    let added = 0;
    const skipped: string[] = [];
    const items: WorkspaceItem[] = [];
    for (const f of files) {
      const converted = convertLegacy(f.text) || parseItemFile(f.text);
      const kind = converted ? kindOfFileType(converted.fileType) : null;
      if (!converted || !kind) { skipped.push(f.name); continue; }
      const name = await Workspace.uniqueFilename(kind, converted.meta.name || f.name.replace(/\.[^.]+$/, ''));
      await b.write(kind, name, JSON.stringify(converted));
      items.push(summarise(kind, name, Date.now(), converted));
      added++;
    }
    if (added) notify();
    return { added, skipped, items };
  },

  /** Reads a file that was handed over by the operating system (double click). Returns the design to open. */
  openExternal(file: ImportedFile): AnyItemFile | null {
    return convertLegacy(file.text) || parseItemFile(file.text);
  },

  onOpenFile(cb: (file: ImportedFile) => void): () => void {
    let un: (() => void) | null = null;
    ensure().then(b => { un = b.onOpenFile(cb); });
    return () => { if (un) un(); };
  },
};

/* ---------- builders ---------- */

export const buildDesignFile = (
  project: WeaveProjectFile,
  meta: Partial<ItemMeta> & { name: string },
  thumbnail?: string,
): DesignFile => {
  const now = Date.now();
  return {
    fileType: FILE_TYPE.design as 'wonderweaves-design',
    formatVersion: FORMAT_VERSION,
    meta: { id: meta.id || project.id || newId(), created: meta.created || now, modified: now, tags: [], ...meta },
    thumbnail,
    project: { ...project, name: meta.name },
  };
};

export const buildWeaveFile = (weave: LibraryWeave, meta: Partial<ItemMeta>, thumbnail?: string): WeaveFile => {
  const now = Date.now();
  return {
    fileType: FILE_TYPE.weave as 'wonderweaves-weave',
    formatVersion: FORMAT_VERSION,
    meta: {
      id: meta.id || newId(), name: weave.name, created: meta.created || now, modified: now, tags: [],
      harnesses: weave.harnesses, ends: weave.draft[0]?.length || 0, picks: weave.pegPlan.length, ...meta,
    },
    thumbnail,
    weave,
  };
};

export const buildYarnFile = (name: string, yarn: YarnDefinition, meta: Partial<ItemMeta> = {}): YarnFile => {
  const now = Date.now();
  return {
    fileType: FILE_TYPE.yarn as 'wonderweaves-yarn-file',
    formatVersion: FORMAT_VERSION,
    meta: {
      id: meta.id || newId(), name, created: meta.created || now, modified: now, tags: [],
      fiberType: yarn.fiberType, count: `${yarn.count}${yarn.ply > 1 ? '/' + yarn.ply : ''} ${yarn.countSystem}`,
      colors: [yarn.color].filter(Boolean), ...meta,
    },
    yarn,
  };
};

export const buildPaletteFile = (card: ShadeCard, meta: Partial<ItemMeta> = {}): PaletteFile => {
  const now = Date.now();
  return {
    fileType: FILE_TYPE.palette as 'wonderweaves-palette',
    formatVersion: FORMAT_VERSION,
    meta: {
      id: card.id, name: card.name, created: meta.created || now, modified: now, tags: [],
      colorCount: card.colors.length, colors: card.colors.slice(0, 12).map(c => c.hex), ...meta,
    },
    palette: card,
  };
};

/** Old `.weave` project files (and plain project JSON) become designs. */
export const convertLegacy = (text: string): DesignFile | null => {
  try {
    const data = JSON.parse(text);
    if (data?.fileType !== 'wonderweaves-project' || !data.grids) return null;
    const project = data as WeaveProjectFile;
    return buildDesignFile(project, {
      id: project.id, name: project.name || 'Imported design', created: project.timestamp, tags: ['imported'],
      harnesses: project.loom?.harnesses, ends: project.loom?.warpThreads, picks: project.loom?.weftPicks,
      epi: project.loom?.epi, ppi: project.loom?.ppi,
    });
  } catch { return null; }
};

/** Converts everything saved by earlier versions (browser database and local storage) into files. */
export const migrateLegacyData = async (
  readLegacy: () => Promise<{
    projects: { project: WeaveProjectFile; thumbnail?: string }[];
    palettes: ShadeCard[];
    yarns: { name: string; def: YarnDefinition }[];
  }>,
): Promise<{ designs: number; palettes: number; yarns: number }> => {
  const legacy = await readLegacy();
  const counts = { designs: 0, palettes: 0, yarns: 0 };
  for (const p of legacy.projects) {
    const f = buildDesignFile(p.project, { id: p.project.id, name: p.project.name || 'Untitled', created: p.project.timestamp, tags: ['migrated'],
      harnesses: p.project.loom?.harnesses, ends: p.project.loom?.warpThreads, picks: p.project.loom?.weftPicks, epi: p.project.loom?.epi, ppi: p.project.loom?.ppi }, p.thumbnail);
    await Workspace.save('design', f);
    counts.designs++;
  }
  for (const c of legacy.palettes) { await Workspace.save('palette', buildPaletteFile(c)); counts.palettes++; }
  for (const y of legacy.yarns) { await Workspace.save('yarn', buildYarnFile(y.name, y.def)); counts.yarns++; }
  return counts;
};

export { KINDS };
