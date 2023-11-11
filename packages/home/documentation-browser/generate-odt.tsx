import fs from "fs";
import path from "path";
import { marked } from "marked";

import { sourceRootDir } from "eez-studio-shared/util";

import * as notification from "eez-studio-ui/notification";

import { ComponentInfo } from "./component-info";
import { getModel } from "./model";
import { MarkdownDescription } from "./doc-markdown";
import {
    getPropertyDescription,
    getPropertyGroups,
    getPropertyName
} from "./components/ComponentProperties";
import { getInputDescription } from "./components/ComponentInputs";
import { getOutputDescription } from "./components/ComponentOutputs";

import { isArray } from "eez-studio-shared/util";

class Context {
    listID = 1;
    images = new Set<string>();

    listLevel: number = 0;

    imgZIndex: number = 1;

    constructor(
        public componentInfo: ComponentInfo,
        public imageDimensions: Map<string, { width: number; height: number }>
    ) {}

    getListID() {
        return "list_" + this.componentInfo.name + this.listID++;
    }

    generateImage(href: string) {
        const imageFileName = path.basename(href);

        this.images.add(imageFileName);

        const width = this.imageDimensions.get(imageFileName)!.width;
        const height = this.imageDimensions.get(imageFileName)!.height;

        const widthmm = Math.min(Math.round((width * 43.66) / 165), 165);
        const heightmm = Math.round((widthmm * height) / width);

        return `<draw:frame draw:style-name="fr2" draw:name="image_${imageFileName}" text:anchor-type="paragraph" svg:width="${widthmm}mm" svg:height="${heightmm}mm" draw:z-index="${this
            .imgZIndex++}">
                <draw:image xlink:href="Pictures/${imageFileName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
            </draw:frame>`;
    }
}

function lexemesToODT(
    context: Context,
    tokens: marked.Token[],
    listPass: number
) {
    let odt = "";

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (listPass == 2 && token.type != "list") {
            continue;
        }

        if (token.type == "paragraph") {
            odt += `<text:p text:style-name="Standard">${lexemesToODT(
                context,
                token.tokens,
                0
            )}</text:p>`;
        } else if (token.type == "text") {
            const subtokens = (token as any).tokens;
            if (!isArray(subtokens) || subtokens.length == 0) {
                odt += token.text;
            } else if (subtokens.length == 1) {
                if (
                    subtokens[0].type == "text" &&
                    (!isArray((subtokens[0] as any).tokens) ||
                        (subtokens[0] as any).tokens.length == 0)
                ) {
                    odt += token.text;
                } else if (subtokens[0].type == "image") {
                    odt += `<text:p text:style-name="Standard">${lexemesToODT(
                        context,
                        subtokens,
                        0
                    )}</text:p>`;
                } else {
                    odt += lexemesToODT(context, (token as any).tokens, 0);
                }
            } else {
                odt += lexemesToODT(context, (token as any).tokens, 0);
            }
        } else if (token.type == "codespan") {
            odt += `<text:span text:style-name="backtick">${token.text}</text:span>`;
        } else if (token.type == "code") {
            odt += token.text
                .split("\n")
                .map(
                    line =>
                        `<text:p text:style-name="cmd_code">${line.replace(
                            /    /gi,
                            "<text:tab/>"
                        )}</text:p>`
                )
                .join();
        } else if (token.type == "em") {
            odt += `<text:span text:style-name="T1">${token.text}</text:span>`;
        } else if (token.type == "strong") {
            odt += `<text:span text:style-name="strong">${token.text}</text:span>`;
        } else if (token.type == "space" || token.type == "br") {
            if (
                !(
                    (i > 0 &&
                        (tokens[i - 1].type == "space" ||
                            tokens[i - 1].type == "paragraph")) ||
                    i == tokens.length - 1
                )
            ) {
                //odt += `<text:p text:style-name="Standard"/>`;
            }
        } else if (token.type == "list") {
            context.listLevel++;

            const listItems = token.items
                .map(item => {
                    const images: any[] = [];

                    if (
                        item.tokens.length > 0 &&
                        (context.listLevel <= 1 || listPass == 2)
                    ) {
                        const lastToken = item.tokens[item.tokens.length - 1];
                        if (
                            lastToken.type == "text" &&
                            isArray((lastToken as any).tokens) &&
                            (lastToken as any).tokens.length == 1 &&
                            (lastToken as any).tokens[0].type == "image"
                        ) {
                            images.push((lastToken as any).tokens[0]);
                            item.tokens.splice(item.tokens.length - 1, 1);
                        }
                    }

                    const imagesODT =
                        images.length > 0
                            ? `
                                <text:p>
                                    ${images
                                        .map(image =>
                                            context.generateImage(image.href)
                                        )
                                        .join("\n")}
                                </text:p>
                            `
                            : "";

                    if (imagesODT) {
                        console.log(imagesODT, context.listLevel, listPass);
                    }

                    const styleName =
                        context.listLevel > 1
                            ? `List_20_${context.listLevel}`
                            : i == 0
                            ? `List_20_${context.listLevel}_20_Start`
                            : i == token.items.length - 1
                            ? `List_20_${context.listLevel}_20_End`
                            : `List_20_${context.listLevel}`;

                    return `
                        <text:list-item>
                            <text:p text:style-name="${styleName}">
                                ${lexemesToODT(context, item.tokens, 1)}
                            </text:p>
                            ${imagesODT}
                        </text:list-item>
                        ${lexemesToODT(context, item.tokens, 2)}
                    `;
                })
                .join("\n");

            if (context.listLevel > 1) {
                if (listPass == 2) {
                    odt += listItems;
                }
            } else {
                odt += `
                    <text:list xml:id="${context.getListID()}" text:style-name="List_20_${
                    context.listLevel
                }">
                        ${listItems}
                    </text:list>
                `;
            }

            context.listLevel--;
        } else if (token.type == "image") {
            odt += context.generateImage(token.href);
        } else if (token.type == "link") {
            odt += `${token.text} (<text:a xlink:type="simple" xlink:href="${token.href}" text:style-name="Internet_20_link" text:visited-style-name="Visited_20_Internet_20_Link">link</text:a>)`;
        } else {
            console.warn(
                "Unknown lexeme in " + context.componentInfo.name,
                token
            );
        }
    }

    return odt;
}

