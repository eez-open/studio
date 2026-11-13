// The editor build: assets with one page for the page editor, which draws
// EEZ-GUI pages with the framework WASM (see EditorBuild in assets.ts).

import { visitObjects } from "project-editor/core/search";
import type { Page, PageLayout } from "project-editor/features/page/page";
import type { Widget } from "project-editor/flow/component";
import { evalConstantExpression } from "project-editor/flow/expression";
import { findPage, getProject } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    Assets,
    buildGuiAssetsDataSync,
    EditorBuild
} from "project-editor/build/assets";
import { getEditorGuiBitmaps } from "project-editor/build/bitmaps";

export interface EditorBuildOptions {
    // index of the child a Select widget shows (the editor shows the child
    // with the selection, the CLI the first one)
    getSelectChildIndex?: (select: Widget) => number;
    // see EditorBuild.pageBackgroundColor
    pageBackgroundColor?: string;
    // filled with the offsets of the widgets in the returned assets data (see
    // EezGuiEditorWasm.getWidgetBoxes)
    widgetOffsets?: Map<number, Widget | Page>;
}

// widgets whose "data" (or "text") is shown as text
const TEXT_WIDGET_TYPES = new Set([
    "Text",
    "DisplayData",
    "MultilineText",
    "Button",
    "InputEmbeddedWidget",
    "ToggleButton"
]);

// The text the editor shows for a data expression that isn't a constant: the
// preview, the widget name, or the expression in braces (as getTextValue).
function getEditorText(widget: Widget, expression: string) {
    const preview = (widget as any).preview;
    if (typeof preview == "string" && preview) {
        return preview;
    }
    const name = (widget as any).name;
    if (typeof name == "string" && name) {
        return name;
    }
    return `{${expression}}`;
}

function getWidgetPropertyExpression(
    options: EditorBuildOptions,
    widget: Widget,
    propertyName: string,
    expressionType: string | undefined,
    expression: string
) {
    // the editor doesn't show the widgets hidden in the editor (a Select keeps
    // its children, so they are built and made invisible)
    if (propertyName == "visible") {
        return widget.hiddenInEditor ? "false" : "true";
    }

    if (typeof expression != "string" || expression.trim() == "") {
        return expression;
    }

    if (propertyName == "enabled") {
        return "true";
    }

    try {
        evalConstantExpression(getProject(widget), expression);
        return expression;
    } catch (err) {}

    if (propertyName == "data") {
        if (widget instanceof ProjectEditor.SelectWidgetClass) {
            return (options.getSelectChildIndex?.(widget) ?? 0).toString();
        }

        if (widget instanceof ProjectEditor.ListWidgetClass) {
            return "1";
        }
    }

    if (
        (propertyName == "data" || propertyName == "text") &&
        TEXT_WIDGET_TYPES.has(widget.type)
    ) {
        return JSON.stringify(getEditorText(widget, expression));
    }

    // the value comes from the running instrument: a value of the property's
    // type (a widget can't use undefined for a number, e.g. a refresh rate)
    if (
        expressionType == "integer" ||
        expressionType == "float" ||
        expressionType == "double"
    ) {
        return "0";
    }
    if (expressionType == "boolean") {
        return "false";
    }
    if (expressionType == "string") {
        return '""';
    }
    return "undefined";
}

// the user widget pages the page uses, directly or through other user widgets
function getUserWidgetPages(page: Page) {
    const pages: Page[] = [];

    const visit = (page: Page) => {
        for (const object of visitObjects(page)) {
            if (
                object instanceof ProjectEditor.UserWidgetWidgetClass &&
                object.userWidgetPageName
            ) {
                const userWidgetPage = findPage(
                    getProject(object),
                    object.userWidgetPageName
                );
                if (
                    userWidgetPage &&
                    userWidgetPage != page &&
                    pages.indexOf(userWidgetPage) == -1
                ) {
                    pages.push(userWidgetPage);
                    visit(userWidgetPage);
                }
            }
        }
    };

    visit(page);

    return pages;
}

// Uncompressed assets (~EEZ) with the page as page 1. Synchronous: run it inside
// a MobX reaction, which then runs again when something the page uses changes,
// and keeps the computed values it reads cached between the runs.
export function buildEditorAssets(
    page: Page,
    pageLayout: PageLayout | undefined,
    options: EditorBuildOptions = {}
) {
    // the project open in the editor (the page can be in its master project)
    const project = getProject(page)._store.project;

    const editorBuild: EditorBuild = {
        page,
        pageLayout,
        userWidgetPages: getUserWidgetPages(page),
        pageBackgroundColor: options.pageBackgroundColor,
        widgetOffsets: options.widgetOffsets,
        getWidgetPropertyExpression: (
            widget,
            propertyName,
            expressionType,
            expression
        ) =>
            getWidgetPropertyExpression(
                options,
                widget,
                propertyName,
                expressionType,
                expression
            )
    };

    let assets = new Assets(
        project,
        undefined,
        "buildAssets",
        new Set(),
        editorBuild
    );

    // master project pages and global variables the page uses (as buildAssets)
    while (assets.missingMasterProjectAssets.size > 0) {
        assets = new Assets(
            project,
            undefined,
            "buildAssets",
            new Set([
                ...assets.includedMasterProjectAssets,
                ...assets.missingMasterProjectAssets
            ]),
            editorBuild
        );
    }

    const { uncompressedData, uncompressedSize } = buildGuiAssetsDataSync(
        assets,
        getEditorGuiBitmaps(assets)
    );

    // the offsets of the widgets in the returned data, which has the header
    // before the data the widgets were written into
    if (options.widgetOffsets) {
        const headerSize = uncompressedData.length - uncompressedSize;
        const offsets = [...options.widgetOffsets];
        options.widgetOffsets.clear();
        for (const [offset, widget] of offsets) {
            options.widgetOffsets.set(offset + headerSize, widget);
        }
    }

    return uncompressedData;
}
