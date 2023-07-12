import fs from "fs";
import { resolve } from "path";
import { marked } from "marked";

import * as notification from "eez-studio-ui/notification";

import { sourceRootDir } from "eez-studio-shared/util";

import { ProjectType } from "project-editor/project/project";

import {
    ComponentInfo,
    IProjectTypeComponentInfoParent
} from "./component-info";
import { projectTypeToString } from "./helper";
import { getModel } from "./model";

////////////////////////////////////////////////////////////////////////////////

export interface MarkdownDescription {
    draft: boolean;
    raw: string;
}

export interface MarkdownData {
    description?: MarkdownDescription;
    properties: {
        [name: string]: MarkdownDescription;
    };
    inputs: {
        [name: string]: MarkdownDescription;
    };
    outputs: {
        [name: string]: MarkdownDescription;
    };
    examples?: MarkdownDescription;
}

////////////////////////////////////////////////////////////////////////////////

class MarkdownBuilder {
    _markdown: string[] = [];

    constructor() {}

    get markdown() {
        return this._markdown.join("\n");
    }

    addLine(line: string) {
        this._markdown.push(line);
    }

    addEmptyLine() {
        this._markdown.push("");
    }

    addHeading(level: number, text: string) {
        this._markdown.push(`${"#".repeat(level)} ${text}`);
    }

