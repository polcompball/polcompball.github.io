const jsonInput = document.getElementById("json-input");
const submitButton = document.getElementById("submit-button");
const listButton = document.getElementById("list-button");
const clearButton = document.getElementById("clear-button");
const overrideCheckbox = document.getElementById("override-checkbox");
const clearCheckbox = document.getElementById("clear-checkbox");
const dialog = document.getElementById("dialog-popup");
const dialogContents = document.getElementById("dialog-content");
const dialogClose = document.getElementById("dialog-close");
class JsonReq {
    static async request(endpoint, params, options = {}) {
        const urlParams = new URLSearchParams(params);
        const finalUrl = `/${endpoint}?${urlParams}`;
        const resp = await fetch(finalUrl, options);
        const ctype = resp.headers.get("Content-Type");
        if (!ctype || !ctype.startsWith("application/json")) {
            throw new Error(`Invalid content type, expected application/json, got ${ctype}`);
        }
        if (resp.status > 299) {
            throw new Error(`Recieved error response code: ${resp.status}, ${resp.statusText}`);
        }
        return resp;
    }
    static async get(params) {
        const resp = await this.request("get", params);
        return resp.json();
    }
    static async post(params, body) {
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        };
        const resp = await this.request("post", params, options);
        return resp.json();
    }
}
function validateScores(scores) {
    if (typeof scores !== "object" || scores === null) {
        return false;
    }
    const { name, values } = scores;
    if (!name || typeof name !== "string") {
        return false;
    }
    if (values && values instanceof Array) {
        for (const i of values) {
            if (typeof i !== "number" || i < 0 || i > 100) {
                return false;
            }
        }
        return true;
    }
    return false;
}
function openDialog(contents) {
    if (dialog.open) {
        return;
    }
    while (dialogContents.children.length) {
        dialogContents.removeChild(dialogContents.lastChild);
    }
    dialogContents.appendChild(contents);
    dialog.showModal();
}
function confirmDialog(text) {
    const parent = document.createElement("div");
    const textElm = document.createElement("p");
    textElm.textContent = text;
    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Yes";
    confirmButton.classList.add("left-button");
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "No";
    cancelButton.classList.add("right-button");
    parent.append(textElm, confirmButton, cancelButton);
    openDialog(parent);
    let resolved = false;
    return new Promise((res, _rej) => {
        dialog.addEventListener("close", () => {
            if (!resolved) {
                res(false);
            }
        });
        confirmButton.addEventListener("click", () => {
            resolved = true;
            res(true);
            dialog.close();
        });
        cancelButton.addEventListener("click", () => {
            resolved = true;
            res(false);
            dialog.close();
        });
    });
}
const API = {
    submit: async function (scores, override) {
        const data = JSON.parse(scores);
        if (!validateScores(data)) {
            return;
        }
        const resp = await JsonReq.post({
            action: "submit", override: String(override)
        }, data);
        switch (resp.action) {
            case "CONFIRM":
                const promptResp = await confirmDialog(resp.message);
                if (promptResp) {
                    return API.submit(scores, true);
                }
                break;
            case "SUCCESS":
                if (clearCheckbox.checked) {
                    jsonInput.value = "";
                }
                const elm = document.createElement("div");
                elm.textContent = resp.message;
                openDialog(elm);
                break;
            case "ERROR":
            case "FAILURE":
                throw new Error(resp.message);
        }
    },
    list: async function () {
        const resp = await JsonReq.get({
            action: "list"
        });
        const parent = document.createElement("div");
        parent.classList.add("list-container");
        function generateList(name, values) {
            const child = document.createElement("div");
            child.classList.add("list-elm");
            const nameSpan = document.createElement("span");
            nameSpan.textContent = name;
            nameSpan.classList.add("left-align");
            const valuesSpan = document.createElement("span");
            valuesSpan.innerHTML = values.map(x => x.padStart(5).replaceAll(" ", "&nbsp;")).join(",");
            valuesSpan.classList.add("right-align", "monospaced");
            child.append(nameSpan, valuesSpan);
            return child;
        }
        parent.appendChild(generateList("Names", ["dmnr", "pers", "judg", "polt", "real", "perc", "horn"]));
        for (const { name, values } of resp.extra.scores) {
            parent.appendChild(generateList(name, values.map(x => x.toFixed(1))));
        }
        openDialog(parent);
    }
};
dialogClose.addEventListener("click", () => {
    dialog.close();
});
dialog.addEventListener("click", (ev) => {
    const { target } = ev;
    if (!(target instanceof HTMLDialogElement)) {
        return;
    }
    const bounds = target.getBoundingClientRect();
    const inWidth = ev.clientX > bounds.left && ev.clientX < bounds.right;
    const inHeight = ev.clientY > bounds.top && ev.clientY < bounds.bottom;
    if (!inWidth || !inHeight) {
        dialog.close();
    }
});
submitButton.addEventListener("click", () => {
    const text = jsonInput.value.trim();
    if (!text) {
        return;
    }
    API.submit(text, overrideCheckbox.checked);
});
listButton.addEventListener("click", () => {
    API.list();
});
clearButton.addEventListener("click", () => {
    jsonInput.value = "";
});
export {};
