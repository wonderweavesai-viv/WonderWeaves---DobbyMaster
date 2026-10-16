import { YarnDefinition } from '../types';

// Helper to convert hex to rgb
const hexToRgb = (hex: string) => {
    hex = hex.replace(/^#/, '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Robust Seamless Noise
const generateSeamlessNoise1D = (length: number, scale: number = 1.0): Float32Array => {
    const buffer = new Float32Array(length);
    const period = Math.max(1, Math.floor(length / scale));
    const rawNoise = new Float32Array(period);
    for(let i=0; i<period; i++) rawNoise[i] = Math.random();
    
    for(let i=0; i<length; i++) {
        const x = (i / length) * period;
        const i0 = Math.floor(x);
        const i1 = (i0 + 1) % period; 
        const t = x - i0;
        const smoothT = t * t * (3 - 2 * t);
        buffer[i] = rawNoise[i0] * (1 - smoothT) + rawNoise[i1] * smoothT;
    }
    return buffer;
};

// --- CACHING SYSTEM ---
const CACHE_SIZE_LIMIT = 200;
let textureCache = new Map<string, HTMLCanvasElement>();

const generateYarnHash = (yarn: YarnDefinition, dpi: number): string => {
    return `${yarn.color}-${yarn.colorB}-${yarn.colorC}-${yarn.model}-${yarn.construction}-${yarn.thickness}-${yarn.twist}-${yarn.tpi}-${yarn.sheen}-${yarn.roughness}-${yarn.shadowStrength}-${yarn.hairiness}-${yarn.hairLength}-${yarn.hairCurl}-${yarn.hairThickness}-${yarn.unevenness}-${yarn.slubMode}-${yarn.slubLength}-${yarn.slubDistance}-${yarn.slubAmplitude}-${yarn.spaceDyeLength}-${yarn.pileLength}-${yarn.pileDensity}-${yarn.pileThickness}-${yarn.coreThickness}-${yarn.directionalUniformity}-${yarn.coreColor}-${yarn.overfeedRatio}-${yarn.twistAmount}-${yarn.binderColor}-${yarn.loopColor}-${yarn.loopInterval}-${yarn.loopSize}-${yarn.loopRounding}-${yarn.extraOverlap}-${dpi}`;
};

const manageCache = () => {
    if (!textureCache) textureCache = new Map();
    if (textureCache.size > CACHE_SIZE_LIMIT) {
        const keysToDelete = Array.from(textureCache.keys()).slice(0, 20);
        keysToDelete.forEach(k => {
            textureCache.delete(k);
        });
    }
};

/**
 * Hyper-Realistic Yarn Renderer v14.3
 * Refined Chenille and Geometric Bouclé Loop Engine with Individual Color Components
 */
export const generateYarnTexture = (yarn: YarnDefinition, dpi: number = 144): HTMLCanvasElement => {
    if (!textureCache) textureCache = new Map();
    const hash = generateYarnHash(yarn, dpi);
    if (textureCache.has(hash)) return textureCache.get(hash)!;

    const { 
        color, colorB, colorC, model, construction, fiberType, twist, tpi, 
        sheen, roughness, shadowStrength = 0.8,
        hairiness = 0, hairLength = 0.2, hairCurl = 0, hairThickness = 1.0,
        unevenness = 0, spaceDyeLength = 10,
        slubMode = 'periodic', slubLength = 0, slubDistance = 0, slubAmplitude = 0, slubColor,
        pileLength = 1.0, pileDensity = 0.6, pileThickness = 1.0, coreThickness = 0.4, directionalUniformity = 0.2,
        coreColor, loopColor, overfeedRatio = 1.5, twistAmount = 200, binderColor, loopInterval = 0.5, loopSize = 1.0, loopRounding = 0.5,
        extraOverlap = 0
    } = yarn;

    const pxPerMm = dpi / 25.4;
    const isChenille = construction === 'chenille';
    const isBoucle = construction === 'boucle';
    const isSlubActive = ((slubLength > 0.1 || (yarn.slubLength || 0) > 0) && (slubAmplitude > 10 || (yarn.slubAmplitude || 0) > 0));
    const isSpaceDye = model === 'space-dyed';
    const isGrindle = model === 'grindle';
    
    let cycleLenPx = 1; 
    let sLenPx = 0;
    let sDistPx = 0;
    let ampFactor = 0;

    if (isSlubActive) {
        if (slubLength > 0) {
            sLenPx = slubLength * (dpi / 2.54);
            sDistPx = slubDistance * (dpi / 2.54);
            ampFactor = slubAmplitude / 100;
            cycleLenPx = Math.max(1, sLenPx + sDistPx);
        } else {
            const dpiScale = dpi / 96;
            sLenPx = lerp(40, 300, yarn.slubLength || 0.5) * dpiScale;
            sDistPx = lerp(40, 800, yarn.slubDistance || 0.5) * dpiScale;
            ampFactor = yarn.slubAmplitude || 0;
            cycleLenPx = Math.max(1, sLenPx + sDistPx);
        }
    } else if (isSpaceDye) {
        cycleLenPx = Math.max(1, (spaceDyeLength || 10) * (dpi / 2.54));
    }

    const MIN_TEXTURE_WIDTH = 2048;
    const MAX_TEXTURE_WIDTH = 8192; 
    let width = MIN_TEXTURE_WIDTH;
    let cycles = 1;

    if ((isSlubActive || isSpaceDye) && cycleLenPx > 1) {
        let targetCycles = Math.ceil(MIN_TEXTURE_WIDTH / cycleLenPx);
        targetCycles = Math.max(2, targetCycles);
        let idealWidth = targetCycles * cycleLenPx;
        if (idealWidth > MAX_TEXTURE_WIDTH) {
            targetCycles = Math.floor(MAX_TEXTURE_WIDTH / cycleLenPx);
            idealWidth = targetCycles * cycleLenPx;
        }
        cycles = targetCycles;
        width = Math.ceil(idealWidth);
    } else {
        width = Math.min(4096, Math.max(2048, Math.ceil(50 * (dpi / 2.54)))); 
    }

    // --- GEOMETRY CALCULATION ---
    const baseCoreHeight = Math.min(64, Math.max(16, Math.floor(dpi / 4)));
    let effectiveCoreHeight = isChenille ? baseCoreHeight * (coreThickness || 0.4) : baseCoreHeight;
    if (isBoucle) effectiveCoreHeight = baseCoreHeight * (coreThickness || 0.5);

    // Apply Spread (Overlap) to the physical core volume
    effectiveCoreHeight *= (1.0 + extraOverlap);

    const pLenPx = (pileLength || 0.1) * pxPerMm;
    const lSizePx = (loopSize || 1.0) * baseCoreHeight * 0.8;
    const totalVisHeight = isChenille ? effectiveCoreHeight + (pLenPx * 2.2) : (isBoucle ? effectiveCoreHeight + (lSizePx * 2.5) : baseCoreHeight * 2);
    
    const height = Math.max(1, Math.floor(totalVisHeight));
    const centerY = height / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return canvas;
    
    const colA = hexToRgb(color);
    const colB = colorB ? hexToRgb(colorB) : colA;
    const colC = colorC ? hexToRgb(colorC) : (colorB ? hexToRgb(colorB) : colA);
    const colSlub = slubColor ? hexToRgb(slubColor) : colA;
    const colCore = coreColor ? hexToRgb(coreColor) : (isChenille || isBoucle ? { r: colA.r * 0.7, g: colA.g * 0.7, b: colA.b * 0.7 } : colA);
    const colLoop = loopColor ? hexToRgb(loopColor) : colA;
    const colBinder = binderColor ? hexToRgb(binderColor) : { r: colA.r * 0.9, g: colA.g * 0.9, b: colA.b * 0.9 };

    const twistDirVal = twist === 'S' ? 1 : -1;
    const twistAngle = Math.atan((tpi || 15) * 0.15) * twistDirVal; 
    const twistSin = Math.sin(twistAngle);
    const twistCos = Math.cos(twistAngle);

    const L = { x: -0.2, y: -0.3, z: 1.0 };
    const lenL = Math.sqrt(L.x*L.x + L.y*L.y + L.z*L.z);
    L.x/=lenL; L.y/=lenL; L.z/=lenL;

    const V = { x: 0, y: 0, z: 1 };
    const H = { x: L.x + V.x, y: L.y + V.y, z: L.z + V.z };
    const lenH = Math.sqrt(H.x*H.x + H.y*H.y + H.z*H.z);
    H.x/=lenH; H.y/=lenH; H.z/=lenH;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    const slubProfile = new Float32Array(width).fill(1.0);
    
    if (isSlubActive && cycles >= 1 && cycleLenPx > 1) {
        const fittedTotalPx = width / cycles;
        const totalFeaturePx = sLenPx + sDistPx;
        const lenRatio = sLenPx / Math.max(1, totalFeaturePx);
        const actualLenPx = fittedTotalPx * lenRatio;
        const intervals = [];
        for(let i=0; i<cycles; i++) {
            const start = (i * fittedTotalPx) + (fittedTotalPx - actualLenPx)/2;
            intervals.push({ start, len: actualLenPx });
        }
        const rampPx = Math.min(actualLenPx * 0.25, 40 * (dpi/96));
        for (let i=0; i<intervals.length; i++) {
            const { start, len } = intervals[i];
            for(let x = Math.floor(start - rampPx); x <= Math.ceil(start + len + rampPx); x++) {
                const wx = ((x % width) + width) % width;
                let dist = x < start ? start - x : (x > start + len ? x - (start + len) : 0);
                let val = dist <= 0 ? 1.0 + ampFactor : (dist < rampPx ? lerp(1.0 + ampFactor, 1.0, dist / rampPx) : 1.0);
                if (val > slubProfile[wx]) slubProfile[wx] = val;
            }
        }
    }

    if (unevenness > 0) {
        const lowFreq = generateSeamlessNoise1D(width, 200 * (dpi/96));
        for(let i=0; i<width; i++) slubProfile[i] += (lowFreq[i] - 0.5) * 0.3 * unevenness;
    }

    const isTweed = construction === 'tweed';
    const tweedNoise = isTweed ? generateSeamlessNoise1D(width, 2.0) : null;
    const fiberNoise = generateSeamlessNoise1D(width, 2.0); 

    // MAIN VOLUME PASS (Core)
    for (let x = 0; x < width; x++) {
        let thicknessMod = Math.max(0.1, slubProfile[x]);
        let isNep = false;
        if (isTweed && tweedNoise && tweedNoise[x] > 0.85) { thicknessMod += 0.4; isNep = true; }

        const currentRadius = (effectiveCoreHeight / 2) * thicknessMod;
        const minY = Math.floor(centerY - currentRadius);
        const maxY = Math.ceil(centerY + currentRadius);

        let spaceDyeFactor = isSpaceDye ? (Math.sin(((x % cycleLenPx) / cycleLenPx) * Math.PI * 2) + 1) / 2 : 0;

        for (let y = minY; y <= maxY; y++) {
            if (y < 0 || y >= height) continue; 
            const ny = (y - centerY) / Math.max(0.1, currentRadius);
            if (Math.abs(ny) > 1) continue;

            const idx = (y * width + x) * 4;
            const cylinderDepth = Math.sqrt(Math.max(0, 1.0 - ny*ny));
            const rotX = x * twistCos - (y - centerY) * twistSin;
            const twistPhase = rotX * (tpi || 15) * 0.15;
            const rawTwist = Math.sin(twistPhase);
            const twistNormal = Math.cos(twistPhase);
            const noiseX = Math.floor((rotX * 2) % width + width) % width;
            const micro = (fiberNoise[noiseX] - 0.5) * 2.0;

            let n_y = ny + (twistNormal * 0.6 + micro * (roughness * 0.5 + 0.2)) * 0.3; 
            let nz = cylinderDepth;
            const lenN = Math.sqrt(n_y*n_y + nz*nz);
            n_y /= Math.max(0.01, lenN); nz /= Math.max(0.01, lenN);

            const diffuse = Math.max(0, Math.min(1, (n_y*L.y + nz*L.z) * 0.6 + 0.4));
            const specular = Math.pow(Math.max(0, n_y*H.y + nz*H.z), fiberType === 'Lurex' ? 120 : (10 + sheen * 80)) * (fiberType === 'Lurex' ? 2.0 : sheen * 0.6);

            const totalAO = Math.max(0.5 + 0.5 * (1.0 - shadowStrength), Math.pow((rawTwist + 1) / 2, 0.15) * Math.pow(cylinderDepth, 0.1));

            let r, g, b;
            const baseColUsed = colCore;

            if (isNep) { r = colC.r; g = colC.g; b = colC.b; }
            else if (thicknessMod > 1.1 && slubColor) { const blend = Math.min(1, (thicknessMod - 1.0) * 2.0); r = lerp(baseColUsed.r, colSlub.r, blend); g = lerp(baseColUsed.g, colSlub.g, blend); b = lerp(baseColUsed.b, colSlub.b, blend); }
            else if (isSpaceDye) { r = lerp(baseColUsed.r, colB.r, spaceDyeFactor); g = lerp(baseColUsed.g, colB.g, spaceDyeFactor); b = lerp(baseColUsed.b, colB.b, spaceDyeFactor); }
            else if (isGrindle) {
                const grindlePhase = twistPhase * 1.0; 
                const useB = Math.sin(grindlePhase) > 0;
                const activeCol = useB ? colB : baseColUsed;
                r = activeCol.r; g = activeCol.g; b = activeCol.b;
            }
            else { const useB = model === 'mouline' ? Math.sin(rotX * 0.2) > 0 : (model === 'melange' ? fiberNoise[x] > 0.5 : false); const activeCol = useB ? colB : baseColUsed; r = activeCol.r; g = activeCol.g; b = activeCol.b; }

            const lightVal = diffuse * totalAO * 1.1;
            data[idx] = Math.min(255, r * lightVal + specular * 255);
            data[idx+1] = Math.min(255, g * lightVal + specular * 255);
            data[idx+2] = Math.min(255, b * lightVal + specular * 255);
            data[idx+3] = Math.min(255, (1.0 - Math.abs(ny)) * 255 * 3.0); 
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // --- BOUCLE LOOP LAYER ---
    if (isBoucle) {
        ctx.save();
        const loopSteps = Math.floor(width / (loopInterval * 40));
        const roundingFactor = loopRounding ?? 0.5;
        
        for (let i = 0; i < loopSteps; i++) {
            const x = (i / loopSteps) * width;
            const twistPhase = (x * twistAmount) / 1000;
            const loopSide = Math.sin(twistPhase); 
            
            ctx.lineWidth = baseCoreHeight * (pileThickness || 0.4);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const thicknessMod = slubProfile[Math.floor(x % width)];
            const coreRad = (effectiveCoreHeight / 2) * thicknessMod;
            const size = lSizePx * (0.8 + Math.random() * 0.4) * (overfeedRatio || 1.5);
            
            // Loop geometry
            const startX = x - (size * 0.3);
            const endX = x + (size * 0.3);
            const startY = centerY + (loopSide > 0 ? coreRad : -coreRad);
            const peakY = centerY + (loopSide > 0 ? coreRad + size : -coreRad - size);
            
            // Apply Rounding: Control points bulge outward horizontally
            const bulge = size * 0.8 * roundingFactor;
            const cp1x = startX - bulge;
            const cp2x = endX + bulge;
            const cpy = peakY;

            // Shadow for depth
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth += 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cpy, cp2x, cpy, endX, startY);
            ctx.stroke();

            // Main loop strand
            ctx.lineWidth -= 2;
            let curCol = colLoop;
            if (isSpaceDye) {
                const spaceDyeFactor = (Math.sin(((x % cycleLenPx) / cycleLenPx) * Math.PI * 2) + 1) / 2;
                curCol = { r: lerp(colLoop.r, colB.r, spaceDyeFactor), g: lerp(colLoop.g, colB.g, spaceDyeFactor), b: lerp(colLoop.b, colB.b, spaceDyeFactor) };
            }
            ctx.strokeStyle = `rgb(${curCol.r}, ${curCol.g}, ${curCol.b})`;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(cp1x, cpy, cp2x, cpy, endX, startY);
            ctx.stroke();

            // Specular highlight on loop peak
            ctx.strokeStyle = `rgba(255,255,255,${sheen * 0.3})`;
            ctx.lineWidth *= 0.5;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.1, peakY - (loopSide > 0 ? 1 : -1));
            ctx.lineTo(x + size * 0.1, peakY - (loopSide > 0 ? 1 : -1));
            ctx.stroke();
        }

        // DRAW BINDER
        const binderFreq = 0.2;
        const binderAmp = effectiveCoreHeight * 0.6;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${colBinder.r}, ${colBinder.g}, ${colBinder.b}, 0.8)`;
        ctx.beginPath();
        for(let bx=0; bx<width; bx+=2) {
            const by = centerY + Math.sin(bx * binderFreq) * binderAmp;
            if(bx===0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.restore();
    }

    // --- CHENILLE PILE LAYER ---
    if (isChenille) {
        const densityMultiplier = (pileDensity || 0.6) * 100000 * (width / 2048);
        const uniformity = directionalUniformity || 0;
        ctx.save();
        ctx.lineWidth = (pileThickness || 1.0);
        ctx.lineCap = 'butt';
        const spiralFreq = 0.05; 
        for(let i=0; i<densityMultiplier; i++) {
            const x = (i / densityMultiplier) * width;
            const spiralPhase = x * spiralFreq;
            const exitSine = Math.sin(spiralPhase);
            const spiralAngle = (Math.PI / 2) + (exitSine * (Math.PI / 4));
            const randomAngle = Math.random() * Math.PI * 2;
            const finalAngle = lerp(randomAngle, spiralAngle, uniformity);
            const lengthVar = 0.8 + Math.random() * 0.4;
            const baseLen = pLenPx * lengthVar;
            let curCol = colA;
            if (isSpaceDye) {
                const spaceDyeFactor = (Math.sin(((x % cycleLenPx) / cycleLenPx) * Math.PI * 2) + 1) / 2;
                curCol = { r: lerp(colA.r, colB.r, spaceDyeFactor), g: lerp(colA.g, colB.g, spaceDyeFactor), b: lerp(colA.b, colB.b, spaceDyeFactor) };
            }
            const alpha = 0.6 + Math.random() * 0.4;
            ctx.strokeStyle = `rgba(${curCol.r}, ${curCol.g}, ${curCol.b}, ${alpha})`;
            ctx.beginPath();
            const coreRadius = (effectiveCoreHeight / 2) * slubProfile[Math.floor(x % width)];
            const exitY = centerY + (uniformity > 0.5 ? exitSine * coreRadius : (Math.random() - 0.5) * coreRadius * 2);
            const ex = x + Math.cos(finalAngle) * baseLen; 
            const ey = exitY + Math.sin(finalAngle) * baseLen;
            ctx.moveTo(x, exitY); ctx.lineTo(ex, ey); ctx.stroke();
        }
        ctx.save();
        ctx.filter = 'blur(1.5px)';
        ctx.globalAlpha = 0.15 * (pileDensity || 0.6);
        ctx.fillStyle = `rgb(${colA.r}, ${colA.g}, ${colA.b})`;
        ctx.fillRect(0, centerY - pLenPx, width, pLenPx * 2);
        ctx.restore();
        ctx.restore();
    } 

    // --- UNIVERSAL FIBERS & HAIRS ---
    if (hairiness > 0 || roughness > 0) {
        const scHair = ((hairiness * 30000) + (roughness * 5000)) * (width / 2048);
        const maxL = (hairLength || 0.2) * effectiveCoreHeight * 6;
        for(let i=0; i<scHair; i++) {
            let cx = Math.random() * width, cy = centerY + (Math.random()-0.5) * effectiveCoreHeight * slubProfile[Math.floor(cx)] * 0.9;
            const dirY = Math.random() < 0.5 ? -1 : 1, len = Math.random() * maxL, steps = Math.max(2, len), alpha = 0.4 + Math.random() * 0.2;
            ctx.strokeStyle = `rgba(${colA.r * 1.2}, ${colA.g * 1.2}, ${colA.b * 1.2}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for(let s=0; s<steps; s++) {
                cy += dirY * 0.8; cx += (hairCurl || 0) > 0 ? Math.sin(s * 0.3) * hairCurl * 2.0 : (Math.random()-0.5) * 0.5;
                ctx.lineTo(cx, cy);
                if (Math.random() < 0.05) break;
            }
            ctx.stroke();
        }
    }

    manageCache();
    textureCache.set(hash, canvas);
    return canvas;
};