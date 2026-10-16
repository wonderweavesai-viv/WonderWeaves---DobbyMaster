export const parsePatternString = (patternStr: string, colorMap: { [key: string]: string }): string[] => {
  const result: string[] = [];
  const regex = /(\d+)([A-Z])/gi;
  let match;

  const validationRegex = /^((\d+)([A-Z]))*$/i;
  if (!validationRegex.test(patternStr.trim())) {
    return [];
  }

  while ((match = regex.exec(patternStr)) !== null) {
    const count = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    const color = colorMap[letter];

    if (color) {
      for (let i = 0; i < count; i++) {
        result.push(color);
      }
    }
  }

  return result;
};

export const getTotalThreads = (patternStr: string): number => {
    const regex = /(\d+)([A-Z])/gi;
    let match;
    let total = 0;
    while ((match = regex.exec(patternStr)) !== null) {
        total += parseInt(match[1], 10);
    }
    return total;
};

export const expandPatternString = (patternStr: string): string[] => {
    const result: string[] = [];
    const regex = /(\d+)([A-Z])/gi;
    let match;

    const validationRegex = /^((\d+)([A-Z]))*$/i;
    if (!validationRegex.test(patternStr.trim())) return [];

    while ((match = regex.exec(patternStr)) !== null) {
        const count = parseInt(match[1], 10);
        const letter = match[2].toUpperCase();
        for (let i = 0; i < count; i++) {
            result.push(letter);
        }
    }
    return result;
};

export const compressPatternString = (chars: string[]): string => {
    if (chars.length === 0) return "";
    let result = "";
    let count = 0;
    let currentChar = chars[0];

    for (let i = 0; i < chars.length; i++) {
        if (chars[i] === currentChar) {
            count++;
        } else {
            result += `${count}${currentChar}`;
            currentChar = chars[i];
            count = 1;
        }
    }
    result += `${count}${currentChar}`;
    return result;
};

/**
 * Scales a pattern string (e.g. 18A18B) by a ratio and rounds to a multiple.
 * Used for "Squaring" check patterns when EPI and PPI differ.
 */
export const scalePatternString = (patternStr: string, ratio: number, roundTo: number = 2): string => {
    const regex = /(\d+)([A-Z])/gi;
    let match;
    let result = "";

    while ((match = regex.exec(patternStr)) !== null) {
        const originalCount = parseInt(match[1], 10);
        const char = match[2].toUpperCase();
        
        // Calculate new count based on ratio
        let newCount = originalCount * ratio;
        
        // Round to nearest multiple of roundTo
        newCount = Math.round(newCount / roundTo) * roundTo;
        
        // Minimum count of at least 'roundTo' to prevent zeroing out parts of the design
        if (newCount < roundTo && originalCount > 0) newCount = roundTo;
        
        if (newCount > 0) {
            result += `${newCount}${char}`;
        }
    }

    return result;
};

// Added GCD and LCM functions to fix the import error in DobbyMaster.tsx
/**
 * Calculates the Greatest Common Divisor of two numbers.
 */
export const gcd = (a: number, b: number): number => {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        a %= b;
        [a, b] = [b, a];
    }
    return a;
};

/**
 * Calculates the Least Common Multiple of two numbers.
 */
export const lcm = (a: number, b: number): number => {
    if (a === 0 || b === 0) return 0;
    return Math.abs(a * b) / gcd(a, b);
};