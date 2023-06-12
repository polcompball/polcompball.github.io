import { Canvas, getJson, currentTheme, windowPromise } from "./common.js";
function getColorScheme() {
    const dark = currentTheme() === "dark";
    return dark ? ["#EEE", "#333"] : ["#333", "#EEE"];
}
function drawScores(canvas, score, values, images = false) {
    canvas.clearFields();
    canvas.drawHeader({
        version: globalThis.VERSION,
        edition: "User Gallery",
        gallery: true,
        user: score.name,
        basetext: "Viewed"
    });
    const [fg, bg] = getColorScheme();
    canvas.params.fg = fg;
    canvas.params.bg = bg;
    for (const [i, s] of score.stats.entries()) {
        canvas.drawValue(values[i], s, i, images);
    }
}
function prepareDropdown(dropDown, users) {
    const createOption = (user, index) => {
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
async function main() {
    const [values, users, _] = await Promise.all([getJson("values"), getJson("users"), windowPromise]);
    const [fg, bg] = getColorScheme();
    const params = {
        bg, fg,
        height: 1000,
        width: 800,
        font: "Andika"
    };
    const canvasElm = document.getElementById("banner");
    const canvas = new Canvas(canvasElm, params);
    const dropDown = document.getElementById("userdropdown");
    prepareDropdown(dropDown, users);
    drawScores(canvas, users[0], values, true);
    dropDown.addEventListener("change", () => {
        const i = dropDown.selectedIndex;
        drawScores(canvas, users[i], values);
    });
}
main().catch((err) => {
    console.error(err);
});
//# sourceMappingURL=gallery.js.map