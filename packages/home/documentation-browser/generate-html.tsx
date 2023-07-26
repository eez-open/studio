import React from "react";
import { resolve } from "path";
import { createRoot } from "react-dom/client";
import fs from "fs";

import { copyDir } from "eez-studio-shared/util-electron";

import * as notification from "eez-studio-ui/notification";

import { ComponentInfo } from "./component-info";
import { getModel } from "./model";
import { ComponentContent } from "./components/ComponentContent";
import { sourceRootDir } from "eez-studio-shared/util";

async function generateHTMLFile(
    componentInfo: ComponentInfo,
    filePath: string
) {
    const div = document.createElement("div");
    document.body.appendChild(div);

    const root = createRoot(div);

    root.render(
        <ComponentContent componentInfo={componentInfo} generateHTML={true} />
    );

    await new Promise(resolve => setTimeout(resolve, 10));

    const cssFilePath = resolve(
        `${sourceRootDir()}/eez-studio-ui/_stylesheets/component-doc.css`
    );
    let CSS = await fs.promises.readFile(cssFilePath, "utf8");

    const jsFilePath = resolve(`${sourceRootDir()}/../libs/component-doc.js`);
    let JS = (await fs.promises.readFile(jsFilePath, "utf8")).replace(
        /\s+/g,
        " "
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${componentInfo.name}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
<script src="https://code.jquery.com/jquery-3.7.0.min.js" integrity="sha256-2Pmvv0kuTBOenSvLm6bvfBSSHrUJ+3A7x6P5Ebd07/g=" crossorigin="anonymous"></script>
<style>
${CSS}
</style>
<script id="component-doc-script">
${JS}
</script>
</head>
<body>
${div.innerHTML}
</body>
</html>
`;

    await fs.promises.writeFile(filePath, html, "utf8");

    div.remove();
}

export async function generateHTMLFilesForAllComponents() {
    const progressToastId = notification.info("Start...", {
        autoClose: false
    });

    const folderPath = `${sourceRootDir()}/../docs/components/html/en-US`;

    const model = getModel();

    const n = model.allComponentsNoSearchFilter.length;
    let i = 0;

    for (const componentInfo of model.allComponentsNoSearchFilter) {
        try {
            await generateHTMLFile(
                componentInfo,
                folderPath + "/" + componentInfo.name + ".html"
            );

            i++;

            notification.update(progressToastId, {
                render: `${i} / ${n}: ${componentInfo.name}`,
                type: notification.INFO
            });
        } catch (err) {
            notification.error(`Failed for ${componentInfo.name}: ${err}`);
            return;
        }
    }

    notification.update(progressToastId, {
        render: `Copying images folder...`,
        type: notification.INFO
    });

    await copyDir(
        `${sourceRootDir()}/../help/en-US/components/images`,
        folderPath + "/images"
    );

    notification.update(progressToastId, {
        render: "Done.",
        type: notification.SUCCESS,
        autoClose: 3000
    });
}
