
import { YarnDefinition, DensityZone } from '../../types';

export const APP_VERSION = "2.1.0";

export interface WeaveProjectFile {
  id?: string; // Stable identifier for the project
  fileType: 'wonderweaves-project';
  version: string;
  timestamp: number;
  name: string;
  
  loom: {
    warpThreads: number;
    weftPicks: number;
    harnesses: number;
    epi: number;
    ppi: number;
    gridDivision: number;
  };
  
  grids: {
    // 1 = active, 0 = inactive
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

export interface YarnLibraryFile {
  fileType: 'wonderweaves-yarn';
  version: string;
  data: YarnDefinition;
}
