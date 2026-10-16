
export interface WeaveSettings {
  warpThreads: number;
  weftPicks: number;
  harnesses: number;
  epi: number; // Ends per Inch
  ppi: number; // Picks per Inch
  gridDivision: number; // Visual grid subdivision (e.g., every 5 cells)
}

export interface DensityZone {
  id: string;
  startPick: number; // 0-indexed
  endPick: number;   // 0-indexed
  ppi: number;
  color: string;
}

export interface WeaveInput {
  draft: boolean[][];        // harnesses x warpThreads
  pegPlan: boolean[][];       // weftPicks x harnesses
  warpPattern: string[];      // length: warpThreads
  weftPattern: string[];      // length: weftPicks
}

export interface WeavePattern {
  pattern: string[][];      // weftPicks x warpThreads (Visual Colors)
  structure: boolean[][];   // weftPicks x warpThreads (true = Warp on Top, false = Weft on Top)
}

export type YarnModel = 'simple' | 'mouline' | 'melange' | 'space-dyed' | 'grindle';
export type YarnConstruction = 'standard' | 'slub' | 'chenille' | 'boucle' | 'chain' | 'tweed' | 'pile';
export type FiberType = 'Cotton' | 'Wool' | 'Silk' | 'Linen' | 'Synthetic' | 'Lurex' | 'Poly-Cotton' | 'Acrylic';
export type YarnCountSystem = 'Nm' | 'Ne' | 'Denier' | 'Tex' | 'Lea';

export interface TechnicalReconstruction {
    explanation: string;
    harnesses: number;
    warpThreads: number;
    weftPicks: number;
    epi: number;
    ppi: number;
    draft: number[][]; // 0/1
    pegPlan: number[][]; // 0/1
    warpPatternString: string;
    weftPatternString: string;
}

export interface ShadeColor {
  serial?: string;
  name?: string;
  code: string;
  hex: string;
  rgb?: string;
  cmyk?: string;
}

export interface ShadeCard {
  id: string;
  name: string;
  brand?: string;
  colors: ShadeColor[];
  isLocked?: boolean;
}

export interface YarnDefinition {
  color: string;
  colorB?: string;
  colorC?: string;
  model: YarnModel;
  construction: YarnConstruction;
  fiberType: FiberType;
  countSystem: YarnCountSystem;
  count: number;
  ply: number;
  code?: string;
  price?: number;
  strength?: number;
  elongation?: number;
  ipi?: number;
  thickness: number;
  spacing?: number;
  twist: 'S' | 'Z';
  tpi: number;
  sheen: number;
  roughness: number;
  unevenness?: number;
  shadowStrength?: number;
  hairiness?: number;
  hairLength?: number;
  hairCurl?: number;
  hairThickness?: number;
  pileLength?: number;
  pileType?: 'loop' | 'cut';
  pileDensity?: number;
  pileScale?: number;
  pileThickness?: number;
  coreThickness?: number;
  directionalUniformity?: number;
  coreColor?: string;
  spaceDyeLength?: number;
  slubMode?: 'random' | 'periodic';
  slubLength?: number;
  slubDistance?: number;
  slubAmplitude?: number;
  slubColor?: string;
  loopInterval?: number;
  loopSize?: number;
  preferredPPI?: number;
  isExtraWeft?: boolean;
  isExtraWarp?: boolean;
  extraFloatOpacity?: number;
  extraOverlap?: number;
  floatWaviness?: number;
  bindingDepth?: number;
  floatTaper?: number;
  shadowAngle?: number;
  shadowThrow?: number;
  slackTension?: number;
  puckerFrequency?: number;
  // Added missing properties to fix TypeScript errors in YarnDesignerModal, yarnRenderer, and YarnStudio
  overfeedRatio?: number;
  loopRounding?: number;
  twistAmount?: number;
  loopColor?: string;
  binderColor?: string;
}

export type ToolType = 'pencil' | 'line' | 'rect' | 'circle' | 'select' | 'pan' | 'brush' | 'fill';
export type EditMode = 'pointer' | 'keyboard';
export type ViewMode = 'interlace' | 'structure';
export type FaceMode = 'face' | 'reverse';
export type RulerUnit = 'thread' | 'inch' | 'cm';
export type LayoutCorner = 'TL' | 'BL' | 'TR' | 'BR';

export interface Colorway {
  id: string;
  name: string;
  warpYarns: Record<string, YarnDefinition>;
  weftYarns: Record<string, YarnDefinition>;
  thumbnail?: string;
}

export interface ProductionSettings {
  clientName: string;
  orderNumber: string;
  loomId: string;
  weaverName: string;
  finishedWidth: number;
  finishedLength: number;
  warpTakeUp: number;
  weftContraction: number;
  warpWaste: number;
  weftWaste: number;
  priceCurrency: string;
}

export interface MillTicketConfig {
  showDraft: boolean;
  showPegPlan: boolean;
  showYarns: boolean;
  showCosting: boolean;
  showSwatch: boolean;
  showWarpPattern: boolean;
  showWeftPattern: boolean;
  paperSize: 'A4' | 'Letter';
}

export interface WarpBeam {
  id: string;
  name: string;
  color: string;
  harnesses: number[];
  yarns: Record<string, YarnDefinition>;
  pattern: string;
}

export interface WeaveProjectFile {
  id?: string;
  fileType: 'wonderweaves-project';
  version: string;
  timestamp: number;
  name: string;
  loom: WeaveSettings;
  grids: {
    draft: number[][];
    pegPlan: number[][];
    denting: number[];
  };
  patterns: {
    warpString: string;
    weftString: string;
  };
  resources: {
    warpYarns: Record<string, YarnDefinition>;
    weftYarns: Record<string, YarnDefinition>;
    weftZones: DensityZone[];
    palette: string[];
  };
}

export type AppMode = 'specs' | 'weave' | 'yarn' | 'pattern' | 'colorways' | 'sim' | 'tech' | 'tech-studio' | 'presentation' | 'analyze' | 'print';