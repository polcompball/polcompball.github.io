type Jsons = "questions" | "users" | "values";
import type { Value, CanvasParams } from "./types"

export const windowPromise = new Promise<void>(
    res => {
        window.addEventListener("load", () => res());
    }
);

type Theme = "light" | "dark";

export function currentTheme(): Theme {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return dark ? "dark" : "light";
}

export async function getJson<T>(path: Jsons): Promise<T> {
    const filePath = `./dist/${path}.json`;
    const resp = await fetch(filePath);
    if (resp.status > 299) {
        throw new Error(`Error in requesting file, status:${resp.status}`);
    }
    const contentType = resp.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("application/json")) {
        throw new Error(`Invalid mime type for response, expected application/json, got ${contentType}`);
    }
    return resp.json() as T;
}

export function parseScores(scoreString: string, count: number): number[] {
    const decoded = decodeURIComponent(scoreString);
    const numberScores = decoded.split(",").map(x => parseFloat(x));

    const overBounds = numberScores.some(v => v > 100 || v < 0 || isNaN(v));

    if (numberScores.length !== count || overBounds) {
        throw new Error("Invalid scores");
    }

    return numberScores;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = `./assets/values/${url}`;
    return new Promise<HTMLImageElement>((res, rej) => {
        img.addEventListener("load", () => res(img));
        img.addEventListener("abort", rej);
        img.addEventListener("error", rej);
    });
}

function capitalize(input: string): string {
    return input.charAt(0).toUpperCase() + input.slice(1);
}

export class Canvas {
    private _ctx: CanvasRenderingContext2D;
    params: CanvasParams;
    constructor(canvas: HTMLCanvasElement, params: CanvasParams) {
        canvas.width = params.width;
        canvas.height = params.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get canvas context");
        }
        this._ctx = ctx;
        this.params = params;

        this._ctx.fillStyle = this.params.bg;
        this._ctx.fillRect(0, 0, this.params.width, this.params.height);
    }

    private _drawValueBg(height: number): void {
        this._ctx.strokeStyle = "#000";
        this._ctx.lineJoin = "round";
        this._ctx.lineWidth = 75;
        this._ctx.fillStyle = "#222222";
        this._ctx.strokeRect(165, 50 + height, 470, 0);
    }

    private _drawHalfCircle(x: number, y: number, r: number, color: string, reverse: boolean): void {
        const [s, e] = reverse ? [1.5, 0.5] : [0.5, 1.5];
        this._ctx.fillStyle = color;
        this._ctx.beginPath();
        this._ctx.arc(x, y, r, s * Math.PI, e * Math.PI);
        this._ctx.fill();
    }

    private _drawScoreRect(value: Value, score: number, index: number): void {
        this._ctx.lineWidth = 65;
        const height = 220 + index * 120;
        const [v1, v2] = value.color;
        const [c1, c2] = score > 98 ? [v1, v1] : score < 2 ? [v2, v2] : [v1, v2];
        //Draw ends
        this._drawHalfCircle(166, height, 32, c1, false);
        this._drawHalfCircle(634, height, 32, c2, true);
        //Draw bars
        const extra = score > 98 || score < 2 ? 6 : 0;
        const gap = Math.max(Math.min(score, 98), 2) - 2;
        const ratio = 4.82 * gap;
        this._ctx.fillStyle = c1;
        this._ctx.fillRect(166, height - 32, ratio + extra, 64);
        this._ctx.fillStyle = c2;
        this._ctx.fillRect(172 + ratio, height - 32, (464 - ratio), 64);
    }

    private _drawScoreLabel(value: Value, score: number, index: number): string {
        this._ctx.font = `32px '${this.params.font}', sans-serif`;
        const height = index * 120 + 232.5;

        if (score == null || score > 100 || score < 0) {
            throw new Error(`Invalid score: ${score}`);
        }

        const w = value.white;
        const whiteLabel = [w & 0b10, w & 0b01];

        if (score > 20) {
            this._ctx.fillStyle = whiteLabel[0] ? "#FFF" : "#000";
            this._ctx.textAlign = "left";
            this._ctx.fillText(score.toFixed(1) + "%", 150, height);
        }


        if (score < 80) {
            this._ctx.fillStyle = whiteLabel[1] ? "#FFF" : "#000";
            this._ctx.textAlign = "right";
            this._ctx.fillText((100 - score).toFixed(1) + "%", 650, height);
        }


        this._ctx.fillStyle = this.params.fg;
        this._ctx.textAlign = "center";
        this._ctx.font = `bold 30px '${this.params.font}', sans-serif`
        const name = capitalize(value.name);
        const tier = Canvas.findTier(score, value.tiers);
        const tierName = `${name} Axis: ${tier}`;
        this._ctx.fillText(tierName, 400, 170 + index * 120, 550);
        return tier;
    }

    clearFields(): void {
        this._ctx.fillStyle = this.params.bg;
        this._ctx.fillRect(126, 130, 550, 1000);
        this._ctx.fillRect(0, 0, 800, 150);
    }

    async drawValue(value: Value, score: number, index: number, drawImages = true): Promise<string> {
        const height = 170 + index * 120;

        this._drawValueBg(height);
        this._drawScoreRect(value, score, index);
        const tier = this._drawScoreLabel(value, score, index);
        if (drawImages) {
            const { icons } = value;
            const [l, r] = await Promise.all(
                icons.map(loadImage)
            );
            this._ctx.drawImage(l, 20, height, 100, 100);
            this._ctx.drawImage(r, 680, height, 100, 100);
        }
        return tier;
    }

    drawHeader(params: Record<string, any>): void {
        this._ctx.fillStyle = this.params.fg
        this._ctx.font = `700 50px '${this.params.font}', sans-serif`
        this._ctx.textAlign = "left"
        this._ctx.fillText("PCBvalues", 20, 90)

        this._ctx.font = `30px '${this.params.font}', sans-serif`
        const user = !params.gallery ?
            "Closest Match: " + params.user : params.user;
        this._ctx.fillText(user, 20, 130, 480)

        this._ctx.textAlign = "right"
        this._ctx.font = `300 25px '${this.params.font}', sans-serif`
        this._ctx.fillText("pcbvalues.github.io", 780, 40)
        this._ctx.fillText(params.version, 780, 70)
        this._ctx.fillText(params.edition, 780, 100)

        const date = (new Date()).toLocaleDateString("en-GB");
        const text = `${params.gallery ? "Viewed" : "Taken"} on ${date}`;
        this._ctx.fillText(text, 780, 130);
    }

    static findTier(score: number, tiers: string[]): string {
        const index = Math.floor((100 - score) / 100 * tiers.length);
        return tiers[index] ?? tiers.at(-1);
    }

    static download(canvas: HTMLCanvasElement): void {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "PCBValues.png";
        link.click();
        link.remove();
    }
}
