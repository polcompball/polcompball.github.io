import { getJson, Canvas, windowPromise, parseScores, currentTheme, parseUsers, orderScores } from "./common.js";
import type { Value, Score, CanvasParams } from "./types";

declare global {
    var VERSION: string;
}

/**
 * Hides half of value bar and border
 * @param outer Outer div of the 
 * value to edit
 * @param side "Left" or "Right" to hide 
 * the bar of.
 */
function hideBar(outer: HTMLDivElement, side: "Left" | "Right"): void {
    outer.style[`border${side}Style`] = "solid";
    outer.style[`borderTop${side}Radius`] = "28pt";
    outer.style[`borderBottom${side}Radius`] = "28pt";
    outer.style[`margin${side}`] = "4px";

    const separator = outer.parentElement?.querySelector(".divider") as HTMLDivElement;
    if (separator) {
        separator.style.display = "none";
    }
}

/**
 * Sets HTML value bar of provided name to the given value.
 * @param name Name of the value to change bar sizes.
 * @param value Percentage to set the bar to.
 * @param right Is value on the right or left side?
 */
function setBarValue(name: string, value: number, right: boolean): void {
    const inner = <HTMLDivElement>document.getElementById(`span-${name}`);
    const outer = <HTMLDivElement>document.getElementById(`bar-${name}`);
    if (!inner || !outer) {
        throw new Error("Expected HTML elements not found");
    }

    const compVal = value > 95 ? 100 : value;
    inner.textContent = `${value.toFixed(1)}%`;
    outer.style.width = `${compVal.toFixed(1)}%`;
    inner.style.display = value > 20 ? "block" : "none";
    outer.style.display = value >= 2 ? "block" : "none";

    if (value > 98) {
        hideBar(outer, right ? "Left" : "Right");
    }
}

/**
 * Lists the closest matches on the webpage
 * and returns the top one's name.
 * @param users Sorted biased users.
 * @returns Top match's name
 */
function addClosestMatches(users: Required<Score>[]): string {
    const matchBias = (1 - users[0].bias) * 100;

    document.getElementById("cmatch")!.textContent =
        `${users[0].name}: ${matchBias.toFixed(1)}%`;

    const otherMatches = document.getElementById("other-matches");

    for (let i = 1; i < 5; i++) {
        const bias = (1 - users[i].bias) * 100;

        const elm = document.createElement("p");
        elm.textContent = `${users[i].name}: ${bias.toFixed(1)}%`;

        otherMatches?.appendChild(elm);
    }
    return users[0].name;
}

/**
 * Draws provided scores on both the
 * HTML value bars and the Canvas.
 * @param canvas Score Canvas instance
 * @param values Values objects in order of use.
 * @param scores Current result's scores
 */
async function drawScores(canvas: Canvas, values: Value[], scores: number[]): Promise<void> {
    for (const [i, value] of values.entries()) {
        const { labels } = value;

        const score = scores[i];
        const revScore = 100 - score;

        setBarValue(labels[0], score, false);
        setBarValue(labels[1], revScore, true);

        const tier = await canvas.drawValue(value, score, i);
        const label = document.getElementById(`${value.name}-label`)!;
        label.textContent = tier;
    }
}


/**
 * Gets the requires values, initializes and mounts all the necessary events.
 */
async function main() {
    const [values, rawUsers, _] = await Promise.all(
        [getJson("values"), getJson("users"), windowPromise]
    );

    const users = parseUsers(rawUsers);
    const params = new URLSearchParams(location.search);

    const
        scores = params.get("score"),
        digest = params.get("digest") ?? "missing",
        edition = params.get("edition") ?? "missing";

    if (!scores) {
        throw new Error("No scores provided");
    }

    const parsedScores = parseScores(scores, values.length);

    document.getElementById("submit-button")!.addEventListener("click", () => {
        const scoreStr = parsedScores.map(x => x.toFixed(1)).join(",");
        const digestStr = digest.replaceAll(" ", "+");

        const parsedParams = new URLSearchParams({
            score: scoreStr,
            digest: digestStr,
            edition
        });

        location.href = `submitter.html?${parsedParams}`;
    });

    const sortedUsers = orderScores(parsedScores, users);
    const closestUser = addClosestMatches(sortedUsers);

    const canvasElm = <HTMLCanvasElement>document.getElementById("banner");

    const [fg, bg] = currentTheme() === "dark" ? ["#EEE", "#333"] : ["#333", "#EEE"];

    const canvasParams: CanvasParams = {
        fg, bg,
        height: 1000,
        width: 800,
        font: "Andika"
    };

    const short = edition.toLowerCase().startsWith("s");

    const canvas = new Canvas(canvasElm, canvasParams);
    canvas.drawHeader({
        version: globalThis.VERSION,
        edition: (short ? "Short" : "Full") + " Edition",
        gallery: false,
        user: closestUser,
        basetext: "Taken"
    });
    await drawScores(canvas, values, parsedScores);

    document.getElementById("download-button")?.addEventListener("click", () => {
        Canvas.download(canvasElm);
    });
}

main().catch((err: Error) => {
    console.error(err);
    alert(err.toString());
});