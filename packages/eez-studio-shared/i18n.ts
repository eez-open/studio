import { ipcRenderer } from "electron";

import { isRenderer } from "eez-studio-shared/util-electron";

import type * as MainSettingsModule from "main/settings";
import { observable, runInAction } from "mobx";

////////////////////////////////////////////////////////////////////////////////

export const UI_LANGUAGES = [
    { code: "", name: "System default" },
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" }
];

////////////////////////////////////////////////////////////////////////////////

let systemLocale = "";

export let getUiLanguage: () => string;
export let setUiLanguage: (value: string) => void;

if (isRenderer()) {
    const uiLanguage = observable.box<string>("");

    getUiLanguage = function () {
        return uiLanguage.get();
    };

    setUiLanguage = function (value: string) {
        ipcRenderer.send("setUiLanguage", value);
    };

    runInAction(() => {
        uiLanguage.set(ipcRenderer.sendSync("getUiLanguage"));
    });

    systemLocale = ipcRenderer.sendSync("getSystemLocale");

    ipcRenderer.on("uiLanguageChanged", (event: any, value: string) => {
        runInAction(() => uiLanguage.set(value));
    });
} else {
    ({ getUiLanguage, setUiLanguage } =
        require("main/settings") as typeof MainSettingsModule);
}

////////////////////////////////////////////////////////////////////////////////

let zhCNDictionary: { [key: string]: string } | undefined;

export function t(s: string): string {
    const raw = getUiLanguage();

    let language: string;
    if (raw) {
        language = raw;
    } else if (isRenderer()) {
        language = systemLocale.startsWith("zh") ? "zh-CN" : "en";
    } else {
        const systemLocale = require("electron").app.getLocale();
        language = systemLocale.startsWith("zh") ? "zh-CN" : "en";
    }

    if (!language.startsWith("zh")) {
        return s;
    }

    if (!zhCNDictionary) {
        try {
            zhCNDictionary = require("./locale/zh-CN.json") as {
                [key: string]: string;
            };
        } catch (err) {
            // The dictionary is copied into build/ by the gulp "copy" task
            // (npm run build-src). When only tsc was run (e.g. incremental
            // builds during development), the JSON is missing: fall back to
            // English instead of crashing on the first t() call.
            console.error(err);
            zhCNDictionary = {};
        }
    }

    return zhCNDictionary[s] ?? s;
}
