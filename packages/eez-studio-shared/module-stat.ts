import fs from "fs";
import { each } from "lodash";

import { formatBytes } from "eez-studio-shared/formatBytes";

const TP_MODULE_PREFIX = "\\node_modules\\";
const LOCAL_MODULE_PREFIX = "\\build\\";

interface ModuleInfo {
    fileName: string;
    relativeName: string;
    bytes: number;
}

function collectModules(
    thirdPartyModules: ModuleInfo[],
    ourModules: ModuleInfo[]
) {
    each(require.cache, (nodeModule: NodeModule) => {
        try {
            const moduleInfo: ModuleInfo = {
                fileName: nodeModule.filename,
                relativeName: "",
                bytes: fs.statSync(nodeModule.filename).size
            };
            let i = moduleInfo.fileName.indexOf(TP_MODULE_PREFIX);
            if (i !== -1) {
                moduleInfo.relativeName = moduleInfo.fileName.substring(
                    i + TP_MODULE_PREFIX.length
                );
                thirdPartyModules.push(moduleInfo);
            } else {
                i = moduleInfo.fileName.indexOf(LOCAL_MODULE_PREFIX);
                moduleInfo.relativeName = moduleInfo.fileName.substring(
                    i + LOCAL_MODULE_PREFIX.length
                );
                ourModules.push(moduleInfo);
            }
        } catch (err) {}
    });
}

function dumpModules(
    moduleType: string,
    modulePrefix: string,
    modules: ModuleInfo[]
) {
    let totalBytes = 0;

    modules.sort((a: ModuleInfo, b: ModuleInfo) => {
        return b.bytes - a.bytes;
    });

    // modules.sort((a: ModuleInfo, b: ModuleInfo) => {
    //     return a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0;
    // });

    each(modules, moduleInfo => {
        totalBytes += moduleInfo.bytes;
        console.log(
            moduleType,
            formatBytes(moduleInfo.bytes),
            moduleInfo.relativeName
        );
    });

    return totalBytes;
}

setTimeout(() => {
    const thirdPartyModules: ModuleInfo[] = [];
    const ourModules: ModuleInfo[] = [];
    collectModules(thirdPartyModules, ourModules);

    const totalBytesTP = dumpModules("TP", TP_MODULE_PREFIX, thirdPartyModules);
    const totalBytesLocal = dumpModules(
        "LOCAL",
        LOCAL_MODULE_PREFIX,
        ourModules
    );

    console.log("Total TP files:", thirdPartyModules.length);
    console.log("Total LOCAL files:", ourModules.length);
    console.log("Total files:", thirdPartyModules.length + ourModules.length);

    console.log("Total TP size:", formatBytes(totalBytesTP));
    console.log("Total LOCAL size:", formatBytes(totalBytesLocal));
    console.log("Total size:", formatBytes(totalBytesTP + totalBytesLocal));
}, 1000);
