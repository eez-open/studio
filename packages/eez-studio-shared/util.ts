import { toJS, isObservableArray } from "mobx";
import { DateTime, Duration } from "luxon";
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

var userLocale: string;
var weekdayNames: string[];
var defaultDateFormat: string;
var defaultTimeFormat: string;
var defaultDateTimeFormat: string;
var initialized = false;

function initLocaleData() {
    if (initialized) return;

    const { getLocale, getDateFormat, getTimeFormat } =
        require("eez-studio-shared/i10n") as typeof I10nModule;

    userLocale = getLocale();
    
    defaultDateFormat = getDateFormat();
    if (defaultDateFormat == "L") defaultDateFormat = "MM/dd/yyyy";
    else if (defaultDateFormat == "l") defaultDateFormat = "M/d/yyyy";
    else if (defaultDateFormat == "LL") defaultDateFormat = "MMMM d, yyyy";
    else if (defaultDateFormat == "ll") defaultDateFormat = "MMM d, yyyy";

    defaultTimeFormat = getTimeFormat();
    if (defaultTimeFormat == "LTS") defaultTimeFormat = "h:mm:ss a";
    defaultDateTimeFormat = defaultDateFormat + " " + defaultTimeFormat;

    const weekdayFormatter = new Intl.DateTimeFormat(userLocale, { weekday: "long" });
    weekdayNames = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(2024, 0, i + 1); // Jan 1-7, 2024 (Mon-Sun)
        weekdayNames.push(weekdayFormatter.format(date));
    }

    initialized = true;
}

export function formatDateTimeLong(date: Date) {
    initLocaleData();
    const dt = DateTime.fromJSDate(date).setLocale(userLocale);
    return dt.toFormat(defaultDateTimeFormat);
}

export function formatDate(date: Date, format?: string) {
    initLocaleData();
    const dt = DateTime.fromJSDate(date).setLocale(userLocale);
    return dt.toFormat(format || defaultDateFormat);
}

export function formatDuration(duration: number) {
    initLocaleData();
    const dur = Duration.fromMillis(duration);
    const days = Math.floor(dur.as('days'));
    const hours = Math.floor(dur.minus(Duration.fromObject({ days })).as('hours'));
    const minutes = Math.floor(dur.minus(Duration.fromObject({ days, hours })).as('minutes'));
    const seconds = Math.floor(dur.minus(Duration.fromObject({ days, hours, minutes })).as('seconds'));

    const parts = [];
    if (days > 0) parts.push(`${days} d`);
    if (hours > 0) parts.push(`${hours} h`);
    if (minutes > 0) parts.push(`${minutes} m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);

    return parts.join(', ');
}

export function formatDurationWithParam(duration: number, format: string) {
    initLocaleData();
    const dur = Duration.fromMillis(duration);

    const days = Math.floor(dur.as('days'));
    const hours = Math.floor(dur.minus(Duration.fromObject({ days })).as('hours'));
    const minutes = Math.floor(dur.minus(Duration.fromObject({ days, hours })).as('minutes'));
    const seconds = Math.floor(dur.minus(Duration.fromObject({ days, hours, minutes })).as('seconds'));

    let result = format
        .replace(/d+/g, () => days.toString().padStart(format.match(/d+/)?.[0].length || 1, '0'))
        .replace(/h+/g, () => hours.toString().padStart(format.match(/h+/)?.[0].length || 1, '0'))
        .replace(/m+/g, () => minutes.toString().padStart(format.match(/m+/)?.[0].length || 1, '0'))
        .replace(/s+/g, () => seconds.toString().padStart(format.match(/s+/)?.[0].length || 1, '0'));

    if (format.includes('__')) {
        result = result
            .replace(/0+/g, match => match.length > 0 ? '' : '0')
            .replace(/\s+/g, match => match.length > 1 ? ' ' : '');
    }

    return result;
}

export function getFirstDayOfWeek() {
    initLocaleData();
    try {
        const locale = new Intl.Locale(userLocale);
        return (locale as any).getWeekInfo?.firstDay ?? 0;
    } catch {
        return 0;
    }
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
    initLocaleData();
    return weekdayNames[dayOfWeek];
}

export function getWeekNumber(date: Date) {
    initLocaleData();
    const dt = DateTime.fromJSDate(date).setLocale(userLocale);
    return dt.weekNumber || 1;
}

export function formatDateWithLocaleAndFormat(date: Date | number, locale: string, format: string) {
    const dt = DateTime.fromJSDate(
        typeof date === 'number' ? new Date(date) : date
    ).setLocale(locale);
    return dt.toFormat(format);
}

export function formatDateRelative(date: Date | number | string) {
    const now = DateTime.now();
    let target: DateTime;
    if (typeof date === 'string') {
        target = DateTime.fromISO(date);
        if (!target.isValid) {
            target = DateTime.fromMillis(parseInt(date));
        }
    } else {
        target = DateTime.fromJSDate(
            typeof date === 'number' ? new Date(date) : date
        );
    }

    const diffSeconds = Math.round(now.diff(target).as('seconds'));

    if (diffSeconds < 60) {
        return 'a few seconds ago';
    } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffSeconds < 604800) {
        const days = Math.floor(diffSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diffSeconds < 2592000) {
        const weeks = Math.floor(diffSeconds / 604800);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffSeconds < 31536000) {
        const months = Math.floor(diffSeconds / 2592000);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
        const years = Math.floor(diffSeconds / 31536000);
        return `${years} year${years > 1 ? 's' : ''} ago`;
    }
}

export function formatDateCalendar(date: Date | number | string) {
    const now = DateTime.now();
    const target = DateTime.fromJSDate(
        typeof date === 'number' || typeof date === "string" ? new Date(date) : date
    ).setLocale(userLocale);

    const today = now.startOf('day');
    const yesterday = today.minus({ days: 1 });
    const targetDay = target.startOf('day');

    let prefix = '';
    if (targetDay.equals(today)) {
        prefix = 'Today ';
    } else if (targetDay.equals(yesterday)) {
        prefix = 'Yesterday ';
    } else if (target > today.minus({ days: 7 })) {
        const formatter = new Intl.DateTimeFormat(userLocale, { weekday: 'long' });
        prefix = formatter.format(target.toJSDate()) + ' ';
    }

    return prefix + target.toFormat('HH:mm:ss');
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
