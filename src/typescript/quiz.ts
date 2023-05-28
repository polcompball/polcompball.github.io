import { getJson, windowPromise } from "./common.js";
import { Question, Value } from "./types";

const questionNumber = <HTMLHeadingElement>document.getElementById("question-number")!;
const questionText = <HTMLParagraphElement>document.getElementById("question-text")!;

class Quiz {
    private _index: number;
    private _questions: Question[];
    private _scores: number[];
    private _short: boolean;

    constructor(questions: Question[], short: boolean) {
        this._index = 0;
        this._questions = questions;
        this._scores = Array(this._questions.length).fill(0);
        this._short = short;
    }

    get index(): number {
        return this._index + 1;
    }

    get size(): number {
        return this._questions.length;
    }

    get yesno(): boolean {
        return Boolean(this._questions[this._index].flags & 0b10);
    }

    get text(): string {
        return this._questions[this._index].text;
    }

    nextQuestion(weight: number): boolean {
        this._scores[this._index] = weight;
        return ++this._index < this._questions.length;
    }

    previousQuestion(): boolean {
        return --this._index > 0;
    }

    async getScores(): Promise<string> {
        const len = this._questions[0].effect.length;

        const rawScores = this._questions.map((q, i) =>
            q.effect.map(k => this._scores[i] * k)
        ).reduce((cv, pv) =>
            pv.map((x, i) => cv[i] + x),
            Array(len).fill(0) as number[]
        );

        const maxScores = this._questions.map(q =>
            q.effect.map(Math.abs)
        ).reduce((cv, pv) =>
            pv.map((x, i) => cv[i] + x),
            Array(len).fill(0) as number[]
        );

        const finalScores = maxScores.map(
            (m, i) => Math.abs(100 * (m + rawScores[i]) / (2 * m))
        );

        if (finalScores.some(x => x > 100 || x < 0 || isNaN(x))) {
            throw new Error("Invalid scores");
        }

        const scoreStr = finalScores.map(x => x.toFixed(1)).join(",");
        const scoreBytes = (new TextEncoder).encode(scoreStr);
        const scoreDigest = await crypto.subtle.digest("SHA-512", scoreBytes);
        const digestStr = String.fromCharCode(... new Uint8Array(scoreDigest));

        const params = new URLSearchParams([
            ["score", scoreStr],
            ["digest", btoa(digestStr)],
            ["edition", this._short ? "s" : "f"]
        ]);
        return `results.html?${params}`;
    }
}

function renderQuestion(quiz: Quiz, elements: HTMLElement[]): void {
    questionNumber.textContent = `Question ${quiz.index} of ${quiz.size}`;
    questionText.innerHTML = quiz.text;
    for (const [i, elm] of elements.entries()) {
        if (quiz.yesno) {
            switch (i) {
                case 0:
                    elm.textContent = "Yes";
                    break;
                case 4:
                    elm.textContent = "No";
                    break;
                default:
                    elm.style.display = "none";
            }
        } else {
            switch (i) {
                case 0:
                    elm.textContent = "Strongly Agree";
                    break;
                case 4:
                    elm.textContent = "Strongly Disagree";
                    break;
                default:
                    elm.style.display = "block";
            }
        }
    }
}

function main(questions: Question[], values: Value[], short: boolean, random: boolean): void {
    const keys = ["stag", "ag", "neut", "disag", "stdisag"];

    const parsedQuestions = short ? questions.filter(x => x.flags & 0b01) : questions;
    const randQuestions = random ? parsedQuestions.sort(() => 0.5 - Math.random()) : parsedQuestions;
    const quiz = new Quiz(randQuestions, short);

    const elements = keys.map(v => document.getElementById(`button-${v}`)!);

    for (const [i, elm] of elements.entries()) {
        const weight = (2 - i) / 2;
        elm.addEventListener("click", () => {
            if (quiz.nextQuestion(weight)) {
                renderQuestion(quiz, elements);
            } else {
                quiz.getScores().then(
                    score => location.href = score
                );
            }
        });
    }

    document.getElementById("back-button")!
        .addEventListener("click", () => {
            if (quiz.previousQuestion()) {
                renderQuestion(quiz, elements);
            } else {
                window.history.back();
            }
        });

    renderQuestion(quiz, elements);
}

(async () => {
    const [questions, values, _] = await Promise.all(
        [getJson<Question[]>("questions"), getJson<Value[]>("values"), windowPromise]
    );

    const urlChar = [...location.search.toLowerCase()];

    const short = urlChar.some(x => x === "s");
    const random = urlChar.some(x => x === "r");

    main(questions, values, short, random);
})()