    addRaw(lines: string) {
        if (lines.endsWith("\n")) {
            lines = lines.substring(0, lines.length - 1);
        }

        lines.split("\n").forEach(line => {
            this.addLine(line);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

let markdownToHTML_converter: any;

export function markdownToHTML(markdown: string) {
    if (!markdownToHTML_converter) {
        const showdown = require("showdown");
        markdownToHTML_converter = new showdown.Converter();
    }

    return {
        __html: markdownToHTML_converter.makeHtml(markdown)
    };
}

////////////////////////////////////////////////////////////////////////////////

export async function doReadMarkdown(
    filePath: string
): Promise<MarkdownData | undefined> {
    let description: MarkdownDescription | undefined;
    const properties: {
        [name: string]: MarkdownDescription;
    } = {};
    const inputs: {
        [name: string]: MarkdownDescription;
    } = {};
    const outputs: {
        [name: string]: MarkdownDescription;
    } = {};
    let examples: MarkdownDescription | undefined;

    let state = "";
    let data: string | undefined;
    let draft = false;
    let field = "";

    function read(markdown: string) {
        const lexemes = marked.lexer(markdown);
        for (const lexeme of [...lexemes, undefined]) {
            if (lexeme != undefined && lexeme.type != "heading") {
                if ((lexeme as any).raw) {
                    data = data
                        ? data + (lexeme as any).raw
                        : (lexeme as any).raw;
                }
                continue;
            }

            if (state == "description") {
                description = data ? { draft, raw: data } : undefined;
                state = "";
            } else if (state == "properties") {
                if (field) {
                    if (data) {
                        properties[field] = { draft, raw: data };
                    }
                    field = "";
                }
            } else if (state == "inputs") {
                if (field) {
                    if (data) {
                        inputs[field] = { draft, raw: data };
                    }
                    field = "";
                }
            } else if (state == "outputs") {
                if (field) {
                    if (data) {
                        outputs[field] = { draft, raw: data };
                    }
                    field = "";
                }
            } else if (state == "examples") {
                examples = data ? { draft, raw: data } : undefined;
                state = "";
            }

            if (lexeme == undefined) {
                break;
            }

            if (lexeme.depth == 1) {
                if (lexeme.text.startsWith("DESCRIPTION")) {
                    state = "description";
                    data = undefined;
                    draft = lexeme.text.indexOf("DRAFT") != -1;
                } else if (lexeme.text == "PROPERTIES") {
                    state = "properties";
                    field = "";
                } else if (lexeme.text == "INPUTS") {
                    state = "inputs";
                    field = "";
                } else if (lexeme.text == "OUTPUTS") {
                    state = "outputs";
                    field = "";
                } else if (lexeme.text.startsWith("EXAMPLES")) {
                    state = "examples";
                    data = undefined;
                    draft = lexeme.text.indexOf("DRAFT") != -1;
                }
            } else if (lexeme.depth == 2) {
                if (
                    state == "properties" ||
                    state == "inputs" ||
                    state == "outputs"
                ) {
                    const text = lexeme.text.trim();

                    if (text.endsWith("[DRAFT]")) {
                        field = text
                            .substring(0, text.length - "[DRAFT]".length)
                            .trim();
                        draft = true;
                    } else {
                        field = text;
                        draft = false;
                    }

                    data = undefined;
                }
            }
        }
    }

    try {
        const markdown = await fs.promises.readFile(filePath, "utf8");
        read(markdown);
    } catch (e) {}

    return {
        description,
        properties,
        inputs,
        outputs,
        examples
    };
}

export async function readMarkdown(
    componentInfo: ComponentInfo,
    projectType: ProjectType
): Promise<MarkdownData | undefined> {
    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${
        componentInfo.type
    }s/${componentInfo.name}`;

    if (projectType == ProjectType.UNDEFINED) {
        return doReadMarkdown(resolve(`${filePathPrefix}.md`));
    } else {
        return doReadMarkdown(
            resolve(`${filePathPrefix}-${projectTypeToString(projectType)}.md`)
        );
    }
}

export async function readParentMarkdown(
    className: string,
    projectType: ProjectType
): Promise<MarkdownData | undefined> {
    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${className}`;

    if (projectType == ProjectType.UNDEFINED) {
        return doReadMarkdown(resolve(`${filePathPrefix}.md`));
    } else {
        return doReadMarkdown(
            resolve(`${filePathPrefix}-${projectTypeToString(projectType)}.md`)
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

async function generateMarkdownFiles(componentInfo: ComponentInfo) {
    function getProperties(): {
        common: string[];
        dashboard: string[];
        eezgui: string[];
        lvgl: string[];
    } {
        const dashboard = componentInfo.dashboard?.properties ?? [];
        const eezgui = componentInfo.eezgui?.properties ?? [];
        const lvgl = componentInfo.lvgl?.properties ?? [];

        const common = dashboard.filter(
            property =>
                (!componentInfo.dashboard || dashboard.includes(property)) &&
                (!componentInfo.eezgui || eezgui.includes(property)) &&
                (!componentInfo.lvgl || lvgl.includes(property))
        );

        return {
            common,
            dashboard,
            eezgui,
            lvgl
        };
    }

    function getInputs(): {
        common: string[];
        dashboard: string[];
        eezgui: string[];
        lvgl: string[];
    } {
        const dashboard = componentInfo.dashboard?.inputs ?? [];
        const eezgui = componentInfo.eezgui?.inputs ?? [];
        const lvgl = componentInfo.lvgl?.inputs ?? [];

        const common = dashboard.filter(
            input =>
                (!componentInfo.dashboard || dashboard.includes(input)) &&
                (!componentInfo.eezgui || eezgui.includes(input)) &&
                (!componentInfo.lvgl || lvgl.includes(input))
        );

        return {
            common,
            dashboard,
            eezgui,
            lvgl
        };
    }

    function getOutputs(): {
        common: string[];
        dashboard: string[];
        eezgui: string[];
        lvgl: string[];
    } {
        const dashboard = componentInfo.dashboard?.outputs ?? [];
        const eezgui = componentInfo.eezgui?.outputs ?? [];
        const lvgl = componentInfo.lvgl?.outputs ?? [];

        const common = dashboard.filter(
            output =>
                (!componentInfo.dashboard || dashboard.includes(output)) &&
                (!componentInfo.eezgui || eezgui.includes(output)) &&
                (!componentInfo.lvgl || lvgl.includes(output))
        );

        return {
            common,
            dashboard,
            eezgui,
            lvgl
        };
    }

    function getMarkdown(
        markdown: MarkdownData | undefined,
        properties: string[],
        inputs: string[],
        outputs: string[]
    ) {
        const builder = new MarkdownBuilder();

        builder.addHeading(
            1,
            "DESCRIPTION" + (markdown?.description?.draft ? " [DRAFT]" : "")
        );

        builder.addEmptyLine();
        if (markdown && markdown.description) {
            builder.addRaw(markdown.description.raw);
        }

        builder.addHeading(1, "PROPERTIES");
        builder.addEmptyLine();
        properties.forEach(property => {
            builder.addHeading(
                2,
                property +
                    (markdown?.properties[property]?.draft ? " [DRAFT]" : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.properties[property]) {
                builder.addRaw(markdown.properties[property].raw);
            }
        });

        builder.addHeading(1, "INPUTS");
        builder.addEmptyLine();
        inputs.forEach(input => {
            builder.addHeading(
                2,
                input + (markdown?.inputs[input]?.draft ? " [DRAFT]" : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.inputs[input]) {
                builder.addRaw(markdown.inputs[input].raw);
            }
        });

        builder.addHeading(1, "OUTPUTS");
        builder.addEmptyLine();
        outputs.forEach(output => {
            builder.addHeading(
                2,
                output + (markdown?.outputs[output]?.draft ? " [DRAFT]" : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.outputs[output]) {
                builder.addRaw(markdown.outputs[output].raw);
            }
        });

        builder.addHeading(
            1,
            "EXAMPLES" + (markdown?.examples?.draft ? " [DRAFT]" : "")
        );
        builder.addEmptyLine();
        if (markdown && markdown.examples) {
            builder.addRaw(markdown.examples.raw);
            builder.addEmptyLine();
        }
        return builder.markdown;
    }

    function getCommonMarkdown() {
        return getMarkdown(
            componentInfo.common.markdown,
            properties.common,
            inputs.common,
            outputs.common
        );
    }

    function getDashboardMarkdown() {
        return getMarkdown(
            componentInfo.dashboard?.markdown,
            properties.dashboard,
            inputs.dashboard,
            outputs.dashboard
        );
    }

    function getEezguiMarkdown() {
        return getMarkdown(
            componentInfo.eezgui?.markdown,
            properties.eezgui,
            inputs.eezgui,
            outputs.eezgui
        );
    }

    function getLvglMarkdown() {
        return getMarkdown(
            componentInfo.lvgl?.markdown,
            properties.lvgl,
            inputs.lvgl,
            outputs.lvgl
        );
    }

    const properties = getProperties();
    const inputs = getInputs();
    const outputs = getOutputs();

    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${
        componentInfo.type
    }s/${componentInfo.name}`;

    try {
        await fs.promises.writeFile(
            resolve(`${filePathPrefix}.md`),
            getCommonMarkdown(),
            "utf8"
        );
    } catch (e) {
        notification.error("Error writing common markdown file");
    }

    if (
        (componentInfo.dashboard ? 1 : 0) +
            (componentInfo.eezgui ? 1 : 0) +
            (componentInfo.lvgl ? 1 : 0) >
        1
    ) {
        if (componentInfo.dashboard) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-dashboard.md`),
                    getDashboardMarkdown(),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing dashboard markdown file");
            }
        }
        if (componentInfo.eezgui) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-eezgui.md`),
                    getEezguiMarkdown(),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing eez-gui markdown file");
            }
        }

        if (componentInfo.lvgl) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-lvgl.md`),
                    getLvglMarkdown(),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing lvgl markdown file");
            }
        }
    }
}

async function generateParentMarkdownFiles(
    className: string,
    map: Map<ProjectType, IProjectTypeComponentInfoParent>
) {
    function getProperties(): {
        common: string[];
        dashboard: string[];
        eezgui: string[];
        lvgl: string[];
    } {
        const dashboard = map.get(ProjectType.DASHBOARD)?.properties ?? [];
        const eezgui = map.get(ProjectType.FIRMWARE)?.properties ?? [];
        const lvgl = map.get(ProjectType.LVGL)?.properties ?? [];

        const common = dashboard.filter(
            property =>
                (!map.get(ProjectType.DASHBOARD) ||
                    dashboard.includes(property)) &&
                (!map.get(ProjectType.FIRMWARE) || eezgui.includes(property)) &&
                (!map.get(ProjectType.LVGL) || lvgl.includes(property))
        );

        return {
            common,
            dashboard,
            eezgui,
            lvgl
        };
    }

    function getMarkdown(
        markdown: MarkdownData | undefined,
        properties: string[]
    ) {
        const builder = new MarkdownBuilder();

        builder.addHeading(1, "PROPERTIES");
        builder.addEmptyLine();
        properties.forEach((property, i) => {
            builder.addHeading(
                2,
                property +
                    (markdown?.properties[property]?.draft ? " [DRAFT]" : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.properties[property]) {
                builder.addRaw(markdown.properties[property].raw);
                if (i == properties.length - 1) {
                    builder.addEmptyLine();
                }
            }
        });

        return builder.markdown;
    }

    const properties = getProperties();

    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${className}`;

    try {
        await fs.promises.writeFile(
            resolve(`${filePathPrefix}.md`),
            getMarkdown(
                map.get(ProjectType.UNDEFINED)!.markdown,
                properties.common
            ),
            "utf8"
        );
    } catch (e) {
        notification.error("Error writing common markdown file");
    }

    if (map.size > 2) {
        const dashboard = map.get(ProjectType.DASHBOARD);
        if (dashboard) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-dashboard.md`),
                    getMarkdown(dashboard.markdown, properties.dashboard),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing dashboard markdown file");
            }
        }

        const eezgui = map.get(ProjectType.FIRMWARE);
        if (eezgui) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-eezgui.md`),
                    getMarkdown(eezgui.markdown, properties.dashboard),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing eez-gui markdown file");
            }
        }

        const lvgl = map.get(ProjectType.LVGL);
        if (lvgl) {
            try {
                await fs.promises.writeFile(
                    resolve(`${filePathPrefix}-lvgl.md`),
                    getMarkdown(lvgl.markdown, properties.dashboard),
                    "utf8"
                );
            } catch (e) {
                notification.error("Error writing lvgl markdown file");
            }
        }
    }
}

export async function generateMarkdownFilesForAllComponents() {
    let model = getModel();

    for (const componentInfo of model.allComponentsNoSearchFilter) {
        try {
            await generateMarkdownFiles(componentInfo);
        } catch (err) {
            notification.error(`Failed for: ${componentInfo.name}`);
            return;
        }
    }

    for (const entry of model.parentInfoMap) {
        await generateParentMarkdownFiles(entry[0], entry[1]);
    }

    notification.info("Done.");
}
