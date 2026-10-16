
export const downloadFile = (data: string, filename: string, mimeType: string = 'application/json') => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Fix: Made file parameter optional to support environments where a native picker might be used without passing a File object directly
export const loadFile = (file?: File): Promise<string> => {
    if (!file) {
        return Promise.resolve("");
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

export const serializeGrid = (grid: boolean[][]): number[][] => {
    return grid.map(row => row.map(cell => cell ? 1 : 0));
};

export const deserializeGrid = (grid: number[][]): boolean[][] => {
    return grid.map(row => row.map(cell => cell === 1));
};