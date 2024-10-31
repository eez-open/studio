// https://github.com/jxson/string-capitalize
// https://github.com/jxson/string-humanize

export function capitalize(string: string | undefined): string {
    string = string || "";
    string = string.trim();

    if (string[0]) {
        string = string[0].toUpperCase() + string.substr(1);
    }

    return string;
}

export function humanize(string: string | number | undefined): string {
    function underscore(string: string | undefined): string {
        string = string || "";
        string = string.toString(); // might be a number
        string = string.trim();
        string = string.replace(/([a-z\d])([A-Z]+)/g, "$1_$2");
        string = string.replace(/[-\s]+/g, "_").toLowerCase();

        return string;
    }

    string = string || "";
    string = string.toString(); // might be a number
    string = string.trim();
    string = string.replace(extname(string), "");
    string = underscore(string);
    string = string.replace(/[\W_]+/g, " ");

    return capitalize(string);
}

export function underscore(string: string | undefined): string {
    string = string || "";
    string = string.toString(); // might be a number
    string = string.trim();

    // if there are no lowercase letters, then do nothing
    if (string.toUpperCase() === string) {
        return string;
    }

    let temp = "";
    for (let i = 0; i < string.length; i++) {
        if (string[i] >= "A" && string[i] <= "Z") {
            if (
                i > 0 &&
                string[i - 1] >= "A" &&
                string[i - 1] <= "Z" &&
                (i == string.length - 1 ||
                    (string[i + 1] >= "A" && string[i + 1] <= "Z") ||
                    (string[i + 1] >= "0" && string[i + 1] <= "9") ||
                    string[i + 1] == " " ||
                    string[i + 1] == "." ||
                    string[i + 1] == "_")
            ) {
                temp += string[i].toLowerCase();
                continue;
            }
        }
        temp += string[i];
    }
    string = temp;

    string = string.replace(/([a-z\d])([A-Z]+)/g, "$1_$2");
    string = string.replace(/[-\s]+/g, "_").toLowerCase();

    return string;
}

export function pascalCase(string: string | undefined): string {
    string = string || "";
    return string.replace(/(\w)(\w*)/g, function (g0: any, g1: any, g2: any) {
        return g1.toUpperCase() + g2.toLowerCase();
    });
}

export function extname(string: string): string {
    var index = string.lastIndexOf(".");
    var ext = string.substring(index, string.length);

    return index === -1 ? "" : ext;
}

export function camelize(string: string): string {
    string = string || "";
    string = string.trim();
    string = string.replace(/(\-|_|\s)+(.)?/g, function (mathc, sep, c) {
        return c ? c.toUpperCase() : "";
    });

    return string;
}

export function stringCompare(a: string, b: string) {
    a = a.toLocaleLowerCase();
    b = b.toLocaleLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
}

export function firstWord(string: string) {
    string = string.trim();
    const i = string.indexOf(" ");
    if (i == -1) {
        return string;
    }
    return string.substring(0, i);
}
