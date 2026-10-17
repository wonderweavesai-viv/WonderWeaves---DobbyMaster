import { WeaveProjectFile, ShadeCard, YarnDefinition } from '../../types';
import { LibraryWeave } from '../weaveLibrary';

export type ItemKind = 'design' | 'weave' | 'yarn' | 'palette';

export const KINDS: ItemKind[] = ['design', 'weave', 'yarn', 'palette'];

export const EXT: Record<ItemKind, string> = {
  design: '.wwdesign',
  weave: '.wwweave',
  yarn: '.wwyarn',
  palette: '.wwpalette',
};

export const FOLDER: Record<ItemKind, string> = {
  design: 'designs',
  weave: 'weaves',
  yarn: 'yarns',
  palette: 'palettes',
};

export const KIND_LABEL: Record<ItemKind, string> = {
  design: 'Design',
  weave: 'Weave',
  yarn: 'Yarn',
  palette: 'Palette',
};

export const FILE_TYPE: Record<ItemKind, string> = {
  design: 'wonderweaves-design',
  weave: 'wonderweaves-weave',
  yarn: 'wonderweaves-yarn-file',
  palette: 'wonderweaves-palette',
};

export const FORMAT_VERSION = 1;

export type WeaveClass = 'Plain' | 'Twill' | 'Satin' | 'Basket' | 'Rib' | 'Dobby';
export const WEAVE_CLASSES: WeaveClass[] = ['Plain', 'Twill', 'Satin', 'Basket', 'Rib', 'Dobby'];

/** Searchable facts stored in every file so the browser never has to open the full design. */
export interface ItemMeta {
  id: string;
  name: string;
  created: number;
  modified: number;
  tags: string[];
  notes?: string;
  // designs and weaves
  weaveClass?: WeaveClass;
  harnesses?: number;
  ends?: number;
  picks?: number;
  epi?: number;
  ppi?: number;
  colors?: string[];
  fibers?: string[];
  // yarns
  fiberType?: string;
  count?: string;
  // palettes
  colorCount?: number;
}

export interface DesignFile {
  fileType: 'wonderweaves-design';
  formatVersion: number;
  meta: ItemMeta;
  thumbnail?: string;
  project: WeaveProjectFile;
}

export interface WeaveFile {
  fileType: 'wonderweaves-weave';
  formatVersion: number;
  meta: ItemMeta;
  thumbnail?: string;
  weave: LibraryWeave;
}

export interface YarnFile {
  fileType: 'wonderweaves-yarn-file';
  formatVersion: number;
  meta: ItemMeta;
  yarn: YarnDefinition;
}

export interface PaletteFile {
  fileType: 'wonderweaves-palette';
  formatVersion: number;
  meta: ItemMeta;
  palette: ShadeCard;
}

export type AnyItemFile = DesignFile | WeaveFile | YarnFile | PaletteFile;

export const kindOfFileType = (fileType: string | undefined): ItemKind | null => {
  switch (fileType) {
    case FILE_TYPE.design: return 'design';
    case FILE_TYPE.weave: return 'weave';
    case FILE_TYPE.yarn: return 'yarn';
    case FILE_TYPE.palette: return 'palette';
    default: return null;
  }
};

export const kindOfFilename = (name: string): ItemKind | null => {
  const lower = name.toLowerCase();
  for (const k of KINDS) if (lower.endsWith(EXT[k])) return k;
  return null;
};

export const slug = (s: string): string =>
  (s || 'untitled')
    .replace(/[\\/?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled';

export const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
