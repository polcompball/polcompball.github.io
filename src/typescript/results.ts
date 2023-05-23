import { getJson, Canvas, windowPromise, parseScores, currentTheme } from "./common.js"
import type { Value, Score, CanvasParams } from "./types";

declare global {
    var VERSION: string;
}

function setBarValue(name: string, value: number, right: boolean): void {
    const inner = document.getElementById(`span-${name}`);
    const outer = document.getElementById(`bar-${name}`);
    if (!inner || !outer) {
        throw new Error("Expected HTML elements not found");
    }
    const adjVal = value > 95 ? 100 : value;
    inner.textContent = `${value.toFixed(1)}%`;
    outer.style.width = `${adjVal.toFixed(1)}%`;
    inner.style.display = value > 20 ? "block" : "none";
    outer.style.display = value >= 2 ? "block" : "none";

    if (value > 98) {
        const side = right ? "Left" : "Right";
        outer.style[`border${side}Style`] = "solid";
        outer.style[`borderTop${side}Radius`] = "28pt";
        outer.style[`borderBottom${side}Radius`] = "28pt";
        outer.style[`margin${side}`] = "4px";
    }
}

function orderScores(score: number[], users: Score[]): Score[] {
    const ordered = [] as Score[];

    for (const user of users) {
        let sum = 0;
        for (const [i, stat] of user.stats.entries()) {
            const delta = Math.abs(score[i] - stat);
            sum += (delta / 100) ** 3;
        }
        ordered.push({
            ...user,
            bias: sum / user.stats.length
        });
    }

    return ordered.sort((a, b) => a.bias! - b.bias!);
}


function addClosestMatches(users: Score[]): string {
    const matchBias = (1 - (users[0]?.bias ?? 1)) * 100;

    document.getElementById("cmatch")!.textContent =
        `${users[0].name}: ${matchBias.toFixed(1)}%`;

    const otherMatches = document.getElementById("other-matches");

    for (let i = 1; i < 5; i++) {
        const bias = (1 - (users[i]?.bias ?? 0)) * 100;
        const userName = users[i]?.name ?? "Missing";

        const elm = document.createElement("p");
        elm.textContent = `${userName}: ${bias.toFixed(1)}%`

        otherMatches?.appendChild(elm);
    }
    return users[0].name;
}

async function drawScores(canvas: Canvas, values: Value[], scores: number[]): Promise<void> {
    for (const [i, value] of values.entries()) {
        const { labels, color, white } = value;

        const score = scores[i];
        const revScore = 100 - score;

        setBarValue(labels[0], score, false);
        setBarValue(labels[1], revScore, true);

        const tier = await canvas.drawValue(value, score, i);
        const label = document.getElementById(`${value.name}-label`)!;
        label.textContent = tier;
    }
}


async function main() {
    const [values, users, _] = await Promise.all(
        [getJson<Value[]>("values"), getJson<Score[]>("users"), windowPromise]
    );


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
    }

    document.getElementById("download-button")!.addEventListener("click", () => {
        Canvas.download(canvasElm);
    })

    const short = edition.toLowerCase().startsWith("s");

    const canvas = new Canvas(canvasElm, canvasParams);
    canvas.drawHeader({
        version: globalThis.VERSION,
        edition: (short ? "short" : "full") + " edition",
        gallery: false,
        user: closestUser
    });
    await drawScores(canvas, values, parsedScores);
}

main().catch((err: Error) => {
    console.error(err);
    alert(err.toString());
});