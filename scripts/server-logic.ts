import type { Optional, Score } from "./types";
import { Ctype, APIActions } from "./enums";
import type * as http from "node:http"
import { promises as fs } from "fs";
import * as pug from "pug";
import * as sqlite from "sqlite";
//@ts-ignore
import sqlite3 from "sqlite3";

export class HTTPError extends Error {
    status: number;
    ctype: Ctype;
    constructor(message: string, status: number = 500, ctype: Ctype = Ctype.HTML) {
        super(message);
        this.status = status;
        this.name = `HTTPError (Status:${status})`;
        this.ctype = ctype;
    }

    static fromError(e: unknown, ctype: Ctype): HTTPError {
        if (e instanceof Error) {
            return new HTTPError(e.message, 500, ctype);
        }
        return new HTTPError(String(e), 500, ctype);
    }
}

const DB_PATH = "./db/scores.db";
const KEY_PATH = "./scripts/keys.json";

function parseScores(scores: Record<string, any>, keys: string[]): Score {
    const values = keys.map(x => scores[x] as number);
    const { name } = scores as Record<string, string>;

    return { name, values };
}

class DataBase {
    db: sqlite.Database;
    keys: string[];

    constructor(db: sqlite.Database, keys: string[]) {
        this.db = db;
        this.keys = keys;
    }

    static async load(): Promise<DataBase> {
        const db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });
        const keys = await fs.readFile(KEY_PATH, { encoding: "utf-8" });

        return new DataBase(db, JSON.parse(keys) as string[]);
    }

    async loadAll(): Promise<Score[]> {
        const users = [] as Score[];

        let errored = false;

        await this.db.each("SELECT * FROM scores", (err, row) => {
            if (err) {
                errored = true;
            } else {
                users.push(parseScores(row, this.keys));
            }
        });

        if (errored) {
            throw new HTTPError("Error fetching value from Database", 400, Ctype.JSON);
        }

        return users;
    }

    async find(name: string): Promise<Optional<Score>> {
        try {
            const user = await this.db.get(
                "SELECT * FROM scores WHERE name=?", [name]
            ) as Optional<Record<string, any>>;

            if (user) {
                return parseScores(user, this.keys);
            }
            return null;
        } catch (e: unknown) {
            throw HTTPError.fromError(e, Ctype.JSON);
        }
    }

    async add(name: string, scores: number[]): Promise<void> {
        if (scores.length !== 7) {
            throw new HTTPError("Invalid scores", 400, Ctype.JSON);
        }

        try {
            await this.db.run(
                "INSERT OR REPLACE INTO scores VALUES(?,?,?,?,?,?,?,?)",
                [name, ...scores]
            );
        } catch (e: unknown) {
            throw HTTPError.fromError(e, Ctype.JSON);
        }
    }
}

function parseURLBool(value: Optional<string>): boolean {
    if (value === undefined || value === null) {
        return false;
    }

    if (value.toLowerCase() === "false") {
        return false;
    }

    return true;
}


export async function loadDBEntries(): Promise<string> {
    const db = await DataBase.load();
    const scores = await db.loadAll();

    return JSON.stringify({
        action: APIActions[APIActions.SUCCESS],
        message: "",
        extra: {
            scores
        }
    });
}

export async function addDBEntry(
    data: Buffer, override: Optional<string> = null
): Promise<string> {
    const overrideFlag = parseURLBool(override);
    const userString = data.toString("utf-8");

    const { name, values } = JSON.parse(userString) as Score;
    console.log(name, values)

    if (typeof name !== "string") {
        throw new HTTPError("Invalid name", 400, Ctype.JSON);
    }

    if (!(values instanceof Array) || values.some(x => typeof x !== "number")) {
        throw new HTTPError("Invalid scores", 400, Ctype.JSON);
    }

    const db = await DataBase.load();

    const existentUser = await db.find(name);

    if (existentUser && !overrideFlag) {
        return JSON.stringify({
            action: APIActions[APIActions.CONFIRM],
            message: `User ${name} already exists in the database, do you want to override the last score?`,
            extra: {
                score: existentUser
            }
        });
    }

    await db.add(name, values);

    return JSON.stringify({
        action: APIActions[APIActions.SUCCESS],
        message: "User sucessfully inserted into the database"
    });
}

export async function findDBEntry(name: Optional<string>): Promise<string> {
    if (!name) {
        throw new HTTPError("Missing name to find in Database", 400, Ctype.JSON);
    }

    const db = await DataBase.load();
    const user = await db.find(name.trim());

    if (user) {
        return JSON.stringify({
            action: APIActions[APIActions.SUCCESS],
            message: "Found user in database with the provided name",
            extra: {
                score: user
            }
        });
    }

    return JSON.stringify({
        action: APIActions[APIActions.FAILURE],
        message: "No user found in database with provided name",
    });
}

export function serveFile(fileName: string): Promise<string> {
    const fullPath = `./scripts/static/${fileName}`;
    return fs.readFile(fullPath, { encoding: "utf-8" });
}

export async function renderPug(
    filename: string, locals: pug.LocalsObject = {}, options: pug.Options = {}
): Promise<string> {
    const file = await fs.readFile(
        `./scripts/webui-src/${filename}`,
        { encoding: "utf-8" }
    );
    return pug.compile(file, options)(locals);
}

export function retrievePOSTBody(req: http.IncomingMessage): Promise<Optional<Buffer>> {
    return new Promise((res, rej) => {
        if (req.method === "POST") {
            const dataChunks = [];

            req.on("data", data => {
                dataChunks.push(data);
            });

            req.on("end", () => {
                res(Buffer.concat(dataChunks));
            });

            req.on("error", rej);

        } else {
            res(null);
        }
    });
}