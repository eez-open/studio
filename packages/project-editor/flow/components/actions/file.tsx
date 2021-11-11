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
    }
]);