function markdownToODT(
    context: Context,
    markdown: MarkdownDescription | undefined
) {
    if (!markdown || markdown.empty) {
        return "";
    }

    const tokens = marked.lexer(markdown.raw);

    if (
        context.componentInfo.name == "Progress (EEZ-GUI)" ||
        context.componentInfo.name == "SCPI"
    ) {
        console.log(context.componentInfo.name, tokens);
    }

    return lexemesToODT(context, tokens, 0);
}

async function generateODTFile(
    componentInfo: ComponentInfo,
    filePath: string,
    imageDimensions: Map<string, { width: number; height: number }>
) {
    const context = new Context(componentInfo, imageDimensions);

    let i: number | undefined;

    function projectIconX() {
        if (i == undefined) {
            const numIcons =
                (componentInfo.isDashboardComponent ? 1 : 0) +
                (componentInfo.isEezGuiComponent ? 1 : 0) +
                (componentInfo.isLVGLComponent ? 1 : 0);
            i = 3 - numIcons;
        }

        return ["125.01", "141.01", "157"][i++];
    }

    const groupPropertiesArray = getPropertyGroups(
        componentInfo,
        componentInfo.allProperties.filter(
            property => !componentInfo.isEmptyProperty(property.name)
        )
    );

    const titleList = context.getListID();
    const propertiesList = !componentInfo.isEmptyProperties()
        ? context.getListID()
        : undefined;
    const inputsList = !componentInfo.isEmptyInputs()
        ? context.getListID()
        : undefined;
    const outputsList = !componentInfo.isEmptyOutputs()
        ? context.getListID()
        : undefined;
    const examplesList = !componentInfo.isEmptyExamples()
        ? context.getListID()
        : undefined;

    let propertyPrevListID: string | undefined;

    let content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
    xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"
    xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
    xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0"
    xmlns:dr3d="urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0"
    xmlns:math="http://www.w3.org/1998/Math/MathML"
    xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0"
    xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0"
    xmlns:ooo="http://openoffice.org/2004/office"
    xmlns:ooow="http://openoffice.org/2004/writer"
    xmlns:oooc="http://openoffice.org/2004/calc"
    xmlns:dom="http://www.w3.org/2001/xml-events"
    xmlns:xforms="http://www.w3.org/2002/xforms"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:rpt="http://openoffice.org/2005/report"
    xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:grddl="http://www.w3.org/2003/g/data-view#"
    xmlns:tableooo="http://openoffice.org/2009/table"
    xmlns:textooo="http://openoffice.org/2013/office"
    xmlns:field="urn:openoffice:names:experimental:ooo-ms-interop:xmlns:field:1.0"
    xmlns:loext="urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0">
    <office:scripts/>
    <office:font-face-decls>
        <style:font-face style:name="Arial" svg:font-family="Arial" style:font-family-generic="swiss"/>
        <style:font-face style:name="Arial Black" svg:font-family="&apos;Arial Black&apos;" style:font-adornments="Bold" style:font-pitch="variable"/>
        <style:font-face style:name="Arial1" svg:font-family="Arial" style:font-adornments="Negreta" style:font-family-generic="swiss" style:font-pitch="variable"/>
        <style:font-face style:name="CombiNumerals" svg:font-family="CombiNumerals" style:font-adornments="Regular" style:font-pitch="variable" style:font-charset="x-symbol"/>
        <style:font-face style:name="Courier New" svg:font-family="&apos;Courier New&apos;" style:font-adornments="Normal" style:font-family-generic="modern" style:font-pitch="fixed"/>
        <style:font-face style:name="DejaVu Sans" svg:font-family="&apos;DejaVu Sans&apos;" style:font-family-generic="swiss"/>
        <style:font-face style:name="DejaVu Sans Mono" svg:font-family="&apos;DejaVu Sans Mono&apos;" style:font-family-generic="modern" style:font-pitch="fixed"/>
        <style:font-face style:name="DejaVu Sans1" svg:font-family="&apos;DejaVu Sans&apos;" style:font-family-generic="system" style:font-pitch="variable"/>
        <style:font-face style:name="Droid Sans Fallback" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="modern" style:font-pitch="fixed"/>
        <style:font-face style:name="Droid Sans Fallback1" svg:font-family="&apos;Droid Sans Fallback&apos;" style:font-family-generic="system" style:font-pitch="variable"/>
        <style:font-face style:name="OpenSymbol" svg:font-family="OpenSymbol" style:font-charset="x-symbol"/>
        <style:font-face style:name="OpenSymbol1" svg:font-family="OpenSymbol"/>
        <style:font-face style:name="Ubuntu" svg:font-family="Ubuntu" style:font-adornments="Bold" style:font-pitch="variable"/>
        <style:font-face style:name="Ubuntu1" svg:font-family="Ubuntu" style:font-adornments="Bold Italic" style:font-pitch="variable"/>
        <style:font-face style:name="Ubuntu2" svg:font-family="Ubuntu" style:font-adornments="Italic" style:font-pitch="variable"/>
        <style:font-face style:name="Ubuntu3" svg:font-family="Ubuntu" style:font-adornments="Regular" style:font-pitch="variable"/>
    </office:font-face-decls>
    <office:automatic-styles>
        <style:style style:name="Table1" style:family="table">
            <style:table-properties style:width="17cm" table:align="margins"/>
        </style:style>
        <style:style style:name="Table1.A" style:family="table-column">
            <style:table-column-properties style:column-width="17cm" style:rel-column-width="65535*"/>
        </style:style>
        <style:style style:name="Table1.A1" style:family="table-cell">
            <style:table-cell-properties fo:background-color="#cccccc" fo:padding="0.097cm" fo:border="0.05pt solid #cccccc">
                <style:background-image/>
            </style:table-cell-properties>
        </style:style>
        <style:style style:name="Table1.A2" style:family="table-cell">
            <style:table-cell-properties fo:padding="0.097cm" fo:border-left="0.05pt solid #cccccc" fo:border-right="0.05pt solid #cccccc" fo:border-top="none" fo:border-bottom="0.05pt solid #cccccc"/>
        </style:style>
        <style:style style:name="Table2" style:family="table">
            <style:table-properties style:width="17cm" table:align="margins"/>
        </style:style>
        <style:style style:name="Table2.A" style:family="table-column">
            <style:table-column-properties style:column-width="17cm" style:rel-column-width="65535*"/>
        </style:style>
        <style:style style:name="Table2.A1" style:family="table-cell">
            <style:table-cell-properties fo:background-color="#cccccc" fo:padding="0.097cm" fo:border="0.05pt solid #cccccc">
                <style:background-image/>
            </style:table-cell-properties>
        </style:style>
        <style:style style:name="Table2.A2" style:family="table-cell">
            <style:table-cell-properties fo:padding="0.097cm" fo:border-left="0.05pt solid #cccccc" fo:border-right="0.05pt solid #cccccc" fo:border-top="none" fo:border-bottom="0.05pt solid #cccccc"/>
        </style:style>
        <style:style style:name="Table3" style:family="table">
            <style:table-properties style:width="17cm" table:align="margins"/>
        </style:style>
        <style:style style:name="Table3.A" style:family="table-column">
            <style:table-column-properties style:column-width="17cm" style:rel-column-width="65535*"/>
        </style:style>
        <style:style style:name="Table3.A1" style:family="table-cell">
            <style:table-cell-properties fo:background-color="#cccccc" fo:padding="0.097cm" fo:border="0.05pt solid #cccccc">
                <style:background-image/>
            </style:table-cell-properties>
        </style:style>
        <style:style style:name="Table3.A2" style:family="table-cell">
            <style:table-cell-properties fo:padding="0.097cm" fo:border-left="0.05pt solid #cccccc" fo:border-right="0.05pt solid #cccccc" fo:border-top="none" fo:border-bottom="0.05pt solid #cccccc"/>
        </style:style>
        <style:style style:name="Table4" style:family="table">
            <style:table-properties style:width="17cm" table:align="margins"/>
        </style:style>
        <style:style style:name="Table4.A" style:family="table-column">
            <style:table-column-properties style:column-width="17cm" style:rel-column-width="65535*"/>
        </style:style>
        <style:style style:name="Table4.A1" style:family="table-cell">
            <style:table-cell-properties fo:background-color="#cccccc" fo:padding="0.097cm" fo:border="0.05pt solid #cccccc">
                <style:background-image/>
            </style:table-cell-properties>
        </style:style>
        <style:style style:name="Table4.A2" style:family="table-cell">
            <style:table-cell-properties fo:padding="0.097cm" fo:border-left="0.05pt solid #cccccc" fo:border-right="0.05pt solid #cccccc" fo:border-top="none" fo:border-bottom="0.05pt solid #cccccc"/>
        </style:style>
        <style:style style:name="P1" style:family="paragraph" style:parent-style-name="Heading_20_1" style:master-page-name="First_20_Page">
            <style:paragraph-properties style:page-number="auto"/>
        </style:style>
        <style:style style:name="T1" style:family="text">
            <style:text-properties fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/>
        </style:style>
        <style:style style:name="T2" style:family="text">
            <style:text-properties fo:font-style="italic" fo:font-weight="normal" style:font-style-asian="italic" style:font-weight-asian="normal" style:font-style-complex="italic" style:font-weight-complex="normal"/>
        </style:style>
        <style:style style:name="T3" style:family="text"/>
        <style:style style:name="fr1" style:family="graphic" style:parent-style-name="Graphics">
            <style:graphic-properties style:wrap="dynamic" style:number-wrapped-paragraphs="1" style:wrap-contour="false" style:vertical-pos="from-top" style:vertical-rel="paragraph" style:horizontal-pos="from-left" style:horizontal-rel="paragraph" style:mirror="none" fo:clip="rect(0cm, 0cm, 0cm, 0cm)" draw:luminance="0%" draw:contrast="0%" draw:red="0%" draw:green="0%" draw:blue="0%" draw:gamma="100%" draw:color-inversion="false" draw:image-opacity="100%" draw:color-mode="standard" style:flow-with-text="false"/>
        </style:style>
        <style:style style:name="fr2" style:family="graphic" style:parent-style-name="Graphics">
            <style:graphic-properties style:horizontal-pos="center" style:horizontal-rel="paragraph" fo:margin-top="0.199cm" fo:margin-bottom="0.199cm" style:mirror="none" fo:clip="rect(0cm, 0cm, 0cm, 0cm)" draw:luminance="0%" draw:contrast="0%" draw:red="0%" draw:green="0%" draw:blue="0%" draw:gamma="100%" draw:color-inversion="false" draw:image-opacity="100%" draw:color-mode="standard"/>
        </style:style>
    </office:automatic-styles>
    <office:body>
        <office:text text:use-soft-page-breaks="true">
            <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
            <text:sequence-decls>
                <text:sequence-decl text:display-outline-level="0" text:name="Illustration"/>
                <text:sequence-decl text:display-outline-level="0" text:name="Table"/>
                <text:sequence-decl text:display-outline-level="0" text:name="Text"/>
                <text:sequence-decl text:display-outline-level="0" text:name="Drawing"/>
                <text:sequence-decl text:display-outline-level="0" text:name="Figure"/>
                <text:sequence-decl text:display-outline-level="0" text:name="Fig."/>
            </text:sequence-decls>
            <text:list xml:id="${titleList}" text:style-name="Outline">
                <text:list-item>
                    <text:h text:style-name="P1" text:outline-level="1">${
                        componentInfo.isDashboardComponent
                            ? `<draw:frame draw:style-name="fr1" draw:name="dashboard-icon.png" text:anchor-type="paragraph" svg:x="${projectIconX()}mm" svg:y="0mm" svg:width="13mm" svg:height="10.94mm" draw:z-index="1">
                            <draw:image xlink:href="Pictures/100002010000036B0000031B40540EF8.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
                        </draw:frame>`
                            : ""
                    }${
        componentInfo.isEezGuiComponent
            ? `<draw:frame draw:style-name="fr1" draw:name="eez-gui-icon.png" text:anchor-type="paragraph" svg:x="${projectIconX()}mm" svg:y="0mm" svg:width="13mm" svg:height="9.35mm" draw:z-index="3">
                            <draw:image xlink:href="Pictures/100002010000036D0000027EEDA92E76.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
                        </draw:frame>`
            : ""
    }${
        componentInfo.isLVGLComponent
            ? `<draw:frame draw:style-name="fr1" draw:name="lvgl-icon.png" text:anchor-type="paragraph" svg:x="${projectIconX()}mm" svg:y="0mm" svg:width="13mm" svg:height="8.89mm" draw:z-index="2">
                            <draw:image xlink:href="Pictures/100002010000036D0000027E5239E6C0.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
                        </draw:frame>`
            : ""
    }${componentInfo.name}</text:h>
                    <text:list>
                        <text:list-item>
                            <text:h text:style-name="Heading_20_2" text:outline-level="2">Description</text:h>
                        </text:list-item>
                    </text:list>
                </text:list-item>
            </text:list>

            ${markdownToODT(context, componentInfo.getDescriptionMarkdown())}

            ${
                propertiesList
                    ? `
                <text:list xml:id="${propertiesList}" text:continue-numbering="true" text:continue-list="${titleList}" text:style-name="Outline">
                    <text:list-item>
                        <text:list>
                            <text:list-item>
                                <text:h text:style-name="Heading_20_2" text:outline-level="2">
                                    Properties</text:h>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>

                ${groupPropertiesArray
                    .map(
                        groupProperties => `

                    <text:p text:style-name="Standard"/>
                    <table:table table:name="Table1" table:style-name="Table1">
                        <table:table-column table:style-name="Table1.A"/>

                        <table:table-row>
                            <table:table-cell table:style-name="Table1.A1" office:value-type="string">
                                <text:p text:style-name="Table_20_header_20_bold">${
                                    groupProperties.group.title || "Other"
                                }</text:p>
                            </table:table-cell>
                        </table:table-row>

                        <table:table-row>
                            <table:table-cell table:style-name="Table1.A2" office:value-type="string">

                                ${groupProperties.properties
                                    .map(property => {
                                        let propertyName =
                                            getPropertyName(property);
                                        let propertyDescription =
                                            getPropertyDescription(property);

                                        let listID = context.getListID();

                                        const result = `
                                            <text:list xml:id="${listID}" text:continue-numbering="true" ${
                                            propertyPrevListID
                                                ? `text:continue-list="${propertyPrevListID}"`
                                                : ""
                                        } text:style-name="Outline">
                                                <text:list-item>
                                                    <text:list>
                                                        <text:list-item>
                                                            <text:list>
                                                                <text:list-item>
                                                                    <text:h text:style-name="Heading_20_3" text:outline-level="3">
                                                                        ${propertyName}
                                                                        <text:s text:c="4"/>
                                                                        <text:span text:style-name="T2">${propertyDescription}</text:span>
                                                                    </text:h>
                                                                </text:list-item>
                                                            </text:list>
                                                        </text:list-item>
                                                    </text:list>
                                                </text:list-item>
                                            </text:list>
                                            ${markdownToODT(
                                                context,
                                                componentInfo.getPropertyDescriptionMarkdown(
                                                    property.name
                                                )
                                            )}`;

                                        propertyPrevListID = listID;

                                        return result;
                                    })
                                    .join()}
                            </table:table-cell>
                        </table:table-row>
                    </table:table>`
                    )
                    .join()}`
                    : ""
            }

            ${
                inputsList
                    ? `
                <text:list xml:id="${inputsList}" text:continue-numbering="true" text:continue-list="${
                          propertiesList || titleList
                      }" text:style-name="Outline">
                    <text:list-item>
                        <text:list>
                            <text:list-item>
                                <text:h text:style-name="Heading_20_2" text:outline-level="2">Inputs</text:h>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>

                ${componentInfo.inputs
                    .filter(input => !componentInfo.isEmptyInput(input.name))
                    .map(input => {
                        const inputName = input.name;

                        let inputDescription = getInputDescription(input);

                        return `
                            <text:list xml:id="${context.getListID()}" text:continue-numbering="true" text:style-name="Outline">
                                <text:list-item>
                                    <text:list>
                                        <text:list-item>
                                            <text:list>
                                                <text:list-item>
                                                    <text:h text:style-name="Heading_20_3" text:outline-level="3">
                                                        ${inputName}
                                                        <text:s text:c="4"/>
                                                        <text:span text:style-name="T2">${inputDescription}</text:span>
                                                    </text:h>
                                                </text:list-item>
                                            </text:list>
                                        </text:list-item>
                                    </text:list>
                                </text:list-item>
                            </text:list>
                            ${markdownToODT(
                                context,
                                componentInfo.getInputDescriptionMarkdown(
                                    input.name
                                )
                            )}`;
                    })
                    .join()}`
                    : ""
            }

            ${
                outputsList
                    ? `
                <text:list xml:id="${outputsList}" text:continue-numbering="true" text:continue-list="${
                          inputsList || propertiesList || titleList
                      }" text:style-name="Outline">
                    <text:list-item>
                        <text:list>
                            <text:list-item>
                                <text:h text:style-name="Heading_20_2" text:outline-level="2">Outputs</text:h>
                            </text:list-item>
                        </text:list>
                    </text:list-item>
                </text:list>

                ${componentInfo.outputs
                    .filter(output => !componentInfo.isEmptyOutput(output.name))
                    .map(output => {
                        const outputName = output.name;

                        let outputDescription = getOutputDescription(output);

                        return `
                            <text:list xml:id="${context.getListID()}" text:continue-numbering="true" text:style-name="Outline">
                                <text:list-item>
                                    <text:list>
                                        <text:list-item>
                                            <text:list>
                                                <text:list-item>
                                                    <text:h text:style-name="Heading_20_3" text:outline-level="3">
                                                        ${outputName}
                                                        <text:s text:c="4"/>
                                                        <text:span text:style-name="T2">${outputDescription}</text:span>
                                                    </text:h>
                                                </text:list-item>
                                            </text:list>
                                        </text:list-item>
                                    </text:list>
                                </text:list-item>
                            </text:list>
                            ${markdownToODT(
                                context,
                                componentInfo.getOutputDescriptionMarkdown(
                                    output.name
                                )
                            )}`;
                    })
                    .join()}`
                    : ""
            }


            ${
                examplesList
                    ? `
                    <text:list xml:id="${examplesList}" text:continue-numbering="true" text:continue-list="${
                          outputsList ||
                          inputsList ||
                          propertiesList ||
                          titleList
                      }" text:style-name="Outline">
                        <text:list-item>
                            <text:list>
                                <text:list-item>
                                    <text:h text:style-name="Heading_20_2" text:outline-level="2">Examples</text:h>
                                </text:list-item>
                            </text:list>
                        </text:list-item>
                    </text:list>
                    <text:p text:style-name="Standard"/>
                    ${markdownToODT(
                        context,
                        componentInfo.getExamplesMarkdown()
                    )}`
                    : ""
            }

        </office:text>
    </office:body>
</office:document-content>
`;

    const archiver = await import("archiver");

    await new Promise<void>((resolve, reject) => {
        var archive = archiver.default("zip", {
            zlib: {
                level: 9
            }
        });

        var output = fs.createWriteStream(filePath);

        output.on("close", function () {
            resolve();
        });

        archive.on("warning", function (err: any) {
            console.warn(err);
        });

        archive.on("error", function (err: any) {
            reject(err);
        });

        const odtTemplatePath = `${sourceRootDir()}/../docs/odt-template`;
        archive.directory(odtTemplatePath, false);

        archive.append(content, { name: "content.xml" });

        const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
    <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:version="1.2" manifest:full-path="/"/>
    <manifest:file-entry manifest:media-type="image/png" manifest:full-path="Thumbnails/thumbnail.png"/>
    <manifest:file-entry manifest:media-type="application/binary" manifest:full-path="layout-cache"/>
    <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
    <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="settings.xml"/>
    <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
    <manifest:file-entry manifest:media-type="image/png" manifest:full-path="Pictures/10000201000000A5000000B7716881E3.png"/>
    <manifest:file-entry manifest:media-type="image/png" manifest:full-path="Pictures/100002010000036D0000027EEDA92E76.png"/>
    <manifest:file-entry manifest:media-type="image/png" manifest:full-path="Pictures/100002010000036B0000031B40540EF8.png"/>
    <manifest:file-entry manifest:media-type="image/png" manifest:full-path="Pictures/100002010000036D0000027E5239E6C0.png"/>
    ${[...context.images]
        .map(
            image =>
                `<manifest:file-entry manifest:media-type="image/png" manifest:full-path="Pictures/${image}"/>`
        )
        .join("\n")}
    <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
    <manifest:file-entry manifest:media-type="application/rdf+xml" manifest:full-path="manifest.rdf"/>
    <manifest:file-entry manifest:media-type="" manifest:full-path="Configurations2/accelerator/current.xml"/>
    <manifest:file-entry manifest:media-type="application/vnd.sun.xml.ui.configuration" manifest:full-path="Configurations2/"/>
</manifest:manifest>
`;

        archive.append(manifest, { name: "META-INF/manifest.xml" });

        [...context.images].forEach(image => {
            archive.file(
                `${sourceRootDir()}/../help/en-US/components/images/${image}`,
                { name: "Pictures/" + image }
            );
        });

        archive.pipe(output);

        archive.finalize();
    });
}

