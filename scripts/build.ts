import { promises as fs } from "fs";
import * as path from "path";
import * as terser from "terser";
import * as pug from "pug";
import * as sqlite from "sqlite";
//@ts-ignore
import sqlite3 from "sqlite3";

const params = {
    jsDir: "./dist/",
    jsKeep: ["common"],
    minify: process.argv.some(x => x.toLowerCase() === "--minify"),
    pasedb: process.argv.some(x => x.toLowerCase() === "--parsedb"),
    terserParams: {
        compress: {
            ecma: 2022,
            arrows: true,
            unsafe: true,
            unsafe_arrows: true,
            passes: 2
        },
        mangle: {
            properties: {
                regex: /^_/
            }
        },
        module: true,
        toplevel: true
    }
}

function parseJS(output: terser.MinifyOutput, filename: string): [string, string] {
    const bareName = path.parse(filename).name;
    const { code } = output;
    if (!code) {
        return [bareName, ""];
    }
    const filtCode = code.replaceAll(/\.\/(\w+)\.js/gmi, "./dist/$1.min.js");
    return [bareName, filtCode];
}

async function minifyJS(file: string): Promise<[string, string] | void> {
    const ext = path.extname(file);
    if (ext !== ".js") {
        return;
    }
    const filePath = params.jsDir + file;
    const readFile = await fs.readFile(filePath, { encoding: "utf-8" });
    const minified = await terser.minify(
        readFile, params.terserParams as terser.MinifyOptions
    );
    return parseJS(minified, file);
}

async function minifyAll(files: string[]): Promise<Record<string, string>> {
    const minJS = await Promise.all(
        files.map(minifyJS)
    );

    const fullfilled = minJS.filter(
        x => x
    ) as [string, string][];

    const jsObj = fullfilled.reduce(
        (pv, cv) => ({ ...pv, [cv[0]]: cv[1] })
        , {} as Record<string, string>)

    for (const keep of params.jsKeep) {
        const min = jsObj[keep] ?? "";
        const path = `${params.jsDir}${keep}.min.js`;
        await fs.writeFile(path, min);
    }
    return jsObj;
}

async function renderTemplates(config: Record<string, any>): Promise<any> {
    const viewsDirName = "./src/pug/";

    const fsPromises = [] as Promise<any>[];

    for (const file of await fs.readdir(viewsDirName)) {
        const ext = path.extname(file);
        if (ext === ".pug") {
            const pathName = viewsDirName + file;
            const basename = path.parse(file).name;

            const html = pug.renderFile(pathName, config as pug.Options);
            const pHtml = html.replaceAll(/\n/gm, "").replaceAll(" = ", "=");

            fsPromises.push(
                fs.writeFile(`./${basename}.html`, pHtml)
            );
        }
    }
    return Promise.all(fsPromises);
}

async function loadData(): Promise<Record<string, any>> {
    const dataDirName = "./src/data/";

    const dataObjs = {} as Record<string, any>;

    for (const file of await fs.readdir(dataDirName)) {
        const ext = path.extname(file);
        if (ext === ".json") {
            const pathName = dataDirName + file;
            const fileBuff = await fs.readFile(pathName, { encoding: "utf-8" });

            const basename = path.parse(file).name;
            dataObjs[basename] = JSON.parse(fileBuff);
        }
    }
    return dataObjs;
}

type score = [
    name: string,
    stats: number[]
];

function parseScores(scores: Record<string, any>, keys: string[]): score {
    const stats = keys.map(x => scores[x] as number);
    const { name } = scores as Record<string, string>;

    return [name, stats];
}

async function loadScores(keys: string[]): Promise<score[]> {
    const db = await sqlite.open({
        filename: "./db/scores.db",
        driver: sqlite3.Database
    });

    const users = [] as score[]

    await db.each("SELECT * FROM scores", (err, row) => {
        if (err) console.error(err);
        users.push(parseScores(row, keys));
    });

    return users;
}

type NewQuestion = {
    text: string;
    flags: number;
    effect: number[];
};

async function writeJSON(obj: Record<string, any>): Promise<void> {
    const outdir = "./dist/";

    const values = structuredClone(obj.config.values);
    const keys: string[] = [...values].map(x => x.key);
    const keysToArr = (vals: Record<string, number>): number[] => keys.map(x => vals[x]);

    for (const [k, v] of Object.entries(obj)) {
        switch (k) {
            case "config":
                const newVal = [] as Record<string, any>[];

                for (const val of values) {
                    const nv = structuredClone(val) as Record<string, any>;
                    delete nv.desc;

                    const wl = nv.white_label as [boolean, boolean];
                    nv.white = (Number(wl[0]) << 1) | Number(wl[1]);
                    delete nv.white_label;

                    newVal.push(nv);
                }
                await fs.writeFile(`${outdir}values.json`, JSON.stringify(newVal));
                break;

            case "questions":
                const newQuestions = [] as NewQuestion[];
                for (const q of v) {
                    const text = q.question;
                    const effect = keysToArr(q.effect);
                    const flags = Number(q.yesno) << 1 | Number(q.short);
                    newQuestions.push({ text, effect, flags });
                }

                await fs.writeFile(`${outdir}questions.json`, JSON.stringify(newQuestions));
                break;

            default:
                await fs.writeFile(`${outdir}${k}.json`, JSON.stringify(v));
                break;
        }
    }
}


async function main(): Promise<void> {
    const dataObjs = await loadData();
    console.info(`${Object.keys(dataObjs).length} data objects loaded`);
    let JSObj: Record<string, string> | null = null;

    if (params.minify) {
        const jsDir = await fs.readdir(params.jsDir);
        JSObj = await minifyAll(jsDir);
        console.info(`${Object.keys(JSObj).length} JavaScript files minified`);
    }

    const keys = dataObjs?.config.values.map((x: any) => x.key) as string[];

    await fs.writeFile("./scripts/keys.json", JSON.stringify(keys), { encoding: "utf-8" });

    if (params.pasedb) {
        const users = await loadScores(keys);
        dataObjs.users = users.sort((a, b) => a[0].localeCompare(b[0]));
        console.info(`${users.length} user scores loaded from database`);
    }

    const dataConfig = {
        ...dataObjs,
        version: process.env.npm_package_version,
        size: dataObjs.config.values.length,
        longq: dataObjs.questions.length,
        shortq: dataObjs.questions.filter((x: any) => x.short).length,
        js: JSObj
    };

    await renderTemplates(dataConfig);
    console.info("Templates rendered");
    await writeJSON(dataObjs);
    console.info("Configuration files written");
}

main().catch(
    (err: Error) => {
        console.error(err);
    }
);