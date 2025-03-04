import path from "path";
import { shell } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import type { FileFilter } from "electron";
import React from "react";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import { SHOW_FILE_IN_FOLDER_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const readIcon: any = (
    <svg viewBox="0 0 368.553 368.553" fill="currentColor">
        <path d="M239.68 0H42.695v368.553h283.164V86.811L239.68 0zm4.377 25.7 56.288 56.701h-56.288V25.7zM57.695 353.553V15h171.362v82.401h81.802v256.151H57.695v.001z" />
        <path d="M86.435 82.401H208.31v15H86.435zM86.435 151.122H282.12v15H86.435zM86.435 219.843H282.12v15H86.435zM86.435 288.563H282.12v15H86.435z" />
    </svg>
);

const writeIcon: any = (
    <svg viewBox="0 0 458.018 458.018" fill="currentColor">
        <path d="M307.631 425.737h.002a2.817 2.817 0 0 1-2.814 2.813H36.111a2.817 2.817 0 0 1-2.814-2.813V32.282a2.817 2.817 0 0 1 2.814-2.814h268.708a2.817 2.817 0 0 1 2.814 2.814v27.411l29.442-28.412C336.543 13.943 322.283 0 304.819 0H36.111C18.311 0 3.829 14.481 3.829 32.282v393.455c0 17.799 14.481 32.281 32.281 32.281h268.708c17.8 0 32.281-14.481 32.281-32.281V287.234l-29.468 29.467v109.036z" />
        <path d="M55.319 345.509c0 8.137 6.597 14.734 14.734 14.734h51.527a43.932 43.932 0 0 1-6.32-29.467H70.053v-.001c-8.137 0-14.734 6.597-14.734 14.734zM131.134 256.828H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h54.697l6.384-29.468zM184.444 182.882H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h84.923l29.468-29.468zM258.39 108.936H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h158.869l29.468-29.468zM436.809 60.304c-24.123-24.836-63.396-24.718-87.457-.657L166.87 242.13a14.836 14.836 0 0 0-3.982 7.299l-18.249 84.244a14.736 14.736 0 0 0 17.52 17.52l84.244-18.249a15.009 15.009 0 0 0 7.299-3.982l182.482-182.483c23.921-23.919 23.881-62.243.625-86.175zM178.283 317.548l7.686-35.482 27.796 27.796-35.482 7.686zm237.064-191.906L243.283 297.706l-45.158-45.159L370.188 80.483c12.872-12.873 33.93-12.445 46.257 1.154 11.313 12.465 11.061 31.846-1.098 44.005z" />
    </svg>
);

const appendIcon: any = writeIcon;

// const fileOpenDialogIcon: any = (
//     <svg viewBox="0 0 256 256">
//         <path d="M240.2578 111.814A14.0339 14.0339 0 0 0 228.9004 106H214V88a14.0157 14.0157 0 0 0-14-14h-69.3335a2.0125 2.0125 0 0 1-1.1997-.3999l-27.7334-20.8003A14.0874 14.0874 0 0 0 93.3335 50H40a14.0157 14.0157 0 0 0-14 14v144c0 .038.0049.0752.0059.1133.0014.0844.0073.1684.0126.2524.0088.143.021.2847.0396.4248.0103.0757.0215.1514.0347.2266.0263.1543.059.3061.0971.456.0152.0616.0298.1226.047.1836.0517.1797.1117.355.1791.5274.0122.0312.022.0635.0347.0952a6.0854 6.0854 0 0 0 .293.6128c.0112.02.0244.0386.0356.0586q.145.2563.3145.496c.0136.02.0244.0416.039.0616.026.0361.0572.0679.084.103.0923.122.188.2402.2891.355.0513.0576.102.1147.1548.17.107.1117.2182.2182.3335.3212.0473.043.0927.0879.1416.1294a6.1715 6.1715 0 0 0 .5224.3965l.0132.0078a5.9471 5.9471 0 0 0 .5532.3252c.0484.0254.0977.0469.147.0708.1495.0732.3018.1411.4585.2017.0591.023.1187.0444.1788.0654q.2263.0798.46.1411c.0634.0166.126.0342.1894.0488.1611.0367.3242.065.4898.0884.059.0083.1171.0205.1767.0269A6.0473 6.0473 0 0 0 32 214h176a6.0003 6.0003 0 0 0 5.6924-4.1025l28.4897-85.4703a14.0342 14.0342 0 0 0-1.9243-12.6132ZM40 62h53.3335a2.0125 2.0125 0 0 1 1.1997.3999l27.7334 20.8003A14.0874 14.0874 0 0 0 130.6665 86H200a2.0026 2.0026 0 0 1 2 2v18H69.7661a13.9825 13.9825 0 0 0-13.2817 9.5727L38 171.0265V64a2.0026 2.0026 0 0 1 2-2Zm190.7979 58.6323L203.6758 202H40.3248l27.5439-82.6323A1.998 1.998 0 0 1 69.766 118h159.1343a2 2 0 0 1 1.8974 2.6323Z" />
//     </svg>
// );

// const fileSaveDialogIcon: any = (
//     <svg viewBox="0 0 512 512">
//         <path d="M362.7 64h-256C83 64 64 83.2 64 106.7v298.7c0 23.5 19 42.7 42.7 42.7h298.7c23.5 0 42.7-19.2 42.7-42.7v-256L362.7 64zM256 405.3c-35.4 0-64-28.6-64-64s28.6-64 64-64 64 28.6 64 64-28.6 64-64 64zM320 192H106.7v-85.3H320V192z" />
//     </svg>
// );

const componentHeaderColor = "#f1ffc4";

registerActionComponents("File", [
    {
        name: "FileRead",
        icon: readIcon,
        componentHeaderColor,
        bodyPropertyName: "filePath",
        inputs: [],
        outputs: [
            {
                name: "content",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "filePath",
                type: "expression",
                valueType: "string"
            },
            {
                name: "encoding",
                type: "expression",
                valueType: "string",
                formText: `"ascii", "base64", "hex", "ucs2", "ucs-2", "utf16le", "utf-16le", "utf8", "utf-8", "binary" or "latin1"`
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const filePathValue = context.evalProperty<string>("filePath");
            if (typeof filePathValue != "string") {
                context.throwError("filePath is not a string");
                return;
            }

            const encodingValue = context.evalProperty("encoding");
            if (typeof encodingValue != "string") {
                context.throwError("encoding is not a string");
                return;
            }

            const encodings = [
                "ascii",
                "base64",
                "hex",
                "ucs2",
                "ucs-2",
                "utf16le",
                "utf-16le",
                "utf8",
                "utf-8",
                "binary",
                "latin1"
            ];
            if (encodings.indexOf(encodingValue) == -1) {
                context.throwError(
                    `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                        ", "
                    )}`
                );
                return;
            }

            context = context.startAsyncExecution();

            (async function () {
                try {
                    const fs = await import("fs");
                    let content = await fs.promises.readFile(
                        filePathValue as string,
                        encodingValue == "binary"
                            ? undefined
                            : (encodingValue as any)
                    );
                    context.propagateValue("content", content);
                    context.propagateValueThroughSeqout();
                } catch (err) {
                    context.throwError(err.toString());
                } finally {
                    context.endAsyncExecution();
                }
            })();
        }
    },
    {
        name: "FileWrite",
        icon: writeIcon,
        componentHeaderColor,
        bodyPropertyName: "filePath",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "filePath",
                type: "expression",
                valueType: "string"
            },
            {
                name: "content",
                type: "expression",
                valueType: "string"
            },
            {
                name: "encoding",
                type: "expression",
                valueType: "string",
                formText: `"ascii", "base64", "hex", "ucs2", "ucs-2", "utf16le", "utf-16le", "utf8", "utf-8", "utf8-bom", "binary" or "latin1"`
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const filePathValue = context.evalProperty("filePath");
            if (typeof filePathValue != "string") {
                context.throwError("filePath is not a string");
                return;
            }

            let encodingValue = context.evalProperty("encoding");
            if (typeof encodingValue != "string") {
                context.throwError("${encoding} is not a string");
                return;
            }

            let contentValue = context.evalProperty("content");

            const encodings = [
                "ascii",
                "base64",
                "hex",
                "ucs2",
                "ucs-2",
                "utf16le",
                "utf-16le",
                "utf8",
                "utf-8",
                "binary",
                "latin1"
            ];
            if (encodingValue == "utf8-bom") {
                encodingValue = "utf8";
                contentValue = "\ufeff" + contentValue;
            }
            if (encodings.indexOf(encodingValue) == -1) {
                context.throwError(
                    `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                        ", "
                    )}`
                );
                return;
            }

            context = context.startAsyncExecution();

            (async function () {
                try {
                    const fs = await import("fs");
                    await fs.promises.writeFile(
                        filePathValue,
                        contentValue,
                        encodingValue as any
                    );
                    context.propagateValueThroughSeqout();
                } catch (err) {
                    context.throwError(err.toString());
                } finally {
                    context.endAsyncExecution();
                }
            })();

            return undefined;
        }
    },
    {
        name: "FileAppend",
        icon: appendIcon,
        componentHeaderColor,
        bodyPropertyName: "filePath",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "filePath",
                type: "expression",
                valueType: "string"
            },
            {
                name: "content",
                type: "expression",
                valueType: "string"
            },
            {
                name: "encoding",
                type: "expression",
                valueType: "string",
                formText: `"ascii", "base64", "hex", "ucs2", "ucs-2", "utf16le", "utf-16le", "utf8", "utf-8", "binary" or "latin1"`
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const filePathValue = context.evalProperty("filePath");
            if (typeof filePathValue != "string") {
                context.throwError("filePath is not a string");
                return;
            }

            const encodingValue = context.evalProperty("encoding");
            if (typeof encodingValue != "string") {
                context.throwError("${encoding} is not a string");
                return;
            }

            const encodings = [
                "ascii",
                "base64",
                "hex",
                "ucs2",
                "ucs-2",
                "utf16le",
                "utf-16le",
                "utf8",
                "utf-8",
                "binary",
                "latin1"
            ];
            if (encodings.indexOf(encodingValue) == -1) {
                context.throwError(
                    `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                        ", "
                    )}`
                );
                return;
            }

            const contentValue = context.evalProperty("content");

            context = context.startAsyncExecution();

            (async function () {
                try {
                    const fs = await import("fs");
                    await fs.promises.appendFile(
                        filePathValue,
                        contentValue,
                        encodingValue as any
                    );
                    context.propagateValueThroughSeqout();
                } catch (err) {
                    context.throwError(err.toString());
                } finally {
                    context.endAsyncExecution();
                }
            })();

            return undefined;
        }
    },
    {
        name: "FileOpenDialog",
        icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABHhJREFUWIXdlktslVUQx39zvvvobcsFSmmxPCoEKkYwRhrwhQ1oYqML2enCxJgY48aVS9GkbDQhhkSiwTfRjbjRBGPUGARFIwVFKSAp7yoWyO3jPtrS3u/MuPgAS/q6FywLJ5nFd87M/P8z38w5B/4v0nJo9YaWjjWfl+vn/isC4nhEhMfXdjQ/UZZfOcYPH75/UTyIPRri7zDVdGg6YKKnRHS/efeuiCwzswvehm7fe2dHXykxY6UYtXa2zo1buEXxT6pZICaYCM5ATcAC5HIqIlIfSMVm4NlSYk9ZgQ0nH2rCu28VW+hNUVO8edQUVY9iY3zMzMCv37Pyl91TxZ+0B1o7W9OOxJeIWzhVoNEiIoIEb7d811gxle2kv6A6Fjzv1W90ibB9eFCqAtE6xRZjrARba3AXE1RRkCY/t/4+OLvrugi0nG6pEJVPPlv6VddENg8cal4SiHtFRJ4evW5mhtnH3X/1/TgZOBOxL0daDjU/Iy74YBT4r4q+8MPKAz+V4l/SFEwm5oJ1EiFnVOSl71e0v4egpfpPSKBQKDwGmKq2p9PpzER2YrrK4E1vl17eu7K02b/Gf7zFrq6uVE1NTVZE4tFIcRrYZ2btqtqezWYPLlq0aAhgaefS5ImmE8Oj/a1zaTIsxB4Usbrx4nsA08PJu4//fg0BM5sJLM7lcvO9918457ii2cIQvblBatIpKpOJopl2iMg+73070L5169ZjbW1tGh5sesojr4vIuOBXscAQfU76PmycFU+kNgm2PLF+e1NQv6bxMhnCMMR7j/eenv4ClRVxujM5+nKDJOIOVWNGVQVz0pUk4kGuIr/9aDL3/hqRUpvbjsRckNimqtEFEqu8uiUixONxMtlB+vKDBCK4GMyfV8uyxqh1VJXBoWF6swNIf0e6sfjRPWDY2MNxIgJdMTVtFosIS6p+jEmmP8/s6jjg6DrfS8PcWfzc0c2Culn0ZAeYnU4hWmC5vobY8Bj/SeGNXU699nmveHNIqhaAgaKy7XCOY71RwONnurjQ20/d7GoaatPUpFMc6TxCKhlDiudZopuQYhfR+VO6hqq7Yqo+A4KrvAWR6Go4P6QcPXeAVclhan2BofAiM/xsZlKN5VNUFrtpqOimQfdQZ1/jNF9W5gAGvVU7T/4WU68ZQ3Cpf5t2Qf4NNte9BYXou6EKCIGeSG9zwJwoStTO5YuZ7ZY2NOa99iAgqXnRxsg5uPgOZXTSdYnALoBYqGFGcEhlRCC8uB2zkWkFBwjFIgIWkjGnuKp5mM/jMzuwac4eozu9+uwfEQEJM1hAUN1AmNmBhbnpBY8YXH0jxAKVjHcQVNXjL7yKXVdL3QCBEdWewDkIO9DhP28COARaHFUBCTK4GJbbeVOyF7NTqXsvnLny7QrZTE+QwnxhfzR606w2qvwAbkUbI8k6zZd7jF6vjoxcSyAGEK+RfrD0dJe/GNqloWH3zRgC/QXZkoiz0YnMmS5wM8uPFOXFW1v/7hm9fu2L6FOC3Udu/KU8nqxrwzPOtfEPmju7fm01yQcAAAAASUVORK5CYII=",
        componentHeaderColor,
        properties: [
            {
                name: "filters",
                type: "expression",
                valueType: "array:string",
                optional: () => true
            }
        ],
        inputs: [],
        outputs: [
            {
                name: "file_path",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            context = context.startAsyncExecution();

            (async () => {
                const filtersValue = context.evalProperty("filters");

                let filters: FileFilter[];
                if (filtersValue != undefined) {
                    if (!Array.isArray(filtersValue)) {
                        context.endAsyncExecution();
                        context.throwError("filters is not an array");
                        return;
                    }

                    if (filtersValue.length == 0) {
                        context.endAsyncExecution();
                        context.throwError("filters empty");
                        return;
                    }

                    filters = [];

                    for (let i = 0; i < filtersValue.length; i++) {
                        if (typeof filtersValue[i] != "string") {
                            context.endAsyncExecution();
                            context.throwError(
                                "filters is not an array of strings"
                            );
                            return;
                        }

                        const parts = filtersValue[i].split("|");
                        if (parts.length < 2) {
                            context.endAsyncExecution();
                            context.throwError(
                                `invalid filter at position ${i + 1}`
                            );
                            return;
                        }

                        filters.push({
                            name: parts[0],
                            extensions: parts.slice(1)
                        });
                    }

                    console.log(filters);
                } else {
                    filters = [{ name: "All Files", extensions: ["*"] }];
                }

                const result = await dialog.showOpenDialog(getCurrentWindow(), {
                    properties: ["openFile"],
                    filters
                });

                // workaround: for some reason electron returs "\\" as path separator on windows, probably bug
                const filePath =
                    result.filePaths && result.filePaths[0]
                        ? result.filePaths[0].replace(/\\/g, "/")
                        : undefined;

                if (!result.canceled) {
                    context.propagateValue("file_path", filePath);
                }
                context.propagateValueThroughSeqout();
                context.endAsyncExecution();
            })();
        }
    },
    {
        name: "FileSaveDialog",
        icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABRBJREFUWIWtll+I3NUVxz/nzszOJlnzZ3A3m40ma8x/rIipAVEqFFIoaUQMixoKhbagD74U6oP0wYdCqaIPakvtQwgtISlLC7Wk+tSHQmmLwcQU6ibZ9U80upttdnc25s/M/XNOH34zszO76+7M6oELv/ndM/d8ft9z7rlXqNmRP17YVnTyi4nJzzduv72H1w7vY6X2wtv/4Z8fXWWgd2NZyf1lZObG8Xef/mZYzDdffxCz4/mce9A0EdOc76E3/sZ1HwE4fN9Wnv3W7mUBUkrEGOjuctwM8tieUs+ze/409t3jh7dPzvd19QfVtEc1EYInhjkAHwLee7z3pBjbUiDGmPknRTWhmu5PsXrqwO/fW7MEgKKm+OgJTYFC8PhQxYcqKaU2AQI+VGvBFVXFVB8oFfInh4aHc4sCWOZE8J4YmxXwBJ+NmNpUIEWC96SUUNPGMEuHJOz41ZcokNGGGFoAYvD42kjangIpRnzwja9vGcYzQ8fPHKn7NopQrSaVGWbWWOyJ/buohCzwA4Mblw0+dv0UA4Nnebhnlv7eSZJJY67qK1z67ABRCz8DTrQC1AgBRq+UGZsss71vPT/5Tmfb8V+zr9O/tUr/1oVzTopMzw4wM3vv3oNH39n21x/t/7ABkFVsBnArRB57/c+sKXZ1FBzgqcMXyeUW3fKZWUBVyZncAXzYpEDCR9jcV2Ls0wnU4IuK7xhADcSWmrfsQwWBeSmoeKWv1Mem3r6WOujEBIc15X0BgNZ6Q239piJMiAkT09dXFLhuOxUcywEoiMwD0FRX5SuZmiBLKWBWU4BWAFPFvg4AlSU/RLVeA64VINsBXxOALA+gposALPHHTgCWWmcu+DwFkuqS5O1aUkdTh18EwFqaXosCIrC3fwPf+8ad5N3KYE7fdCRdLgUJyKqw4fngS2/OiLD+5A+/zZZST1vBonpeOvMQlXRtRbCYjbduQxHWdGWvpsvXmZ5dvifsyH2f96pvrDC+/XReCuakq3hP+dryAHcVDjK1+hwfffHvjoIL/OHFR86faDmOxYR6Ax7oKzHQV2prsZ3VX/LK6ce5Ecpt+Vf9WkZGH/0tPD+vCIF6cYxdmuCDTybaWhBg860jjLjlU2EII6OHmJq+22BBJ5yzgb4NrF+7um2AfWzjrU/HOT1+akm/icl9TE0PAtmR3XIfaG6E3cUCXV15OrHHdz3Hhatnma6MLzrf3zNIvutJLugVTBccRjWAmgzvj13mv6OfdAQAcFfuKf6XXsNqrbZuOZfnB/f+nF9fmUJVSSw4jiM0FeE9O7dwz84tHQPAw5RGyrw1+ruWtwd3/JjB9Xsx/XvWiOZ3QrOshV87+xsK3a30ndojGjmrOcZddpm9Q/M8NDNF+Z2X8VO3AcWG71yShY+B+94+d5E1rvOr2Hy7ze3m8qbzYELPxC7e/Ow8AJdndmPWm8TZxwAyPDzclVK68x9X/IFzs+mFaLIWxAnmJLveZf3JTBpV+uUHvmU5NBCx20sXMXN2dXq7GaJgCuY3d8uJRze5V8vl8iU5evRob6FQeEJE9ovIALDBzHqAooh0mVkeyIlI/ZgTq136pNY6rekCKSJa+60iEoFoZgGoADeAMvA5cAY4KYAcO3asGGNcvW7dulUhhNUisirGuMrMup1zdZCCcy6vqnkzcyIiZpZ3zmFm0TlnMUbL5/NBVaOIBDPzqloVkQpQMbNbzrmbxWLxJnBraGio8n+BRf2XIiOGEwAAAABJRU5ErkJggg==",
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "file_path",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "fileName",
                type: "expression",
                valueType: "string"
            },
            {
                name: "filters",
                type: "expression",
                valueType: "array:string",
                optional: () => true
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const fileNameValue = context.evalProperty("fileName");
            if (fileNameValue && typeof fileNameValue != "string") {
                context.throwError("fileName is not a string");
                return;
            }

            context = context.startAsyncExecution();

            (async () => {
                const filtersValue = context.evalProperty("filters");

                let filters: FileFilter[] | undefined;
                if (filtersValue != undefined) {
                    if (!Array.isArray(filtersValue)) {
                        context.endAsyncExecution();
                        context.throwError("filters is not an array");
                        return;
                    }

                    if (filtersValue.length == 0) {
                        context.endAsyncExecution();
                        context.throwError("filters empty");
                        return;
                    }

                    filters = [];

                    for (let i = 0; i < filtersValue.length; i++) {
                        if (typeof filtersValue[i] != "string") {
                            context.endAsyncExecution();
                            context.throwError(
                                "filters is not an array of strings"
                            );
                            return;
                        }

                        const parts = filtersValue[i].split("|");
                        if (parts.length < 2) {
                            context.endAsyncExecution();
                            context.throwError(
                                `invalid filter at position ${i + 1}`
                            );
                            return;
                        }

                        filters.push({
                            name: parts[0],
                            extensions: parts.slice(1)
                        });
                    }

                    console.log(filters);
                } else {
                    filters = undefined;
                }

                const result = await dialog.showSaveDialog(getCurrentWindow(), {
                    defaultPath: fileNameValue,
                    filters
                });

                // workaround: for some reason electron returs "\\" as path separator on windows, probably bug
                const filePath = result.filePath
                    ? result.filePath.replace(/\\/g, "/")
                    : undefined;

                if (!result.canceled) {
                    context.propagateValue("file_path", filePath);
                }
                context.propagateValueThroughSeqout();
                context.endAsyncExecution();
            })();
        }
    },
    {
        name: "ShowFileInFolder",
        icon: SHOW_FILE_IN_FOLDER_ICON,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "filePath",
                type: "expression",
                valueType: "string"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const filePathValue = context.evalProperty("filePath");
            if (typeof filePathValue != "string") {
                context.throwError("filePathValue is not a string");
                return;
            }

            // workaround: on windows, showItemInFolder will not work if path.sep is /
            const filePath = filePathValue.replace(/\//g, path.sep);

            shell.showItemInFolder(filePath);

            context.propagateValueThroughSeqout();
        }
    }
]);
