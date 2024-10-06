import fs from "fs";
import { resolve } from "path";
import { marked } from "marked";
import { FSWatcher, watch } from "chokidar";

import * as notification from "eez-studio-ui/notification";

import { sourceRootDir } from "eez-studio-shared/util";

import { ComponentInfo, ParentComponentInfo } from "./component-info";
import { getModel } from "./model";
import { isDev } from "eez-studio-shared/util-electron";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generateLVGLActionsMarkdown } from "project-editor/lvgl/actions";

let watcher: FSWatcher | undefined;

const markdownFiles = new Set<string>();

////////////////////////////////////////////////////////////////////////////////

export interface MarkdownDescription {
    draft: boolean;
    empty: boolean;
    raw: string;
}

export interface MarkdownData {
    description?: MarkdownDescription;

    propertiesEmpty: boolean;
    properties: {
        [name: string]: MarkdownDescription;
    };

    inputsEmpty: boolean;
    inputs: {
        [name: string]: MarkdownDescription;
    };

    outputsEmpty: boolean;
    outputs: {
        [name: string]: MarkdownDescription;
    };

    examples?: MarkdownDescription;

    lineEndings: string;
}

////////////////////////////////////////////////////////////////////////////////

class MarkdownBuilder {
    _markdown: string[] = [];

    constructor(public lineEndings: string) {}

    get markdown() {
        return this._markdown.join(this.lineEndings);
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
        if (lines.endsWith(this.lineEndings)) {
            lines = lines.substring(0, lines.length - this.lineEndings.length);
        } else if (lines.endsWith("\n")) {
            lines = lines.substring(0, lines.length - 1);
        }

        lines.split(this.lineEndings).forEach(line => {
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
    markdownFiles.add(filePath);

    let description: MarkdownDescription | undefined;

    let propertiesEmpty = false;
    const properties: {
        [name: string]: MarkdownDescription;
    } = {};

    let inputsEmpty = false;
    const inputs: {
        [name: string]: MarkdownDescription;
    } = {};

    let outputsEmpty = false;
    const outputs: {
        [name: string]: MarkdownDescription;
    } = {};

    let examples: MarkdownDescription | undefined;

    let state = "";
    let data: string | undefined;
    let draft = false;
    let empty = false;
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
                description = data
                    ? { draft, empty: false, raw: data }
                    : undefined;
                state = "";
            } else if (state == "properties") {
                if (field) {
                    if (data) {
                        properties[field] = { draft, empty: false, raw: data };
                    } else if (empty) {
                        properties[field] = { draft, empty: true, raw: "" };
                    }
                    field = "";
                }
            } else if (state == "inputs") {
                if (field) {
                    if (data) {
                        inputs[field] = { draft, empty: false, raw: data };
                    } else if (empty) {
                        properties[field] = { draft, empty: true, raw: "" };
                    }
                    field = "";
                }
            } else if (state == "outputs") {
                if (field) {
                    if (data) {
                        outputs[field] = { draft, empty: false, raw: data };
                    } else if (empty) {
                        properties[field] = { draft, empty: true, raw: "" };
                    }
                    field = "";
                }
            } else if (state == "examples") {
                examples = data
                    ? { draft, empty, raw: data }
                    : empty
                    ? { draft, empty, raw: "" }
                    : undefined;
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
                    empty = lexeme.text.indexOf("EMPTY") != -1;
                } else if (lexeme.text.startsWith("PROPERTIES")) {
                    state = "properties";
                    propertiesEmpty = lexeme.text.indexOf("EMPTY") != -1;
                    field = "";
                } else if (lexeme.text.startsWith("INPUTS")) {
                    state = "inputs";
                    inputsEmpty = lexeme.text.indexOf("EMPTY") != -1;
                    field = "";
                } else if (lexeme.text.startsWith("OUTPUTS")) {
                    state = "outputs";
                    outputsEmpty = lexeme.text.indexOf("EMPTY") != -1;
                    field = "";
                } else if (lexeme.text.startsWith("EXAMPLES")) {
                    state = "examples";
                    data = undefined;
                    draft = lexeme.text.indexOf("DRAFT") != -1;
                    empty = lexeme.text.indexOf("EMPTY") != -1;
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
                        empty = false;
                    } else if (text.endsWith("[EMPTY]")) {
                        field = text
                            .substring(0, text.length - "[EMPTY]".length)
                            .trim();
                        draft = false;
                        empty = true;
                    } else {
                        field = text;
                        draft = false;
                        empty = false;
                    }

                    data = undefined;
                }
            }
        }
    }

    let lineEndings: string;

    try {
        const markdown = await fs.promises.readFile(filePath, "utf8");

        var temp = markdown.indexOf("\n");
        if (temp > 0 && markdown[temp - 1] === "\r") {
            lineEndings = "\r\n";
        } else {
            lineEndings = "\n";
        }

        read(markdown);
    } catch (e) {
        lineEndings = "\n";
    }

    return {
        description,
        propertiesEmpty,
        properties,
        inputsEmpty,
        inputs,
        outputsEmpty,
        outputs,
        examples,
        lineEndings
    };
}

export async function readMarkdown(
    componentInfo: ComponentInfo
): Promise<MarkdownData | undefined> {
    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${
        componentInfo.type
    }s/${componentInfo.name}`;

    return doReadMarkdown(resolve(`${filePathPrefix}.md`));
}

export async function readParentMarkdown(
    className: string
): Promise<MarkdownData | undefined> {
    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${className}`;
    return doReadMarkdown(resolve(`${filePathPrefix}.md`));
}

