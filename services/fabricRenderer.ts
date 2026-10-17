import { YarnDefinition, DensityZone } from '../types';
import { generateYarnTexture } from './yarnRenderer';

interface RenderOptions {
    weavePattern: string[][];
    structure: boolean[][];
    epi: number;
    ppi: number;
    dentingPlan?: number[];
    weftZones?: DensityZone[];
    warpYarns: { [key: string]: YarnDefinition };
    weftYarns: { [key: string]: YarnDefinition };
    warpYarnSequence: string[];
    weftYarnSequence: string[];
    viewSide: 'face' | 'back';
    dpi: number;
    width?: number; 
    height?: number; 
    hideFloats?: boolean; 
    backgroundColor?: string; 
    smoothingQuality?: 'low' | 'medium' | 'high' | 'none';
    overrideShadowAngle?: number; // Global lighting direction override
    /** Internal: draw only one repeating tile (with a margin of threads on every side). */
    _tile?: { cols: number; rows: number; marginCols: number; marginRows: number; w: number; h: number };
    /** Set false to force drawing every thread (used to compare against the fast path). */
    allowTiling?: boolean;
}

const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 128;
shadowCanvas.height = 128;
const sCtx = shadowCanvas.getContext('2d');
if (sCtx) {
    const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.7)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
}

const MAX_CANVAS_DIM = 8192;