export async function generateODTFilesForAllComponents() {
    const progressToastId = notification.info("Start...", {
        autoClose: false
    });

    const folderPath = `${sourceRootDir()}/../docs/components/odt/en-US`;

    const model = getModel();

    const n = model.allComponentsNoSearchFilter.length;
    let i = 0;

    const imageDimensions = new Map<
        string,
        { width: number; height: number }
    >();
    await (async () => {
        const imagesFolderPath = `${sourceRootDir()}/../help/en-US/components/images`;
        const images = await fs.promises.readdir(imagesFolderPath);

        await Promise.all(
            images.map(image => {
                return new Promise<void>((resolve, reject) => {
                    var img = new Image();
                    img.onload = function () {
                        imageDimensions.set(image, {
                            width: img.width,
                            height: img.height
                        });
                        resolve();
                    };
                    img.onerror = function () {
                        reject();
                    };
                    img.src = `file://${imagesFolderPath}/${image}`;
                });
            })
        );
    })();

    for (const componentInfo of model.allComponentsNoSearchFilter) {
        try {
            await generateODTFile(
                componentInfo,
                folderPath +
                    "/" +
                    componentInfo.type +
                    "s/" +
                    componentInfo.name +
                    ".odt",
                imageDimensions
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
        render: "Done.",
        type: notification.SUCCESS,
        autoClose: 3000
    });
}
