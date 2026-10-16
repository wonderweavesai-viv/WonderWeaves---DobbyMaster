
export interface QuantizationResult {
  pixels: number[]; // Array of palette indices corresponding to pixels
  palette: string[]; // Array of hex colors
  width: number;
  height: number;
}

const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    return Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2);
};

export const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

export const processImage = (
    img: HTMLImageElement, 
    maxColors: number = 12, 
    maxWidth: number = 400
): QuantizationResult => {
    // 1. Resize logic
    let w = img.width;
    let h = img.height;
    if (w > maxWidth) {
        const ratio = maxWidth / w;
        w = maxWidth;
        h = Math.floor(h * ratio);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get context");
    
    // Draw without smoothing to keep crisp edges if possible
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const pixelCount = w * h;
    const pixels: number[][] = [];

    // Extract RGB arrays
    for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        // Ignore alpha for now, or assume white background
        pixels.push([data[offset], data[offset+1], data[offset+2]]);
    }

    // 2. K-Means Quantization
    // Initialize Centroids (Randomly pick pixels)
    let centroids: number[][] = [];
    for (let i = 0; i < maxColors; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixelCount)]);
    }

    const assignments = new Int32Array(pixelCount);
    let changed = true;
    let iterations = 0;
    const maxIters = 20; // Keep it fast

    while (changed && iterations < maxIters) {
        changed = false;
        const sums = Array.from({ length: maxColors }, () => [0, 0, 0]);
        const counts = new Int32Array(maxColors);

        // Assign pixels to nearest centroid
        for (let i = 0; i < pixelCount; i++) {
            const p = pixels[i];
            let minDist = Infinity;
            let bestIdx = 0;
            
            for (let c = 0; c < maxColors; c++) {
                const cent = centroids[c];
                const d = colorDistance(p[0], p[1], p[2], cent[0], cent[1], cent[2]);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = c;
                }
            }

            if (assignments[i] !== bestIdx) {
                assignments[i] = bestIdx;
                changed = true;
            }
            
            sums[bestIdx][0] += p[0];
            sums[bestIdx][1] += p[1];
            sums[bestIdx][2] += p[2];
            counts[bestIdx]++;
        }

        // Recompute centroids
        for (let c = 0; c < maxColors; c++) {
            if (counts[c] > 0) {
                centroids[c] = [
                    Math.round(sums[c][0] / counts[c]),
                    Math.round(sums[c][1] / counts[c]),
                    Math.round(sums[c][2] / counts[c])
                ];
            } else {
                // Re-initialize empty cluster to a random pixel
                 centroids[c] = pixels[Math.floor(Math.random() * pixelCount)];
            }
        }
        iterations++;
    }

    // 3. Format Result
    const palette = centroids.map(c => rgbToHex(c[0], c[1], c[2]));
    // Deduplicate palette roughly? (Optional optimization)
    
    // Map assignments back to indices
    const resultPixels: number[] = Array.from(assignments);

    return {
        pixels: resultPixels,
        palette,
        width: w,
        height: h
    };
};
