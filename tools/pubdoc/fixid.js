const fs = require("fs");

const json = fs.readFileSync(
    "c:\\Users\\mvladic\\Downloads\\eez2-divi-theme-builder.json",
    "utf8"
);
const data = JSON.parse(json);

// iterate over all layouts

const ids = new Map();

const START_ID = 11220;

function iter(obj) {
    for (let key in obj) {
        const id = parseInt(key);
        if (id > 21000000 && id < 22000000) {
            let alterId = ids.get(id);
            if (alterId == undefined) {
                alterId = START_ID + ids.size;
                ids.set(id, alterId);
            }

            alterKey = alterId.toString();

            obj[alterKey] = obj[key];
            delete obj[key];

            key = alterKey;
        }

        const value = obj[key];
        if (Array.isArray(value)) {
            console.log("array", key);
            for (const element of value) {
                iter(element);
            }
        } else if (typeof value === "object") {
            console.log("object", key);
            iter(value);
        } else if (typeof value == "number") {
            console.log("number", key);
            if (value > 21000000 && value < 22000000) {
                let alterId = ids.get(value);
                if (alterId == undefined) {
                    alterId = START_ID + ids.size;
                    ids.set(value, alterId);
                }
                obj[key] = alterId;
            }
        } else if (typeof value == "string") {
            console.log("string", key);
            const id = parseInt(value);
            if (id > 21000000 && id < 22000000) {
                let alterId = ids.get(id);
                if (alterId == undefined) {
                    alterId = START_ID + ids.size;
                    ids.set(id, alterId);
                }
                obj[key] = alterId.toString();
            }
        }
    }
}

iter(data);

let outJson = JSON.stringify(data, undefined, 2);

for (const [key, value] of ids) {
    console.log(key, value);
    outJson = outJson.replaceAll(`id=\\"${key}\\"`, `id=\\"${value}\\"`);
    outJson = outJson.replaceAll(
        `divi_library=\\"${key}\\"`,
        `divi_library=\\"${value}\\"`
    );
}

fs.writeFileSync(
    "c:\\Users\\mvladic\\Downloads\\eez2-divi-theme-builder-mod.json",
    outJson,
    "utf8"
);