////////////////////////////////////////////////////////////////////////////////

async function generateMarkdownFiles(componentInfo: ComponentInfo) {
    function getProperties() {
        return componentInfo.properties.map(property => property.name);
    }

    function getInputs() {
        return componentInfo.inputs.map(input => input.name);
    }

    function getOutputs() {
        return componentInfo.outputs.map(output => output.name);
    }

    function getMarkdown(
        markdown: MarkdownData | undefined,
        properties: string[],
        inputs: string[],
        outputs: string[]
    ) {
        const builder = new MarkdownBuilder(markdown?.lineEndings ?? "\n");

        builder.addHeading(
            1,
            "DESCRIPTION" + (markdown?.description?.draft ? " [DRAFT]" : "")
        );

        builder.addEmptyLine();
        if (markdown && markdown.description) {
            builder.addRaw(markdown.description.raw);
        }

        builder.addHeading(
            1,
            "PROPERTIES" + (markdown?.propertiesEmpty ? " [EMPTY]" : "")
        );
        builder.addEmptyLine();
        properties.forEach(property => {
            if (
                property == "Actions" &&
                componentInfo.componentClass.objectClass ==
                    ProjectEditor.LVGLActionComponentClass
            ) {
                builder.addHeading(2, property);
                builder.addEmptyLine();
                builder.addRaw(generateLVGLActionsMarkdown());
            } else {
                builder.addHeading(
                    2,
                    property +
                        (markdown?.properties[property]?.draft
                            ? " [DRAFT]"
                            : markdown?.properties[property]?.empty
                            ? " [EMPTY]"
                            : "")
                );
                builder.addEmptyLine();
                if (markdown && markdown.properties[property]) {
                    builder.addRaw(markdown.properties[property].raw);
                }
            }
        });

        builder.addHeading(
            1,
            "INPUTS" + (markdown?.inputsEmpty ? " [EMPTY]" : "")
        );
        builder.addEmptyLine();
        inputs.forEach(input => {
            builder.addHeading(
                2,
                input +
                    (markdown?.inputs[input]?.draft
                        ? " [DRAFT]"
                        : markdown?.inputs[input]?.empty
                        ? " [EMPTY]"
                        : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.inputs[input]) {
                builder.addRaw(markdown.inputs[input].raw);
            }
        });

        builder.addHeading(
            1,
            "OUTPUTS" + (markdown?.outputsEmpty ? " [EMPTY]" : "")
        );
        builder.addEmptyLine();
        outputs.forEach(output => {
            builder.addHeading(
                2,
                output +
                    (markdown?.outputs[output]?.draft
                        ? " [DRAFT]"
                        : markdown?.outputs[output]?.empty
                        ? " [EMPTY]"
                        : "")
            );
            builder.addEmptyLine();
            if (markdown && markdown.outputs[output]) {
                builder.addRaw(markdown.outputs[output].raw);
            }
        });

        builder.addHeading(
            1,
            "EXAMPLES" +
                (markdown?.examples?.draft
                    ? " [DRAFT]"
                    : markdown?.examples?.empty
                    ? " [EMPTY]"
                    : "")
        );
        builder.addEmptyLine();
        if (markdown && markdown.examples && !markdown.examples.empty) {
            builder.addRaw(markdown.examples.raw);
            builder.addEmptyLine();
        }
        return builder.markdown;
    }

    function getCommonMarkdown() {
        return getMarkdown(componentInfo.markdown, properties, inputs, outputs);
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
}

async function generateParentMarkdownFiles(
    className: string,
    parentComponentInfo: ParentComponentInfo
) {
    function getMarkdown(
        markdown: MarkdownData | undefined,
        properties: string[]
    ) {
        const builder = new MarkdownBuilder(markdown?.lineEndings ?? "\n");

        builder.addHeading(1, "PROPERTIES");
        builder.addEmptyLine();
        properties.forEach((property, i) => {
            builder.addHeading(
                2,
                property +
                    (markdown?.properties[property]?.draft
                        ? " [DRAFT]"
                        : markdown?.properties[property]?.empty
                        ? " [EMPTY]"
                        : "")
            );
            builder.addEmptyLine();
            if (
                markdown &&
                markdown.properties[property] &&
                !markdown.properties[property].empty
            ) {
                builder.addRaw(markdown.properties[property].raw);
                if (i == properties.length - 1) {
                    builder.addEmptyLine();
                }
            }
        });

        return builder.markdown;
    }

    const filePathPrefix = `${sourceRootDir()}/../help/en-US/components/${className}`;

    try {
        await fs.promises.writeFile(
            resolve(`${filePathPrefix}.md`),
            getMarkdown(
                parentComponentInfo.markdown,
                parentComponentInfo.properties.map(property => property.name)
            ),
            "utf8"
        );
    } catch (e) {
        notification.error("Error writing common markdown file");
    }
}

export async function generateMarkdownFilesForAllComponents() {
    if (watcher) {
        watcher.close();
        watcher = undefined;
    }

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

    setupMarkdownWatcher();
}

////////////////////////////////////////////////////////////////////////////////

export function setupMarkdownWatcher() {
    if (watcher) {
        return;
    }

    if (!isDev) {
        return;
    }

    watcher = watch([...markdownFiles.values()], {});

    watcher.on("change", () => {
        console.log("Markdown file changed.");
        let model = getModel();
        model.reloadMarkdown();
    });
}
