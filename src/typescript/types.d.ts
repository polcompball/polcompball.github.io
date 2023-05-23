export type Question = {
    text: string;
    flags: number;
    effect: number[];
}

export type Value = {
    name: string;
    key: string;
    labels: [string, string];
    icons: [string, string];
    color: [string, string];
    white: number;
    tiers: string[];
}

export type Score = {
    name: string;
    bias?: number;
    stats: number[];
}

export type CanvasParams = {
    fg: string;
    bg: string;
    height: number;
    width: number;
    font: string;
}