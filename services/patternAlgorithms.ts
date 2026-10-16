
export const generateOmbre = (charA: string, charB: string, steps: number): string => {
    let result = "";
    // Simple linear transition: 4A 1B, 3A 2B, 2A 3B, 1A 4B
    
    for (let i = 0; i <= steps; i++) {
        const countA = Math.max(0, steps - i);
        const countB = Math.max(0, i);
        
        // Skip 0 counts to keep pattern clean
        if (countA > 0) result += `${countA}${charA}`;
        if (countB > 0) result += `${countB}${charB}`;
    }
    
    return result;
};

export const generateFibonacci = (chars: string[], limit: number): string => {
    if (chars.length === 0) return "";
    
    // 1, 1, 2, 3, 5, 8, 13, 21, 34, 55...
    const fib = [1, 1];
    while (true) {
        const next = fib[fib.length - 1] + fib[fib.length - 2];
        if (next > limit) break;
        fib.push(next);
    }
    
    let result = "";
    fib.forEach((count, index) => {
        const char = chars[index % chars.length];
        result += `${count}${char}`;
    });
    
    return result;
};

export const generateRandomStripe = (chars: string[], totalThreads: number, minWidth: number, maxWidth: number): string => {
    if (chars.length === 0) return "";
    let currentThreads = 0;
    let result = "";
    
    while (currentThreads < totalThreads) {
        // Pick random char
        const char = chars[Math.floor(Math.random() * chars.length)];
        
        // Pick random width
        let width = Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth;
        
        // Cap at total
        if (currentThreads + width > totalThreads) {
            width = totalThreads - currentThreads;
        }
        
        if (width > 0) {
            result += `${width}${char}`;
            currentThreads += width;
        }
    }
    
    return result;
};
