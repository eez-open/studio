import { toJS, isObservableArray } from "mobx";
import type MomentModule from "moment";
import stringify from "json-stable-stringify";

import type * as GeometryModule from "eez-studio-shared/geometry";

import type * as I10nModule from "eez-studio-shared/i10n";

export function parseXmlString(xmlString: string) {
    // remove UTF-8 BOM
    if (xmlString.startsWith("\ufeff")) {
        xmlString = xmlString.slice("\ufeff".length);
    }
    let parser = new DOMParser();
    return parser.parseFromString(xmlString, "text/xml");
}

export function getBoundingClientRectOfChildNodes(element: Element) {
    const { BoundingRectBuilder } =
        require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    element.childNodes.forEach(node => {
        if (node instanceof Element) {
            boundingRectBuilder.addRect(
                getBoundingClientRectIncludingChildNodes(node)
            );
        }
    });
    return boundingRectBuilder.getRect()!;
}

export function getBoundingClientRectIncludingChildNodes(element: Element) {
    const { BoundingRectBuilder } =
        require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    boundingRectBuilder.addRect(element.getBoundingClientRect());
    boundingRectBuilder.addRect(getBoundingClientRectOfChildNodes(element));
    return boundingRectBuilder.getRect()!;
}

export function formatNumber(
    value: number,
    base: number,
    width: number
): string {
    return ("0".repeat(width) + value.toString(base))
        .substr(-width)
        .toUpperCase();
}

export function formatTransferSpeed(speed: number) {
    let ordinals = ["", "K", "M", "G", "T", "P", "E"];

    let bandwidth = speed * 8; // bits per second

    let rate = bandwidth;
    let ordinal = 0;
    while (rate > 1024) {
        rate /= 1024;
        ordinal++;
    }

    return `${Math.round(rate * 10) / 10} ${ordinals[ordinal]}b/s`;
}

export function objectClone(obj: any) {
    let a: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !key.startsWith("$eez_noser")) {
            a[key] = obj[key];
        }
    }

    return JSON.parse(
        JSON.stringify(toJS(a), (key: string, value: any) => {
            return key.startsWith("$") || key.startsWith("_eez_")
                ? undefined
                : value;
        })
    );
}

export function objectEqual<T>(a: T, b: T) {
    const astr = stringify(toJS(a));
    const bstr = stringify(toJS(b));
    return astr === bstr;
}

export function clamp(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

var moment: typeof MomentModule | undefined;
var userLocale: string;
var localeData: MomentModule.Locale;
var localeWeekdays: string[];
var defaultDateFormat: string;
var defaultTimeFormat: string;
var defaultDateTimeFormat: string;

export function getMoment() {
    if (!moment) {
        moment = require("moment") as typeof MomentModule;
        require("moment-duration-format")(moment);
        const { getLocale, getDateFormat, getTimeFormat } =
            require("eez-studio-shared/i10n") as typeof I10nModule;
        userLocale = getLocale();
        localeData = getMoment().localeData(userLocale);
        localeWeekdays = localeData.weekdays();
        moment.locale(userLocale);
        defaultDateFormat = getDateFormat();
        defaultTimeFormat = getTimeFormat();
        defaultDateTimeFormat = defaultDateFormat + " " + defaultTimeFormat;
    }
    return moment;
}

export function formatDateTimeLong(date: Date) {
    return getMoment()(date).format(defaultDateTimeFormat);
}

export function formatDate(date: Date, format?: string) {
    return getMoment()(date).format(format || defaultDateFormat);
}

export function formatDuration(duration: number) {
    return getMoment().duration(duration).format("d __, h __, m __, s __", {
        userLocale
    });
}

export function formatDurationWithParam(duration: number, format: string) {
    return getMoment().duration(duration, "milliseconds").format({
        template: format,
        trim: false
    });
}
export function getFirstDayOfWeek() {
    return localeData.firstDayOfWeek();
}

export function getDayOfWeek(date: Date) {
    const dayFromSunday = date.getDay();
    let day = dayFromSunday - getFirstDayOfWeek();
    if (day < 0) {
        day = 7 + day;
    }
    return day;
}

export function getDayOfWeekName(dayOfWeek: number) {
    return localeWeekdays[dayOfWeek];
}

export function getWeekNumber(date: Date) {
    return getMoment()(date).week();
}

export async function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export const studioVersion = require("../../package.json").version;

export function compareVersions(v1: string, v2: string) {
    const v1Parts = v1.toString().split(".");
    const v2Parts = v2.toString().split(".");

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); ++i) {
        const v1 = parseInt(v1Parts[i]);
        const v2 = parseInt(v2Parts[i]);

        if (isNaN(v1)) {
            if (isNaN(v2)) {
                return v1Parts[i] < v2Parts[i]
                    ? -1
                    : v1Parts[i] > v2Parts[i]
                    ? 1
                    : 0;
            }
            return -1;
        }

        if (isNaN(v2)) {
            return 1;
        }

        if (v1 < v2) {
            return -1;
        }

        if (v1 > v2) {
            return 1;
        }
    }

    return 0;
}

////////////////////////////////////////////////////////////////////////////////

export function remap(
    x: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

export function sourceRootDir() {
    return __dirname + "/..";
}

////////////////////////////////////////////////////////////////////////////////

export function isArray(value: any): value is any[] {
    return Array.isArray(value) || isObservableArray(value);
}
