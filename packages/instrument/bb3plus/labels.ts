// The names and the colors of the sampled module fields of a BB3+, by the
// rules of the BB3+ dlog view and dlog parameters page. The Scope and the
// dlog file viewer use them.

// the parts of the name of a trace or a dlog column
export interface NameParts {
    // the label of the field: "U", "AIN1", "DIN3"
    label: string;
    // the user's label of the channel and of the slot (or their defaults),
    // "" if not known
    channelLabel: string;
    slotLabel: string;
}

function startsWithNoCase(text: string, prefix: string) {
    return text.toLowerCase().startsWith(prefix.toLowerCase());
}

// The name in a list of the fields of a slot: "<channel label> <label>",
// only the label if it starts with the channel label: "Ch1 U", "AIN1",
// "DIN3".
export function getListName(parts: NameParts) {
    if (
        parts.channelLabel &&
        !startsWithNoCase(parts.label, parts.channelLabel)
    ) {
        return `${parts.channelLabel} ${parts.label}`;
    }
    return parts.label;
}

function getNameAtLevel(parts: NameParts, level: number) {
    let prefix = "";
    if (
        level == 1 &&
        parts.channelLabel &&
        !startsWithNoCase(parts.label, parts.channelLabel)
    ) {
        prefix = parts.channelLabel;
    } else if (level >= 1 && parts.slotLabel) {
        prefix = parts.slotLabel;
    }
    return prefix ? `${prefix} ${parts.label}` : parts.label;
}

// The names of traces or columns shown together, the first of these that no
// other one has (without case): the label ("U"), "<channel label> <label>"
// ("Ch1 U"; the slot label instead if the label starts with the channel
// label: "MIO168+ #3 DIN1"), "<slot label> <label>" ("DCP405+ #1 U").
export function getUniqueNames(partsList: NameParts[]) {
    return partsList.map((parts, i) => {
        let name = "";
        for (let level = 0; level <= 2; level++) {
            name = getNameAtLevel(parts, level);
            const lower = name.toLowerCase();
            const unique = !partsList.some(
                (other, j) =>
                    j != i &&
                    getNameAtLevel(other, level).toLowerCase() == lower
            );
            if (unique) {
                break;
            }
        }
        return name;
    });
}

// the theme names of BB3+ the Studio themes use
export const DARK_THEME = "Dark";
export const LIGHT_THEME = "Light";

// "#RRGGBB" from "#RRGGBB" or "#RRGGBBAA" (the alpha is dropped)
function parseColor(text: string) {
    const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(text.trim());
    return match ? "#" + match[1].toUpperCase() : undefined;
}

// The color of the theme in a color per theme
// ("Dark=#F8B440;Light=#A05C00;Legacy=#F8C858"): the entry with the theme
// name (without case), else the first entry; undefined if there is none.
export function getThemeColor(text: string | undefined, themeName: string) {
    if (!text) {
        return undefined;
    }
    let first: string | undefined;
    for (const entry of text.split(";")) {
        const equal = entry.indexOf("=");
        if (equal == -1) {
            continue;
        }
        const color = parseColor(entry.substring(equal + 1));
        if (!color) {
            continue;
        }
        if (first == undefined) {
            first = color;
        }
        if (
            entry.substring(0, equal).trim().toLowerCase() ==
            themeName.toLowerCase()
        ) {
            return color;
        }
    }
    return first;
}
