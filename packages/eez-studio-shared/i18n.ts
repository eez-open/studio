import { ipcRenderer } from "electron";

import { isRenderer } from "eez-studio-shared/util-electron";

import type * as MainSettingsModule from "main/settings";
import { observable, runInAction, autorun } from "mobx";

////////////////////////////////////////////////////////////////////////////////

// The United Nations official languages (English is the source language, so
// it needs no dictionary).
export const UI_LANGUAGES = [
    { code: "", name: "System default" },
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "fr", name: "Français" },
    { code: "ru", name: "Русский" },
    { code: "es", name: "Español" },
    { code: "ar", name: "العربية" }
];

const SUPPORTED_LANGUAGES = ["zh-CN", "fr", "ru", "es", "ar"];

export function isRtlLanguage(language: string) {
    return language === "ar";
}

// Map a BCP-47 locale (e.g. "fr-CA", "es-419", "zh-Hans-CN") to a supported
// UI language, or "en" when unsupported.
export function languageFromLocale(locale: string): string {
    const lower = (locale || "").toLowerCase();
    if (lower.startsWith("zh")) {
        return "zh-CN";
    }
    for (const code of SUPPORTED_LANGUAGES) {
        if (code !== "zh-CN" && lower.startsWith(code)) {
            return code;
        }
    }
    return "en";
}

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

    // Right-to-left layout for Arabic (follows the effective language, also
    // when it comes from the system locale).
    autorun(() => {
        const raw = uiLanguage.get();
        const language = raw || languageFromLocale(systemLocale);
        if (typeof document !== "undefined") {
            document.documentElement.dir = isRtlLanguage(language)
                ? "rtl"
                : "ltr";
        }
    });
} else {
    ({ getUiLanguage, setUiLanguage } =
        require("main/settings") as typeof MainSettingsModule);
}

////////////////////////////////////////////////////////////////////////////////

type Dictionary = { [key: string]: string };

const dictionaries: { [code: string]: Dictionary | undefined } = {};

function loadDictionary(code: string): Dictionary {
    try {
        switch (code) {
            case "zh-CN":
                return require("./locale/zh-CN.json") as Dictionary;
            case "fr":
                return require("./locale/fr.json") as Dictionary;
            case "ru":
                return require("./locale/ru.json") as Dictionary;
            case "es":
                return require("./locale/es.json") as Dictionary;
            case "ar":
                return require("./locale/ar.json") as Dictionary;
            default:
                return {};
        }
    } catch (err) {
        // The dictionaries are copied into build/ by the gulp "copy" task
        // (npm run build-src). When only tsc was run (e.g. incremental
        // builds during development), the JSON is missing: fall back to
        // English instead of crashing on the first t() call.
        console.error(err);
        return {};
    }
}

function getDictionary(code: string): Dictionary {
    if (!dictionaries[code]) {
        dictionaries[code] = loadDictionary(code);
    }
    return dictionaries[code]!;
}

export function t(s: string): string {
    const raw = getUiLanguage();

    let language: string;
    if (raw) {
        language = raw;
    } else if (isRenderer()) {
        language = languageFromLocale(systemLocale);
    } else {
        language = languageFromLocale(
            (require("electron") as typeof import("electron")).app.getLocale()
        );
    }

    if (language === "en" || !language) {
        return s;
    }

    return getDictionary(language)[s] ?? s;
}
