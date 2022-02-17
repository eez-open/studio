import { ipcRenderer } from "electron";

import { isRenderer } from "eez-studio-shared/util-electron";

export const LOCALES = {
    af: "Afrikaans",
    am: "Amharic",
    ar: "Arabic",
    az: "Azerbaijani",
    be: "Belarusian",
    bg: "Bulgarian",
    bh: "Bihari",
    bn: "Bengali",
    br: "Breton",
    bs: "Bosnian",
    ca: "Catalan",
    co: "Corsican",
    cs: "Czech",
    cy: "Welsh",
    da: "Danish",
    de: "German",
    "de-AT": "German (Austria)",
    "de-CH": "German (Switzerland)",
    "de-DE": "German (Germany)",
    el: "Greek",
    en: "English",
    "en-AU": "English (Australia)",
    "en-CA": "English (Canada)",
    "en-GB": "English (UK)",
    "en-NZ": "English (New Zealand)",
    "en-US": "English (US)",
    "en-ZA": "English (South Africa)",
    eo: "Esperanto",
    es: "Spanish",
    "es-419": "Spanish (Latin America)",
    et: "Estonian",
    eu: "Basque",
    fa: "Persian",
    fi: "Finnish",
    fil: "Filipino",
    fo: "Faroese",
    fr: "French",
    "fr-CA": "French (Canada)",
    "fr-CH": "French (Switzerland)",
    "fr-FR": "French (France)",
    fy: "Frisian",
    ga: "Irish",
    gd: "Scots Gaelic",
    gl: "Galician",
    gn: "Guarani",
    gu: "Gujarati",
    ha: "Hausa",
    haw: "Hawaiian",
    he: "Hebrew",
    hi: "Hindi",
    hr: "Croatian",
    hu: "Hungarian",
    hy: "Armenian",
    ia: "Interlingua",
    id: "Indonesian",
    is: "Icelandic",
    it: "Italian",
    "it-CH": "Italian (Switzerland)",
    "it-IT": "Italian (Italy)",
    ja: "Japanese",
    jw: "Javanese",
    ka: "Georgian",
    kk: "Kazakh",
    km: "Cambodian",
    kn: "Kannada",
    ko: "Korean",
    ku: "Kurdish",
    ky: "Kyrgyz",
    la: "Latin",
    ln: "Lingala",
    lo: "Laothian",
    lt: "Lithuanian",
    lv: "Latvian",
    mk: "Macedonian",
    ml: "Malayalam",
    mn: "Mongolian",
    mo: "Moldavian",
    mr: "Marathi",
    ms: "Malay",
    mt: "Maltese",
    nb: "Norwegian (Bokmal)",
    ne: "Nepali",
    nl: "Dutch",
    nn: "Norwegian (Nynorsk)",
    no: "Norwegian",
    oc: "Occitan",
    om: "Oromo",
    or: "Oriya",
    pa: "Punjabi",
    pl: "Polish",
    ps: "Pashto",
    pt: "Portuguese",
    "pt-BR": "Portuguese (Brazil)",
    "pt-PT": "Portuguese (Portugal)",
    qu: "Quechua",
    rm: "Romansh",
    ro: "Romanian",
    ru: "Russian",
    sd: "Sindhi",
    sh: "Serbo-Croatian",
    si: "Sinhalese",
    sk: "Slovak",
    sl: "Slovenian",
    sn: "Shona",
    so: "Somali",
    sq: "Albanian",
    sr: "Serbian",
    st: "Sesotho",
    su: "Sundanese",
    sv: "Swedish",
    sw: "Swahili",
    ta: "Tamil",
    te: "Telugu",
    tg: "Tajik",
    th: "Thai",
    ti: "Tigrinya",
    tk: "Turkmen",
    to: "Tonga",
    tr: "Turkish",
    tt: "Tatar",
    tw: "Twi",
    ug: "Uighur",
    uk: "Ukrainian",
    ur: "Urdu",
    uz: "Uzbek",
    vi: "Vietnamese",
    xh: "Xhosa",
    yi: "Yiddish",
    yo: "Yoruba",
    zh: "Chinese",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    zu: "Zulu"
};

export let getLocale: () => string;
export let setLocale: (value: string) => void;

if (isRenderer()) {
    getLocale = function () {
        return ipcRenderer.sendSync("getLocale");
    };

    setLocale = function (value: string) {
        ipcRenderer.send("setLocale", value);
    };
} else {
    ({ getLocale, setLocale } = require("main/settings") as any);
}

////////////////////////////////////////////////////////////////////////////////

export const DATE_FORMATS = [
    { format: "L", description: "Locale default" },
    { format: "l", description: "Locale default #2" },
    { format: "LL", description: "Locale default #3" },
    { format: "ll", description: "Locale default #4" }
];

export let getDateFormat: () => string;
export let setDateFormat: (value: string) => void;

if (isRenderer()) {
    getDateFormat = function () {
        return ipcRenderer.sendSync("getDateFormat");
    };

    setDateFormat = function (value: string) {
        ipcRenderer.send("setDateFormat", value);
    };
} else {
    ({ getDateFormat, setDateFormat } = require("main/settings") as any);
}

////////////////////////////////////////////////////////////////////////////////

export const TIME_FORMATS = [{ format: "LTS", description: "Locale default" }];

export let getTimeFormat: () => string;
export let setTimeFormat: (value: string) => void;

if (isRenderer()) {
    getTimeFormat = function () {
        return ipcRenderer.sendSync("getTimeFormat");
    };

    setTimeFormat = function (value: string) {
        ipcRenderer.send("setTimeFormat", value);
    };
} else {
    ({ getTimeFormat, setTimeFormat } = require("main/settings") as any);
}

////////////////////////////////////////////////////////////////////////////////
