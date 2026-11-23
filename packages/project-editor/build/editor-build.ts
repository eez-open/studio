// The editor build: assets with one page for the page editor, which draws
// EEZ-GUI pages with the framework WASM (see EditorBuild in assets.ts).

import { visitObjects } from "project-editor/core/search";
import type { Page } from "project-editor/features/page/page";
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
    // see EditorBuild.getVariantPreview
    getVariantPreview?: (widget: Widget) => string | undefined;
    // the number of items a List or Grid shows (default: the items that fit
    // in its design size, see getEditorListItemCount)
    getListItemCount?: (widget: Widget) => number;
}

const WIDGET_FLAG_GROW = 1 << 6;
const PIN_TO_LEFT = 1;
const PIN_TO_RIGHT = 2;
const PIN_TO_TOP = 4;
const PIN_TO_BOTTOM = 8;

// The size of a List or Grid item when the list has the given size (as
// getListItemSize in eez-framework gui/scrolling.cpp).
function getListItemSize(
    list: Widget,
    horizontal: boolean,
    itemSize: number,
    gap: number,
    size: number
) {
    const designSize = horizontal ? list.width : list.height;
    if (size == designSize || designSize <= 0) {
        return itemSize;
    }

    if (itemSize == designSize) {
        return size;
    }

    const pinToEdge = list.resizing?.pinToEdge ?? 0;
    const stretches =
        (list.getLayoutFlags() & WIDGET_FLAG_GROW) != 0 ||
        (horizontal
            ? (pinToEdge & PIN_TO_LEFT) != 0 && (pinToEdge & PIN_TO_RIGHT) != 0
            : (pinToEdge & PIN_TO_TOP) != 0 && (pinToEdge & PIN_TO_BOTTOM) != 0);
    if (stretches) {
        return itemSize;
    }

    // rounded down: the items that fit in the design still fit
    const pitch = Math.floor(((itemSize + gap) * size) / designSize);
    return Math.max(pitch - gap, 1);
}

// The page editor shows as many items of a List or Grid as fit completely in
// it (at least one), when it has the given size (the design size if not
// given), as eez-framework ListWidgetState and GridWidgetState lay them out.
export function getEditorListItemCount(
    widget: Widget,
    width: number = widget.width,
    height: number = widget.height
) {
    const itemWidget: Widget | undefined = (widget as any).itemWidget;
    if (!itemWidget) {
        return 1;
    }

    if (widget instanceof ProjectEditor.ListWidgetClass) {
        const horizontal = widget.listType == "horizontal";
        const gap = widget.gap || 0;
        const extent = horizontal ? width : height;
        const pitch =
            getListItemSize(
                widget,
                horizontal,
                horizontal ? itemWidget.width : itemWidget.height,
                gap,
                extent
            ) + gap;
        return Math.max(pitch > 0 ? Math.floor((extent + gap) / pitch) : 0, 1);
    }

    const itemW = getListItemSize(widget, true, itemWidget.width, 0, width);
    const itemH = getListItemSize(widget, false, itemWidget.height, 0, height);
    const fitW = itemW > 0 ? Math.floor(width / itemW) : 0;
    const fitH = itemH > 0 ? Math.floor(height / itemH) : 0;
    return Math.max(fitW, 1) * Math.max(fitH, 1);
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

        if (
            widget instanceof ProjectEditor.ListWidgetClass ||
            widget instanceof ProjectEditor.GridWidgetClass
        ) {
            return (
                options.getListItemCount?.(widget) ??
                getEditorListItemCount(widget)
            ).toString();
        }
    }

    if (
        (propertyName == "data" || propertyName == "text") &&
        TEXT_WIDGET_TYPES.has(widget.type)
    ) {
        return JSON.stringify(getEditorText(widget, expression));
    }

    // the label of a DisplayData or Input widget
    if (propertyName == "label" && TEXT_WIDGET_TYPES.has(widget.type)) {
        return JSON.stringify(`{${expression}}`);
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

// the assets of the last editor build of a page
const seeds = new WeakMap<Page, Assets>();

// number of editor builds made in one pass and in all, and a switch to build
// always as the first time (for tests)
export const editorBuildCounts = { seeded: 0, all: 0, useSeeds: true };

// Uncompressed assets (~EEZ) with the page as page 1. Synchronous: run it inside
// a MobX reaction, which then runs again when something the page uses changes,
// and keeps the computed values it reads cached between the runs.
export function buildEditorAssets(
    page: Page,
    options: EditorBuildOptions = {}
) {
    // the project open in the editor (the page can be in its master project)
    const project = getProject(page)._store.project;

    const editorBuild: EditorBuild = {
        page,
        userWidgetPages: getUserWidgetPages(page),
        pageBackgroundColor: options.pageBackgroundColor,
        widgetOffsets: options.widgetOffsets,
        getVariantPreview: options.getVariantPreview,
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

    // With the lists of the previous build of the page (see Assets.adoptSeed)
    // one pass builds it; if the lists turn out not to be the ones of this
    // build, it is built again as the first time.
    let assets: Assets | undefined;
    let built: ReturnType<typeof buildGuiAssetsDataSync> | undefined;

    const seed = editorBuildCounts.useSeeds ? seeds.get(page) : undefined;
    if (seed) {
        try {
            const seeded = new Assets(
                project,
                undefined,
                "buildAssets",
                seed.includedMasterProjectAssets,
                editorBuild,
                seed
            );
            if (seeded.seeded) {
                built = buildGuiAssetsDataSync(
                    seeded,
                    getEditorGuiBitmaps(seeded)
                );
                if (seeded.isSeedComplete()) {
                    assets = seeded;
                }
            }
        } catch (err) {
            // the lists of the seed don't fit this build
        }
        if (!assets) {
            built = undefined;
            options.widgetOffsets?.clear();
        }
    }

    if (!assets) {
        assets = new Assets(
            project,
            undefined,
            "buildAssets",
            new Set(),
            editorBuild
        );

        // master project pages and global variables the page uses (as
        // buildAssets)
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
    }

    if (!built) {
        built = buildGuiAssetsDataSync(assets, getEditorGuiBitmaps(assets));
    }
    seeds.set(page, assets);
    editorBuildCounts.all++;
    if (assets.seeded) {
        editorBuildCounts.seeded++;
    }

    const { uncompressedData, uncompressedSize } = built;

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
