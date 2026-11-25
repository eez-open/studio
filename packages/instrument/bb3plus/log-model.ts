// Debug log records of a BB3+ from the push port subscription (SUBScribe:LOG,
// FRAME_LOG). A record is the JSON line of the debug log file, see
// eez-bb3plus-cm5-firmware/src/bb3/debug_log.h:
//
//     {"time":"2026-10-21 12:34:56.789","us":12345678,"level":2,"cat":"scpi",...}

export const LOG_LEVEL_NAMES = [
    "0 off",
    "1 basic",
    "2 SCPI",
    "3 module fields",
    "4 module frames"
];

export const DEFAULT_LOG_LEVEL = 2;

// the oldest records go when there are more
export const MAX_LOG_RECORDS = 200000;

export const SEVERITIES = ["debug", "info", "warning", "error"];

export interface LogRecord {
    // number of the record since the subscription started
    id: number;
    // the JSON line, parsed again only when needed (getLogRecordJson): the
    // parsed objects of all the records would take much more memory
    line: string;
    time: string;
    us: number;
    level: number;
    cat: string;
    // "debug", "info", "warning" or "error"
    sev: string;
    // 0: no slot
    slot: number;
    // module records ("cat":"module")
    type: string;
    // the one line text, made when it is first needed
    _summary?: string;
    // the line in lower case, for the text filter
    _lower?: string;
}

// the line parsed, undefined if it is not valid JSON
function parseJson(line: string): any {
    try {
        return JSON.parse(line);
    } catch (err) {
        return undefined;
    }
}

// only the fields used for the list and the filter are kept
export function parseLogRecord(id: number, line: string): LogRecord {
    const json = parseJson(line);
    const record: LogRecord = {
        id,
        line,
        time: typeof json?.time == "string" ? json.time : "",
        us: typeof json?.us == "number" ? json.us : 0,
        level: typeof json?.level == "number" ? json.level : 0,
        cat: typeof json?.cat == "string" ? json.cat : "",
        sev: typeof json?.sev == "string" ? json.sev : "debug",
        slot: typeof json?.slot == "number" ? json.slot : 0,
        type: typeof json?.type == "string" ? json.type : ""
    };
    return record;
}

// the parsed line of the record, undefined if it is not valid JSON
export function getLogRecordJson(record: LogRecord): any {
    return parseJson(record.line);
}

function text(value: any): string {
    if (value == undefined) {
        return "";
    }
    if (typeof value == "string") {
        return value;
    }
    return JSON.stringify(value);
}

function formatDuration(us: number) {
    if (us < 1000) {
        return `${+us.toPrecision(4)} us`;
    }
    if (us < 1e6) {
        return `${+(us / 1000).toPrecision(4)} ms`;
    }
    return `${+(us / 1e6).toPrecision(4)} s`;
}

const MAX_SUMMARY_LENGTH = 400;

function computeSummary(record: LogRecord): string {
    const json = getLogRecordJson(record);
    if (!json) {
        return record.line;
    }

    if (record.cat == "scpi") {
        let summary = text(json.src) + ": " + text(json.cmd);
        if (json.out != undefined) {
            summary += " -> " + text(json.out);
        }
        if (Array.isArray(json.errors) && json.errors.length > 0) {
            summary += "  errors " + json.errors.join(", ");
        }
        return summary;
    }

    if (record.cat == "module") {
        if (record.type == "frame") {
            return `${text(json.dir)} ${text(json.len)} B: ${text(json.data)}`;
        }
        if (record.type == "field") {
            let name = text(json.name) || `tag ${text(json.tag)}`;
            if (typeof json.ch == "number") {
                name += `[${json.ch}]`;
            }
            const value = json.value != undefined ? json.value : json.data;
            return `${text(json.dir)} ${name} = ${text(value)}`;
        }
        if (record.type == "scpi") {
            return `${text(json.cmd)} -> ${text(json.result)}, ${formatDuration(
                json.durationUs ?? 0
            )}`;
        }
        if (record.type == "scpi-client") {
            let summary = text(json.cmd);
            if (typeof json.ch == "number" && json.ch >= 0) {
                summary += ` (channel ${json.ch + 1})`;
            }
            summary += json.err ? ` -> error ${json.err}` : " -> OK";
            return summary + ", " + formatDuration(json.durationUs ?? 0);
        }
        if (record.type == "boot" && json.moduleName) {
            return `${text(json.msg)}: ${text(json.moduleBrand)} ${text(
                json.moduleName
            )} ${text(json.firmwareVersion)} (${text(json.bridge)})`;
        }
    }

    if (record.cat == "log" && json.firmware != undefined) {
        return `${text(json.msg)}, firmware ${text(
            json.firmware
        )}, level ${text(json.debugLevel ?? json.level)}`;
    }

    if (record.cat == "event" && !json.msg) {
        return "event " + text(json.id);
    }

    return text(json.msg);
}

export function getLogRecordSummary(record: LogRecord) {
    if (record._summary == undefined) {
        let summary = computeSummary(record).replace(/[\r\n]+/g, " ");
        if (summary.length > MAX_SUMMARY_LENGTH) {
            summary = summary.substring(0, MAX_SUMMARY_LENGTH) + "...";
        }
        record._summary = summary;
    }
    return record._summary;
}

// "12:34:56.789" of "2026-10-21 12:34:56.789"
export function getLogRecordTime(record: LogRecord) {
    return record.time.length > 11 ? record.time.substring(11) : record.time;
}

export interface LogFilter {
    maxLevel: number;
    hiddenSeverities: string[];
    hiddenCategories: string[];
    // 0: all slots, -1: records without a slot
    slot: number;
    // in the JSON of the record, case insensitive
    text: string;
}

export const DEFAULT_LOG_FILTER: LogFilter = {
    maxLevel: 4,
    hiddenSeverities: [],
    hiddenCategories: [],
    slot: 0,
    text: ""
};

export function isLogFilterActive(filter: LogFilter) {
    return (
        filter.maxLevel < 4 ||
        filter.hiddenSeverities.length > 0 ||
        filter.hiddenCategories.length > 0 ||
        filter.slot != 0 ||
        filter.text.trim() != ""
    );
}

export function matchesLogFilter(
    record: LogRecord,
    filter: LogFilter,
    lowerText: string
) {
    if (record.level > filter.maxLevel) {
        return false;
    }
    if (filter.hiddenSeverities.indexOf(record.sev) != -1) {
        return false;
    }
    if (filter.hiddenCategories.indexOf(record.cat) != -1) {
        return false;
    }
    if (filter.slot > 0 && record.slot != filter.slot) {
        return false;
    }
    if (filter.slot < 0 && record.slot != 0) {
        return false;
    }
    if (lowerText) {
        if (record._lower == undefined) {
            record._lower = record.line.toLowerCase();
        }
        if (record._lower.indexOf(lowerText) == -1) {
            return false;
        }
    }
    return true;
}
