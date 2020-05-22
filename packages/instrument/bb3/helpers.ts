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

export interface IFetchedFile {
    fileName: string;
    fileData: string | ArrayBuffer;
}

export function fetchFileUrl(fileUrl: string) {
    return new Promise<IFetchedFile>((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.responseType = "blob";
        req.open("GET", fileUrl);

        req.addEventListener("load", () => {
            const decodedFileUri = decodeURIComponent(fileUrl);
            const lastPathSeparatorIndex = decodedFileUri.lastIndexOf("/");
            const fileName = decodedFileUri.substr(lastPathSeparatorIndex + 1);

            const reader = new FileReader();

            reader.addEventListener("loadend", function () {
                if (!reader.result) {
                    reject("no file data");
                } else {
                    resolve({ fileName, fileData: reader.result });
                }
            });

            reader.readAsArrayBuffer(req.response);
        });

        req.addEventListener("error", error => {
            reject(error);
        });

        req.send();
    });
}
