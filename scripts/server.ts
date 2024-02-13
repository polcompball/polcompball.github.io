import type { Optional, RespTuple } from "./types";
import { Ctype, APIActions } from "./enums"
import {
    loadDBEntries, addDBEntry, findDBEntry,
    serveFile, renderPug, HTTPError, retrievePOSTBody
} from "./server-logic";
import * as http from "node:http";
import { Buffer } from "node:buffer";

const HOST = "localhost";
const PORT = 8080;
const BASE_URL = `http://${HOST}:${PORT}`;

async function getData(params: URLSearchParams): Promise<string> {
    const action = params.get("action");
    if (!action) {
        throw new HTTPError("Action not specified", 400, Ctype.JSON);
    }

    switch (action.toLowerCase()) {
        case "get":
            return findDBEntry(params.get("name"));

        case "list":
            return loadDBEntries();

        default:
            throw new HTTPError("Action not implemented", 501, Ctype.JSON);
    }
}

async function postData(params: URLSearchParams, postData: Optional<Buffer>): Promise<string> {
    if (!postData) {
        throw new HTTPError("POST data missing", 400);
    }

    const action = params.get("action");
    if (!action) {
        throw new HTTPError("Action not specified", 400, Ctype.JSON);
    }

    switch (action.toLowerCase()) {
        case "submit":
            return addDBEntry(postData, params.get("override"));

        default:
            throw new HTTPError("Action not implemented", 501, Ctype.JSON);
    }
}

async function handleEndpoint(endpoint: Optional<string>, body: Optional<Buffer>): Promise<RespTuple> {
    const { pathname, searchParams } = new URL(endpoint ?? "/", BASE_URL);

    switch (pathname.toLowerCase()) {
        case "/":
        case "/index":
        case "/index.html":
            return [await serveFile("index.html"), Ctype.HTML, 200];

        case "/script.js":
            return [await serveFile("script.js"), Ctype.JS, 200];

        case "/style.css":
            return [await serveFile("style.css"), Ctype.CSS, 200];

        case "/get":
            return [await getData(searchParams), Ctype.JSON, 200];

        case "/post":
            return [await postData(searchParams, body), Ctype.JSON, 200];

        default:
            return [await serveFile("404.html"), Ctype.HTML, 404];
    }
}


async function handleRequest(req: http.IncomingMessage): Promise<RespTuple> {
    try {
        const postBody = await retrievePOSTBody(req);
        const { url } = req;
        return await handleEndpoint(url, postBody);

    } catch (e: unknown) {
        console.error(e);
        if (e instanceof HTTPError) {
            const { message, status, ctype } = e;
            switch (ctype) {
                case Ctype.HTML:
                    const file = await renderPug("template.pug", { message, status });
                    return [file, Ctype.HTML, status];

                case Ctype.JSON:
                    const body = JSON.stringify({
                        action: APIActions[APIActions.ERROR],
                        message
                    });
                    return [body, Ctype.JSON, status]

                default:
                    return [`/*${message}*/\n`, ctype, status];
            }
        }
        return [await serveFile("500.html"), Ctype.HTML, 500];
    }
}

const server = http.createServer(async (req, resp) => {
    const [respBody, ctype, status] = await handleRequest(req);

    resp.setHeader("Content-Type", ctype);
    resp.writeHead(status);
    resp.end(respBody, "utf-8");
});

server.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
});
