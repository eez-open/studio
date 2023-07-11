import React from "react";
import { createRoot } from "react-dom/client";
import fs from "fs";

import { copyDir } from "eez-studio-shared/util-electron";

import * as notification from "eez-studio-ui/notification";

import { ProjectType } from "project-editor/core/object";

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
        <ComponentContent
            componentInfo={componentInfo}
            projectType={ProjectType.UNDEFINED}
            generateHTML={true}
        />
    );

    await new Promise(resolve => setTimeout(resolve, 10));

    const html = `<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<title>${componentInfo.name}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>
<style>
.EezStudio_DocumentationBrowser_Content_Help {
    background-color: #f0f0f0;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}
.EezStudio_DocumentationBrowser_Content_Help
    .nav {
    flex: 0;
    padding-top: 5px;
    padding-left: 5px;
}
.EezStudio_DocumentationBrowser_Content_Help
    .nav
    .nav-link {
    color: #212529;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation {
    flex: 1;
    padding: 10px;
    background-color: #fff;
    overflow: auto;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_TitleEnclosure {
    padding-bottom: 10px;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_TitleEnclosure
    .EezStudio_Component_Documentation_Title {
    display: flex;
    align-items: center;
    font-size: 32px;
    border-radius: 8px;
    padding: 5px 15px;
    width: fit-content;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_TitleEnclosure
    .EezStudio_Component_Documentation_Title
    img,
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_TitleEnclosure
    .EezStudio_Component_Documentation_Title
    svg {
    height: 36px;
    object-fit: contain;
    margin-right: 10px;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_Body
    .EezStudio_Component_Documentation_BodySection {
    margin-bottom: 15px;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_Body
    .EezStudio_Component_Documentation_BodySection
    > div:first-child {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_Body
    .EezStudio_Component_Documentation_BodySection
    > div:nth-child(2) {
    padding-left: 10px;
}
.EezStudio_DocumentationBrowser_Content_Help
    .EezStudio_Component_Documentation
    .EezStudio_Component_Documentation_Body
    .EezStudio_Component_Documentation_BodySection:last-child {
    margin-bottom: 0;
}
</style>
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

    const folderPath = `${sourceRootDir()}/../docs/components/en-US`;

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
