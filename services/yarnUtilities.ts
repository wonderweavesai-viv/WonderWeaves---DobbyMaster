
import { YarnDefinition, YarnCountSystem, FiberType } from '../types';

export interface YarnPhysics {
    nm: number;
    tex: number;
    denier: number;
    diameterMm: number;
    yardsPerLb: number;
}

export const calculateYarnPhysics = (yarn: YarnDefinition): YarnPhysics => {
    let nm = 0;
    const safeCount = Math.max(0.1, yarn.count);
    const ply = Math.max(1, yarn.ply);

    // Calculate Resultant Nm first (Standard Metric)
    switch (yarn.countSystem) {
        case 'Nm': nm = safeCount / ply; break;
        case 'Ne': nm = (safeCount * 1.6934) / ply; break;
        case 'Lea': nm = (safeCount * 0.6048) / ply; break; // Linen Lea -> Nm
        case 'Denier': nm = 9000 / (safeCount * ply); break; // Resultant Denier is sum of ply, here we assume input count is single strand count
        case 'Tex': nm = 1000 / (safeCount * ply); break;
        default: nm = safeCount / ply;
    }

    const tex = 1000 / nm;
    const denier = 9000 / nm;
    const yardsPerLb = nm * 496.055; // Nm * 0.5905 * 840 ? Approx Nm * 496

    // Peirce's Formula for Diameter
    let diamCoeff = 0.037;
    if (['Silk', 'Synthetic', 'Lurex'].includes(yarn.fiberType)) {
        diamCoeff = 0.032;
    }
    const diameterMm = diamCoeff * Math.sqrt(tex);

    return { nm, tex, denier, diameterMm, yardsPerLb };
};
