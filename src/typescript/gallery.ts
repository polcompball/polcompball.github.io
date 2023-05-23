import { Canvas, getJson, currentTheme, windowPromise } from "./common.js";
import type { Value, Score, CanvasParams } from "./types";

declare global {
    var VERSION: string;
}

function getColorScheme(): [string, string] {
    const dark = currentTheme() === "dark";
    return dark ? ["#EEE", "#333"] : ["#333", "#EEE"];
}

function drawScores(canvas: Canvas, score: Score, values: Value[], images = false): void {
    canvas.clearFields();
    canvas.drawHeader({
        version: globalThis.VERSION,
        edition: "User Gallery",
        gallery: true,
        user: score.name
    });

    const [fg, bg] = getColorScheme();

    canvas.params.fg = fg;
    canvas.params.bg = bg;

    for (const [i, s] of score.stats.entries()) {
        canvas.drawValue(values[i], s, i, images);
    }

}

function prepareDropdown(dropDown: HTMLSelectElement, users: Score[]): void {
    const createOption = (user: Score, index: number) => {
        const option = document.createElement("option");
        option.value = index.toFixed();
        option.textContent = user.name;
        return option;
    };

    const options = users.map(createOption);

    for (const opt of options) {
        dropDown.appendChild(opt);
    }
}

async function main(): Promise<void> {
    const [values, users, _] = await Promise.all(
        [getJson<Value[]>("values"), getJson<Score[]>("users"), windowPromise]
    );

    const [fg, bg] = getColorScheme();
    const params: CanvasParams = {
        bg, fg,
        height: 1000,
        width: 800,
        font: "Andika"
    }

    const canvasElm = <HTMLCanvasElement>document.getElementById("banner");
    const canvas = new Canvas(canvasElm, params);

    const dropDown = <HTMLSelectElement>document.getElementById("userdropdown");
    prepareDropdown(dropDown, users);
    drawScores(canvas, users[0], values, true);
    dropDown.addEventListener("change", () => {
        const i = dropDown.selectedIndex;
        drawScores(canvas, users[i], values);
    })
}

main().catch((err: Error) => {
    console.error(err);
});
