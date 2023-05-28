import { parseScores } from "./common.js";

type Animate = "success" | "failure";

type LottiePlayer = HTMLElement & {
    play: () => void;
    load: (url: string) => void;
    loop: boolean;
};

declare global {
    var VERSION: string;
    var API_URL: string;
    var SIZE: number;
}

const files = {
    "success": "./assets/85185-checkmark.json",
    "failure": "./assets/94303-failed.json",
    "loading": "./assets/124239-loading-bouncy.json"
};

let lock = false;
let count = 0;
const player = <LottiePlayer>document.querySelector("lottie-player")!;
const name = <HTMLInputElement>document.getElementById("name")!;

function downloadScores(scores: string): void {
    if (confirm("Automatic submission of your scores failed, do you wish to download a copy of the scores to submit manually to the developers?")) {
        const link = document.createElement("a");
        link.href = `data:text/json;charset=utf-8,${encodeURIComponent(scores)}`;
        link.download = "scores.json";
        link.click();
    }
}

function playAnimation(animate: Animate, scores: string | null = null): void {
    player.load(files[animate]);
    player.style.display = "block";
    player.loop = false;
    player.play();

    const listener = () => {
        player.style.display = "none";
        player.removeEventListener("complete", listener);
        if (scores) {
            downloadScores(scores);
        }
    }
    player.addEventListener("complete", listener);
}

function checkUsername(userName: string): string {
    const trimmed = userName.trim();
    if (trimmed.length === 0) {
        const user = prompt("You did not enter a username, please enter one and submit.");
        return checkUsername(user ?? "");
    } else {
        return trimmed;
    }
}

function getUrlParams(): [e: string, d: string, v: string] {
    const urlParams = new URLSearchParams(location.search);

    const edition = urlParams.get("edition") ?? "missing";
    const digest = decodeURIComponent(urlParams.get("digest") ?? "missing");
    const rawVals = decodeURIComponent(urlParams.get("score") ?? "missing");

    return [edition, digest, rawVals];
}

async function sendScores(userName: string): Promise<void> {

    const urlParams = getUrlParams();

    const bodyObj = {
        name: userName,
        vals: parseScores(urlParams[2], globalThis.SIZE),
        edition: urlParams[0],
        digest: urlParams[1],
        version: globalThis.VERSION
    };

    const body = JSON.stringify(bodyObj);

    localStorage.setItem("last-submittion", body);

    const controller = new AbortController();
    const timeOut = setTimeout(
        () => controller.abort(), 10_000
    );

    const params: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        signal: controller.signal,
        body
    };

    player.load(files["loading"]);
    player.style.display = "block";
    player.loop = true;
    player.play();

    const res = await fetch(globalThis.API_URL, params);
    const data = await res.json();

    if (!data.success) {
        throw new Error("Failed to submit scores");
    }

    count++;
    clearTimeout(timeOut);
    playAnimation("success");
}

function sendMessage(): void {
    if (lock) {
        return;
    }
    lock = true;

    const userName = checkUsername(name.value);;
    if (count > 0) {
        if (!confirm("You already submitted your scores, do you wish to submit a new time?")) {
            return;
        }
    } else {
        if (!confirm(`Do you confirm you wish to submit your scores under the name of "${userName}"?`)) {
            return;
        }
    }
    sendScores(userName)
        .then(() => {
            lock = false;
        })
        .catch((err: Error) => {
            lock = false;
            console.error(err);
            const scores = localStorage.getItem("last-submittion");
            playAnimation("failure", scores);
        });
}

document.getElementById("name")?.addEventListener("keydown", (key) => {
    if (key.key === "Enter") {
        key.preventDefault();
        sendMessage();
    }
});

document.getElementById("send-button")?.addEventListener("click", () => {
    sendMessage();
});

window.addEventListener("load", () => {
    const lastSub = localStorage.getItem("last-submittion");
    if (!lastSub) {
        return;
    }
    const data = JSON.parse(lastSub).vals as number[];
    if (!data) {
        return;
    }
    const scores = parseScores(getUrlParams()[2], globalThis.SIZE);
    const match = scores.every((x, i) => x === data[i]);
    if (match) {
        alert("You already submitted this score before");
    }
});