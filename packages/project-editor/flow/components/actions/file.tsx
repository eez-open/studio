import React from "react";

import { registerActionComponents } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

const readIcon: any = (
    <svg viewBox="0 0 368.553 368.553">
        <path d="M239.68 0H42.695v368.553h283.164V86.811L239.68 0zm4.377 25.7 56.288 56.701h-56.288V25.7zM57.695 353.553V15h171.362v82.401h81.802v256.151H57.695v.001z" />
        <path d="M86.435 82.401H208.31v15H86.435zM86.435 151.122H282.12v15H86.435zM86.435 219.843H282.12v15H86.435zM86.435 288.563H282.12v15H86.435z" />
    </svg>
);

const writeIcon: any = (
    <svg viewBox="0 0 458.018 458.018">
        <path d="M307.631 425.737h.002a2.817 2.817 0 0 1-2.814 2.813H36.111a2.817 2.817 0 0 1-2.814-2.813V32.282a2.817 2.817 0 0 1 2.814-2.814h268.708a2.817 2.817 0 0 1 2.814 2.814v27.411l29.442-28.412C336.543 13.943 322.283 0 304.819 0H36.111C18.311 0 3.829 14.481 3.829 32.282v393.455c0 17.799 14.481 32.281 32.281 32.281h268.708c17.8 0 32.281-14.481 32.281-32.281V287.234l-29.468 29.467v109.036z" />
        <path d="M55.319 345.509c0 8.137 6.597 14.734 14.734 14.734h51.527a43.932 43.932 0 0 1-6.32-29.467H70.053v-.001c-8.137 0-14.734 6.597-14.734 14.734zM131.134 256.828H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h54.697l6.384-29.468zM184.444 182.882H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h84.923l29.468-29.468zM258.39 108.936H70.053c-8.137 0-14.734 6.597-14.734 14.734s6.597 14.734 14.734 14.734h158.869l29.468-29.468zM436.809 60.304c-24.123-24.836-63.396-24.718-87.457-.657L166.87 242.13a14.836 14.836 0 0 0-3.982 7.299l-18.249 84.244a14.736 14.736 0 0 0 17.52 17.52l84.244-18.249a15.009 15.009 0 0 0 7.299-3.982l182.482-182.483c23.921-23.919 23.881-62.243.625-86.175zM178.283 317.548l7.686-35.482 27.796 27.796-35.482 7.686zm237.064-191.906L243.283 297.706l-45.158-45.159L370.188 80.483c12.872-12.873 33.93-12.445 46.257 1.154 11.313 12.465 11.061 31.846-1.098 44.005z" />
    </svg>
);

const fileSaveDialogIcon: any = (
    <svg viewBox="0 0 512 512">
        <path d="M362.7 64h-256C83 64 64 83.2 64 106.7v298.7c0 23.5 19 42.7 42.7 42.7h298.7c23.5 0 42.7-19.2 42.7-42.7v-256L362.7 64zM256 405.3c-35.4 0-64-28.6-64-64s28.6-64 64-64 64 28.6 64 64-28.6 64-64 64zM320 192H106.7v-85.3H320V192z" />
    </svg>
);

const showFileInFolderIcon: any = (
    <svg viewBox="0 0 32 32">
        <path d="M6 3v26h10.813l2-2H8V5h10v6h6v5.406c.6-.2 1.3-.406 2-.406V9.594L19.406 3H6zm14 3.406L22.594 9H20V6.406zM26.5 18c-3.026 0-5.5 2.474-5.5 5.5 0 1.159.35 2.236.969 3.125l-3.688 3.656 1.438 1.438 3.656-3.688c.89.618 1.966.969 3.125.969 3.026 0 5.5-2.474 5.5-5.5S29.526 18 26.5 18zm0 2c1.945 0 3.5 1.555 3.5 3.5S28.445 27 26.5 27a3.485 3.485 0 0 1-3.5-3.5c0-1.945 1.555-3.5 3.5-3.5z" />
    </svg>
);

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
                valueType: "string"
            }
        ],
        execute: async (flowState, ...[filePath, encoding]) => {
            const filePathValue = flowState.evalExpression(filePath);
            if (typeof filePathValue != "string") {
                throw `"${filePath}" is not a string`;
            }

            const encodingValue = flowState.evalExpression(encoding);
            if (typeof encodingValue != "string") {
                throw `"${encoding}" is not a string`;
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
                throw `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                    ", "
                )}`;
            }

            const fs = await import("fs");
            const content = await fs.promises.readFile(
                filePathValue,
                encodingValue as any
            );

            flowState.propagateValue("content", content);

            return undefined;
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
                valueType: "string"
            }
        ],
        execute: async (flowState, ...[filePath, content, encoding]) => {
            const filePathValue = flowState.evalExpression(filePath);
            if (typeof filePathValue != "string") {
                throw `"${filePath}" is not a string`;
            }

            const encodingValue = flowState.evalExpression(encoding);
            if (typeof encodingValue != "string") {
                throw `"${encoding}" is not a string`;
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
                throw `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                    ", "
                )}`;
            }

            const contentValue = flowState.evalExpression(content);

            const fs = await import("fs");
            await fs.promises.writeFile(
                filePathValue,
                contentValue,
                encodingValue as any
            );

            return undefined;
        }
    },
    {
        name: "FileSaveDialog",
        icon: fileSaveDialogIcon,
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
            }
        ],
        execute: async (flowState, ...[fileName]) => {
            const fileNameValue = flowState.evalExpression(fileName);
            if (fileNameValue && typeof fileNameValue != "string") {
                throw `"${fileName}" is not a string`;
            }

            const result = await EEZStudio.remote.dialog.showSaveDialog({
                defaultPath: fileNameValue
            });

            if (!result.canceled) {
                flowState.propagateValue("file_path", result.filePath);
            }

            return undefined;
        }
    },
    {
        name: "ShowFileInFolder",
        icon: showFileInFolderIcon,
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
        execute: async (flowState, ...[filePath]) => {
            const filePathValue = flowState.evalExpression(filePath);
            if (typeof filePathValue != "string") {
                throw `"${filePathValue}" is not a string`;
            }

            EEZStudio.electron.shell.showItemInFolder(filePathValue);

            return undefined;
        }
    }
]);
