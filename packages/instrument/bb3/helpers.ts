export function removeQuotes(str: string) {
    if (str.length >= 2 && str[0] == '"' && str[str.length - 1] == '"') {
        return str.substr(1, str.length - 2);
    }
    return str;
}

export function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