export const renderFabricToCanvas = (options: RenderOptions): HTMLCanvasElement => {
    const { 
        weavePattern, structure, epi: rawEpi, ppi: rawPpi, dentingPlan, weftZones,
        warpYarns, weftYarns, warpYarnSequence, weftYarnSequence,
        viewSide, dpi, width: displayW = 1200, height: displayH = 750,
        hideFloats = false,
        backgroundColor = '#050505',
        smoothingQuality = 'high',
        overrideShadowAngle
    } = options;
    const tileOpt = options._tile;

    const epi = Math.max(1, rawEpi);
    const ppi = Math.max(1, rawPpi);
    const rows = weavePattern.length;
    const cols = weavePattern[0] ? weavePattern[0].length : 0;
    if (rows === 0 || cols === 0) return document.createElement('canvas');
    
    const SS_FACTOR = (dpi < 300 && (epi > 70 || ppi > 70)) ? 1.5 : 1.0; 
    const PX_PER_INCH = dpi * SS_FACTOR;

    let targetCanvasWidth = Math.round((displayW / 96) * PX_PER_INCH);
    let targetCanvasHeight = Math.round((displayH / 96) * PX_PER_INCH);

    if (tileOpt) { targetCanvasWidth = tileOpt.w; targetCanvasHeight = tileOpt.h; }
    if (targetCanvasWidth > MAX_CANVAS_DIM) targetCanvasWidth = MAX_CANVAS_DIM;
    if (targetCanvasHeight > MAX_CANVAS_DIM) targetCanvasHeight = MAX_CANVAS_DIM;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, targetCanvasWidth);
    canvas.height = Math.max(1, targetCanvasHeight);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = smoothingQuality !== 'none';
    if (smoothingQuality !== 'none') ctx.imageSmoothingQuality = smoothingQuality;

    ctx.fillStyle = backgroundColor; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const safePlan = (dentingPlan && dentingPlan.length > 0) ? dentingPlan : [1];
    const avgThreadsPerDent = Math.max(0.1, safePlan.reduce((a, b) => a + b, 0) / safePlan.length);
    
    /**
     * DENTING COMPRESSION LOGIC
     * We treat the 'epi' slider as the density at a standard 2-ends-per-dent.
     * By using a fixed reference of 2.0 instead of the current average, the simulator 
     * becomes responsive to global denting changes (halving width if denting goes 2->4).
     */
    const dentWidthPx = Math.max(0.1, (PX_PER_INCH * 2.0) / epi);

    /**
     * FAST PATH: a woven fabric repeats. Instead of drawing every thread of a huge canvas (hundreds of
     * thousands of cells, three passes each), draw one repeat of the weave once, with a small margin so
     * shadows join up, and copy it across the canvas.
     */
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
    const sCycle = safePlan.reduce((a, b) => a + Math.max(0, b), 0);
    const uniformRows = !(weftZones && weftZones.length) && !Object.values(weftYarns).some(y => y && (y as any).preferredPPI);
    if (!tileOpt && options.allowTiling !== false && uniformRows && sCycle > 0 && Number.isInteger(sCycle)) {
        const seqW = Math.max(1, warpYarnSequence.length), seqF = Math.max(1, weftYarnSequence.length);
        let Pc = lcm(lcm(cols, seqW), sCycle);
        let Pr = lcm(rows, seqF);
        const MIN_TILE = 96; // enough threads that yarn texture variation does not look repeated
        if (Pc < MIN_TILE) Pc *= Math.ceil(MIN_TILE / Pc);
        if (Pr < MIN_TILE) Pr *= Math.ceil(MIN_TILE / Pr);
        if (Pc <= 512 && Pr <= 512) {
            const marginCols = sCycle * Math.ceil(3 / sCycle);
            const marginRows = 3;
            const threadPxX = (safePlan.length * dentWidthPx) / sCycle; // average width of one thread
            const rowPx = PX_PER_INCH / ppi;
            const tileW = (Pc / sCycle) * safePlan.length * dentWidthPx;
            const tileH = Pr * rowPx;
            if (tileW * tileH < canvas.width * canvas.height * 0.4) {
                const mx = (marginCols / sCycle) * safePlan.length * dentWidthPx;
                const my = marginRows * rowPx;
                const tile = renderFabricToCanvas({
                    ...options,
                    _tile: { cols: Pc, rows: Pr, marginCols, marginRows, w: Math.ceil(tileW + 2 * mx) + 2, h: Math.ceil(tileH + 2 * my) + 2 },
                });
                const srcX = Math.round(mx), srcY = Math.round(my);
                for (let m = 0; ; m++) {
                    const y0 = Math.round(m * tileH);
                    if (y0 >= canvas.height) break;
                    const dh = Math.round((m + 1) * tileH) - y0;
                    for (let k = 0; ; k++) {
                        const x0 = Math.round(k * tileW);
                        if (x0 >= canvas.width) break;
                        const dw = Math.round((k + 1) * tileW) - x0;
                        ctx.drawImage(tile, srcX, srcY, dw, dh, x0, y0, dw, dh);
                    }
                }
                void threadPxX;
                return canvas;
            }
        }
    }

    const warpPositions: {x: number, w: number, jitter: number, dentSize: number}[] = [];
    let currentX = 0, dIdx = 0;
    const maxThreads = tileOpt ? tileOpt.cols + 2 * tileOpt.marginCols : Infinity;
    while (currentX < canvas.width && warpPositions.length < maxThreads) {
        const threads = Math.max(0, safePlan[dIdx % safePlan.length]);
        if (threads === 0) { 
            currentX += dentWidthPx; 
        } else {
            const w = Math.max(0.1, dentWidthPx / threads);
            for (let k = 0; k < threads; k++) {
                warpPositions.push({ 
                    x: currentX, w, 
                    jitter: (Math.random() - 0.5) * (w * 0.05),
                    dentSize: threads 
                });
                currentX += w;
                if (currentX >= canvas.width || warpPositions.length >= maxThreads) break;
            }
        }
        dIdx++;
    }
    const totalCols = warpPositions.length;

    const warpInfluence = new Float32Array(totalCols).fill(0);
    for (let c = 0; c < totalCols; c++) {
        const waDef = warpYarns[warpYarnSequence[c % (warpYarnSequence.length || 1)]];
        if (waDef && (waDef.slackTension || 1.0) > 1.0) {
            for (let offset = -2; offset <= 2; offset++) {
                const target = c + offset;
                if (target >= 0 && target < totalCols) warpInfluence[target] = Math.max(warpInfluence[target], 1.0 - (Math.abs(offset) * 0.2));
            }
        }
    }

    const rowY: number[] = [], rowHeights: number[] = [];
    let currentY = 0, rCount = 0;
    const maxRows = tileOpt ? tileOpt.rows + 2 * tileOpt.marginRows : Infinity;
    while(currentY < canvas.height && rCount < maxRows) {
        const r = rCount % rows;
        let h = PX_PER_INCH / ppi;
        if (weftZones) { 
            const z = weftZones.find(z => r >= z.startPick && r <= z.endPick); 
            if(z) h = PX_PER_INCH / Math.max(1, z.ppi); 
        }
        const preferred = weftYarns[weftYarnSequence[r % (weftYarnSequence.length || 1)]]?.preferredPPI;
        if (preferred) h = PX_PER_INCH / Math.max(1, preferred);
        h = Math.max(0.1, h);
        rowY.push(currentY); rowHeights.push(h);
        currentY += h; rCount++;
    }

    const textureMap = new Map<string, HTMLCanvasElement>();
    // Scale Nominal Warp Width to match the Compression factor
    const NOMINAL_WARP_W = (PX_PER_INCH / epi) * (2.0 / avgThreadsPerDent);
    const NOMINAL_WEFT_H = PX_PER_INCH / ppi;
    const TEX_VISUAL_SCALE = 2.0;

    Object.keys(warpYarns).forEach(k => {
        const tex = generateYarnTexture(warpYarns[k], dpi * SS_FACTOR);
        textureMap.set(`warp-${k}`, tex);
    });
    Object.keys(weftYarns).forEach(k => {
        const tex = generateYarnTexture(weftYarns[k], dpi * SS_FACTOR);
        textureMap.set(`weft-${k}`, tex);
    });

    const drawThreadSegment = (tex: HTMLCanvasElement, tx: number, ty: number, tw: number, th: number, isV: boolean, idx: number, op: number, over: number, taper: number, ao: number, jitter: number) => {
        const thicknessMod = (1.0 + over) * (1.0 - taper);
        let dx: number, dy: number, dw: number, dh: number;
        
        if (isV) {
            dw = NOMINAL_WARP_W * thicknessMod * TEX_VISUAL_SCALE; 
            dh = th;
            dx = tx + (tw/2) - (dw/2) + jitter; dy = ty;
        } else {
            dh = NOMINAL_WEFT_H * thicknessMod * TEX_VISUAL_SCALE;
            dw = tw;
            dx = tx; dy = ty + (th/2) - (dh/2) + jitter;
        }

        ctx.save();
        ctx.globalAlpha = op;
        
        const phase = (Math.abs(Math.sin(idx * 543.21) * 10000) % 1) * tex.width;
        const totalPos = (isV ? ty : tx) + phase;
        
        if (isV) {
            ctx.translate(dx + dw/2, dy + dh/2);
            ctx.rotate(Math.PI / 2);
            const sX = Math.floor(totalPos % tex.width);
            const sW = Math.min(dh, tex.width - sX);
            const scaleFac = dh / th; 
            ctx.drawImage(tex, sX, 0, sW, tex.height, -dh/2, -dw/2, sW * scaleFac + 0.5, dw + 0.5);
            if (sW < dh) ctx.drawImage(tex, 0, 0, dh - sW, tex.height, -dh/2 + (sW * scaleFac), -dw/2, (dh - sW) * scaleFac + 0.5, dw + 0.5);
        } else {
            const sX = Math.floor(totalPos % tex.width);
            const sW = Math.min(dw, tex.width - sX);
            const scaleFac = dw / tw;
            ctx.drawImage(tex, sX, 0, sW, tex.height, dx, dy, sW * scaleFac + 0.5, dh + 0.5);
            if (sW < dw) ctx.drawImage(tex, 0, 0, dw - sW, tex.height, dx + (sW * scaleFac), dy, (dw - sW) * scaleFac + 0.5, dh + 0.5);
        }

        if (ao > 0) {
            ctx.fillStyle = `rgba(0,0,0,${ao * 0.5})`;
            ctx.fillRect(dx, dy, dw + 0.5, dh + 0.5);
        }
        ctx.restore();
    };

    // --- PASS 1 & 2 & 3: Triple-Pass Engine ---
    for (let pass = 0; pass < 3; pass++) {
        for (let r = 0; r < rCount; r++) {
            const lr = tileOpt ? (((r - tileOpt.marginRows) % tileOpt.rows) + tileOpt.rows) % tileOpt.rows : r; // logical pick
            const pR = lr % rows;
            const wYId = weftYarnSequence[pR % (weftYarnSequence.length || 1)] || 'A';
            const wDef = weftYarns[wYId], wTex = textureMap.get(`weft-${wYId}`);
            const gY = rowY[r], gH = rowHeights[r];

            for (let c = 0; c < totalCols; c++) {
                const lc = tileOpt ? (((c - tileOpt.marginCols) % tileOpt.cols) + tileOpt.cols) % tileOpt.cols : c; // logical end
                const pC = lc % cols;
                const waYId = warpYarnSequence[pC % (warpYarnSequence.length || 1)] || 'A';
                const waDef = warpYarns[waYId], waTex = textureMap.get(`warp-${waYId}`);
                const { x: gX, w: gW, jitter: jit, dentSize } = warpPositions[c];

                const wTopR = (structure[pR] && structure[pR][pC]) || false;
                const wTop = viewSide === 'face' ? wTopR : !wTopR;

                let wAO = 0, waAO = 0, wT = 0, waT = 0;
                const check = (dr: number, dc: number) => {
                    const tr = (pR + dr + rows) % rows, tc = (pC + dc + cols) % cols;
                    const val = (structure[tr] && structure[tr][tc]) || false;
                    return viewSide === 'face' ? val : !val;
                };
                if (!wTop && (check(0, -1) || check(0, 1))) { wAO = wDef?.bindingDepth || 0.4; wT = wDef?.floatTaper || 0; }
                if (wTop && (!check(-1, 0) || !check(1, 0))) { waAO = waDef?.bindingDepth || 0.4; waT = waDef?.floatTaper || 0; }

                let wOp = 1.0, wOv = wDef?.extraOverlap ?? 0, waOp = 1.0, waOv = waDef?.extraOverlap ?? 0;
                const isCrowdedWarp = dentSize > (avgThreadsPerDent + 0.1); 

                if (wDef?.isExtraWeft && wTop) wOp = hideFloats ? 0 : (wDef.extraFloatOpacity ?? 0.08);
                if ((waDef?.isExtraWarp || isCrowdedWarp) && !wTop) {
                    waOp = hideFloats ? 0 : (waDef?.extraFloatOpacity ?? 0.08); 
                    if (isCrowdedWarp) waOv = Math.max(waOv, 0.2); 
                }

                if (pass === 0) {
                    // Pass 1: DRAW THE BED (Everything that is UNDER)
                    if (wTop) { 
                        if (wTex && wOp > 0) drawThreadSegment(wTex, gX, gY, gW, gH, false, lr, wOp, wOv, wT, wAO, jit); 
                    } else { 
                        if (waTex && waOp > 0) drawThreadSegment(waTex, gX, gY, gW, gH, true, lc, waOp, waOv, waT, waAO, jit); 
                    }
                } 
                else if (pass === 1) {
                    // Pass 2: DRAW THE DEPTH (Shadows of everything that is ON TOP)
                    const tD = wTop ? waDef : wDef, tOp = wTop ? waOp : wOp;
                    const sTh = (tD?.shadowThrow ?? 1.0) * SS_FACTOR * (dpi/96);
                    // Priority: overrideShadowAngle > yarn shadowAngle > default 135
                    const angleDeg = overrideShadowAngle !== undefined ? overrideShadowAngle : (tD?.shadowAngle ?? 135);
                    const sAn = angleDeg * Math.PI/180;

                    if (tOp > 0.1 && sTh > 0) {
                        const sW = wTop ? NOMINAL_WARP_W * (tD?.thickness || 1) * (1+waOv) : gW * 1.1;
                        const sH = wTop ? gH * 1.1 : NOMINAL_WEFT_H * (tD?.thickness || 1) * (1+wOv);
                        ctx.globalAlpha = 0.4; 
                        ctx.drawImage(shadowCanvas, (gX + gW/2 - sW/2) + Math.cos(sAn)*sTh, (gY + gH/2 - sH/2) + Math.sin(sAn)*sTh, sW, sH); 
                        ctx.globalAlpha = 1.0;
                    }
                } 
                else if (pass === 2) {
                    // Pass 3: DRAW THE SURFACE (Everything that is OVER)
                    if (wTop) { 
                        if (waTex && waOp > 0) drawThreadSegment(waTex, gX, gY, gW, gH, true, lc, waOp, waOv, waT, waAO, jit); 
                    } else { 
                        if (wTex && wOp > 0) drawThreadSegment(wTex, gX, gY, gW, gH, false, lr, wOp, wOv, wT, wAO, jit); 
                    }
                }
            }
        }
    }

    return canvas;
};