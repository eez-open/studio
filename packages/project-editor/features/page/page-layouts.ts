import { toJS } from "mobx";

import { BoundingRectBuilder, Rect } from "eez-studio-shared/geometry";

import {
    IEezObject,
    PropertyInfo,
    PropertyProps,
    PropertyType,
    findPropertyByNameInClassInfo,
    getKey,
    getParent,
    getProperty,
    isEezObject,
    MessageType
} from "project-editor/core/object";
import {
    findPropertyByNameInObject,
    getClassInfo,
    getObjectPath,
    getObjectPathAsString,
    getProjectStore,
    getPropertySourceInfo,
    PropertyValueSourceInfo
} from "project-editor/store/helper";
import { updateObject } from "project-editor/store/commands";
import { Message } from "project-editor/store/output-sections";
import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Page, PageLayout } from "project-editor/features/page/page";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import type { Component, Widget } from "project-editor/flow/component";
import type {
    Style,
    PageLayoutStyle
} from "project-editor/features/style/style";
import type { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

// Values of the layout specific properties (see PropertyInfo.layoutSpecific)
// that are changed in the page layout, by the page layout name. The value of
// the style property contains only the changed style properties, for example:
// { horz: { left: 10, width: 100, style: { font: "small" } } }
export type WidgetLayoutProperties = {
    [layoutName: string]: {
        [propertyName: string]: any;
    };
};

////////////////////////////////////////////////////////////////////////////////

export function isPageLayoutsSupported(page: Page) {
    const project = ProjectEditor.getProject(page);
    return (
        project.projectTypeTraits.isFirmware &&
        !project.projectTypeTraits.isEezGuiLite &&
        project.settings.general.projectVersion !== "v1" &&
        project.settings.general.projectVersion !== "v2" &&
        !page.isUsedAsUserWidget
    );
}

export function getPageLayouts(page: Page): PageLayout[] {
    if (
        !page.layouts ||
        page.layouts.length == 0 ||
        !isPageLayoutsSupported(page)
    ) {
        return [];
    }
    return page.layouts;
}

// page with layouts the object (page or widget) belongs to
export function getLayoutsPage(object: IEezObject): Page | undefined {
    const page = ProjectEditor.getPage(object);
    return page && getPageLayouts(page).length > 0 ? page : undefined;
}

export function getPageOfPageLayout(pageLayout: PageLayout) {
    return getParent(getParent(pageLayout)) as Page;
}

// for each page layout a page is built with this name
export function getPageLayoutPageName(page: Page, pageLayout: PageLayout) {
    return page.name + pageLayout.name;
}

// finds the page built for the page layout by its name
export function findPageLayoutPage(project: Project, pageName: string) {
    for (const page of project.pages) {
        for (const pageLayout of getPageLayouts(page)) {
            if (getPageLayoutPageName(page, pageLayout) == pageName) {
                return { page, pageLayout };
            }
        }
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

function getPageTabState(page: Page) {
    const editor = getProjectStore(page).editorsStore?.getEditorByObject(page);
    return editor?.state as PageTabState | undefined;
}

// page layout selected in the editor of the page the object belongs to
export function getEditorPageLayout(
    object: IEezObject
): PageLayout | undefined {
    const page = getLayoutsPage(object);
    if (!page) {
        return undefined;
    }
    return getPageTabState(page)?.selectedPageLayout;
}

// is "Apply to all layouts" enabled in the editor of the page the object
// belongs to
export function isApplyToAllLayouts(object: IEezObject) {
    const page = getLayoutsPage(object);
    if (!page) {
        return false;
    }
    return getPageTabState(page)?.applyToAllLayouts ?? false;
}

////////////////////////////////////////////////////////////////////////////////

function isLayoutSpecificProperty(object: IEezObject, propertyName: string) {
    return !!findPropertyByNameInObject(object, propertyName)?.layoutSpecific;
}

function getLayoutValue(
    component: Component,
    pageLayout: PageLayout,
    propertyName: string
) {
    return (component as Widget).layoutProperties?.[pageLayout.name]?.[
        propertyName
    ];
}

// value of the layout specific property in the page layout, the default
// value is returned if the value is not changed in the page layout
export function getLayoutPropertyValue(
    component: Component,
    propertyName: string,
    pageLayout: PageLayout | undefined
): any {
    if (pageLayout) {
        const propertyInfo = findPropertyByNameInObject(
            component,
            propertyName
        );
        if (propertyInfo?.layoutSpecific) {
            if (propertyInfo.type == PropertyType.Object) {
                return getWidgetStyleInLayout(
                    component as Widget,
                    propertyName,
                    pageLayout
                );
            }

            const value = getLayoutValue(component, pageLayout, propertyName);
            if (value !== undefined) {
                return value;
            }
        }
    }
    return (component as any)[propertyName];
}

// value of the layout specific property in the page layout selected in the
// editor, or the property value if there is no page layout
export function getEditorLayoutPropertyValue(
    object: IEezObject,
    propertyName: string
): any {
    if (object instanceof ProjectEditor.WidgetClass) {
        return getLayoutPropertyValue(
            object,
            propertyName,
            getEditorPageLayout(object)
        );
    }
    return (object as any)[propertyName];
}

export function isLayoutPropertyChanged(
    widget: Widget,
    propertyName: string,
    pageLayout: PageLayout
) {
    return getLayoutValue(widget, pageLayout, propertyName) !== undefined;
}

// Is the value of the layout specific property, shown in the property grid,
// changed in the page layout selected in the editor. Returns undefined if the
// property is not shown for the page layout.
export function getPageLayoutPropertySourceInfo(
    props: PropertyProps
): PropertyValueSourceInfo | undefined {
    const { objects, propertyInfo } = props;

    if (objects.length == 0) {
        return undefined;
    }

    if (objects[0] instanceof ProjectEditor.PageLayoutStyleClass) {
        const layoutStyle = objects[0];
        const sourceInfo = getPropertySourceInfo(props);

        if (
            sourceInfo.source == "modified" &&
            !isApplyToAllLayouts(layoutStyle.widget)
        ) {
            return {
                ...sourceInfo,
                title: `Changed in the "${layoutStyle.pageLayout.name}" layout`
            };
        }

        if (
            sourceInfo.source == "inherited" &&
            sourceInfo.inheritedFrom == layoutStyle.baseStyle
        ) {
            return {
                ...sourceInfo,
                title: "Inherited from the widget style, which is used in all layouts"
            };
        }

        return sourceInfo;
    }

    if (
        !propertyInfo.layoutSpecific ||
        propertyInfo.type == PropertyType.Object
    ) {
        return undefined;
    }

    let pageLayout: PageLayout | undefined;
    let changed = false;

    for (const object of objects) {
        if (!(object instanceof ProjectEditor.WidgetClass)) {
            return undefined;
        }

        pageLayout = getEditorPageLayout(object);
        if (!pageLayout) {
            return undefined;
        }

        if (isLayoutPropertyChanged(object, propertyInfo.name, pageLayout)) {
            changed = true;
        }
    }

    return changed
        ? {
              source: "modified",
              title: `Changed in the "${pageLayout!.name}" layout`
          }
        : {
              source: "default",
              title: `Not changed in the "${pageLayout!.name}" layout, the same value is used in all layouts where it is not changed`
          };
}

////////////////////////////////////////////////////////////////////////////////

// List and Grid item widget and Select child widgets can't be hidden in the
// page layout, because Select selects the child widget by its index.
export function canBeHiddenInLayout(widget: Widget) {
    if (getKey(widget) == "itemWidget") {
        return false;
    }
    return !(
        ProjectEditor.getWidgetParent(widget) instanceof
        ProjectEditor.SelectWidgetClass
    );
}

// is the widget itself visible in the page layout (its parent widgets can
// still be hidden in the page layout, see isWidgetShownInLayout)
export function isWidgetVisibleInLayout(
    widget: Widget,
    pageLayout: PageLayout
) {
    return (
        !canBeHiddenInLayout(widget) ||
        getLayoutPropertyValue(widget, "visibleInLayout", pageLayout) !== false
    );
}

// is the widget visible in the page layout selected in the editor
export function isWidgetVisibleInEditorLayout(widget: Widget) {
    const pageLayout = getEditorPageLayout(widget);
    return !pageLayout || isWidgetVisibleInLayout(widget, pageLayout);
}

// is the widget built in the page for the page layout, i.e. the widget and
// all its parent widgets are visible in the page layout
export function isWidgetShownInLayout(widget: Widget, pageLayout: PageLayout) {
    for (
        let object: Component | Page = widget;
        object instanceof ProjectEditor.WidgetClass;
        object = ProjectEditor.getWidgetParent(object)
    ) {
        if (!isWidgetVisibleInLayout(object, pageLayout)) {
            return false;
        }
    }
    return true;
}

// is the widget shown in the page layout selected in the editor
export function isWidgetShownInEditorLayout(widget: Widget) {
    const pageLayout = getEditorPageLayout(widget);
    return !pageLayout || isWidgetShownInLayout(widget, pageLayout);
}

////////////////////////////////////////////////////////////////////////////////

// Check message for the page layout. The same problem can be found in more
// than one page layout for the same object (e.g. widget is outside of its
// parent), so the message id, which is by default the object path, also
// contains the message text, which contains the page layout name. The text is
// encoded because the id is used in the CSS selectors (e.g. [data-object-id="..."]).
export function newPageLayoutMessage(
    type: MessageType,
    text: string,
    object: IEezObject | undefined
) {
    const message = new Message(type, text, object, undefined, true);
    message._id =
        (object ? getObjectPathAsString(object) : message._id) +
        "#" +
        encodeURIComponent(text);
    return message;
}

////////////////////////////////////////////////////////////////////////////////

const pageLayoutStyles = new WeakMap<Widget, Map<string, PageLayoutStyle>>();

// style of the widget in the page layout (see PageLayoutStyle)
export function getWidgetStyleInLayout(
    widget: Widget,
    stylePropertyName: string,
    pageLayout: PageLayout | undefined
): Style {
    if (!pageLayout || !isLayoutSpecificProperty(widget, stylePropertyName)) {
        return (widget as any)[stylePropertyName];
    }

    let widgetStyles = pageLayoutStyles.get(widget);
    if (!widgetStyles) {
        widgetStyles = new Map();
        pageLayoutStyles.set(widget, widgetStyles);
    }

    const key = pageLayout.objID + "/" + stylePropertyName;

    let pageLayoutStyle = widgetStyles.get(key);
    if (!pageLayoutStyle) {
        pageLayoutStyle = new ProjectEditor.PageLayoutStyleClass(
            widget,
            stylePropertyName,
            pageLayout,
            () => isApplyToAllLayouts(widget)
        );
        widgetStyles.set(key, pageLayoutStyle);
    }

    return pageLayoutStyle;
}

// style of the widget in the page layout selected in the editor
export function getWidgetStyleInEditorLayout(
    widget: Widget,
    stylePropertyName: string
) {
    return getWidgetStyleInLayout(
        widget,
        stylePropertyName,
        getEditorPageLayout(widget)
    );
}

////////////////////////////////////////////////////////////////////////////////

function cloneLayoutProperties(widget: Widget): WidgetLayoutProperties {
    return widget.layoutProperties ? toJS(widget.layoutProperties) : {};
}

function setLayoutValue(
    layoutProperties: WidgetLayoutProperties,
    layoutName: string,
    propertyName: string,
    value: any
) {
    if (value !== undefined) {
        (layoutProperties[layoutName] ??= {})[propertyName] = value;
    } else {
        const values = layoutProperties[layoutName];
        if (values) {
            delete values[propertyName];
            if (Object.keys(values).length == 0) {
                delete layoutProperties[layoutName];
            }
        }
    }
}

function setLayoutStyleValues(
    layoutProperties: WidgetLayoutProperties,
    layoutName: string,
    stylePropertyName: string,
    values: any
) {
    const styleValues = Object.assign(
        {},
        layoutProperties[layoutName]?.[stylePropertyName]
    );

    for (const propertyName of Object.keys(values)) {
        if (values[propertyName] !== undefined) {
            styleValues[propertyName] = values[propertyName];
        } else {
            delete styleValues[propertyName];
        }
    }

    setLayoutValue(
        layoutProperties,
        layoutName,
        stylePropertyName,
        Object.keys(styleValues).length > 0 ? styleValues : undefined
    );
}

function nonEmpty(layoutProperties: WidgetLayoutProperties) {
    return Object.keys(layoutProperties).length > 0
        ? layoutProperties
        : undefined;
}

function setLayoutProperties(
    widget: Widget,
    layoutProperties: WidgetLayoutProperties
) {
    const newValue = nonEmpty(layoutProperties);

    if (
        JSON.stringify(newValue) !=
        JSON.stringify(toJS(widget.layoutProperties))
    ) {
        updateObject(widget, { layoutProperties: newValue });
    }
}

// the values of all style properties that are set in the style
function getStyleValues(style: Style | any) {
    if (!isEezObject(style)) {
        return style;
    }

    const values: any = {};
    for (const propertyInfo of getClassInfo(style).properties) {
        if (
            propertyInfo.computed ||
            propertyInfo.type == PropertyType.Array ||
            propertyInfo.type == PropertyType.Object
        ) {
            continue;
        }
        const value = getProperty(style, propertyInfo.name);
        if (value !== undefined) {
            values[propertyInfo.name] = toJS(value);
        }
    }
    return values;
}

// the position and size must always have the value
function canDefaultValueBeUndefined(propertyInfo: PropertyInfo) {
    return (
        propertyInfo.type != PropertyType.Number &&
        propertyInfo.type != PropertyType.Any &&
        propertyInfo.type != PropertyType.Object
    );
}

let pageLayoutUpdateSuspended = 0;

// the values of the layout specific properties are changed as is, i.e. not
// in the page layout selected in the editor, while the callback is executed
export function withoutPageLayoutUpdate<T>(callback: () => T): T {
    pageLayoutUpdateSuspended++;
    try {
        return callback();
    } finally {
        pageLayoutUpdateSuspended--;
    }
}

// Is the change of the object values (see updateObject) done in the page
// layout selected in the editor. If values contain layoutProperties then the
// caller is responsible for the page layouts.
export function isPageLayoutUpdate(object: IEezObject, values: any) {
    if (pageLayoutUpdateSuspended > 0) {
        return false;
    }

    if (object instanceof ProjectEditor.PageLayoutStyleClass) {
        return true;
    }

    if (
        !(object instanceof ProjectEditor.WidgetClass) ||
        "layoutProperties" in values ||
        !Object.keys(values).find(propertyName =>
            isLayoutSpecificProperty(object, propertyName)
        )
    ) {
        return false;
    }

    return getEditorPageLayout(object) != undefined;
}

// Changes of the layout specific properties are stored in the page layout
// selected in the editor or, if "Apply to all layouts" is enabled, the default
// value is changed and removed from all the page layouts. Returns the values
// that should be set to the object.
export function updatePageLayoutValues(object: IEezObject, values: any) {
    if (object instanceof ProjectEditor.PageLayoutStyleClass) {
        updatePageLayoutStyle(object, values);
        return {};
    }

    const widget = object as Widget;
    const pageLayout = getEditorPageLayout(widget)!;
    const applyToAllLayouts = isApplyToAllLayouts(widget);

    const layoutProperties = cloneLayoutProperties(widget);
    const result = Object.assign({}, values);

    for (const propertyName of Object.keys(values)) {
        const propertyInfo = findPropertyByNameInObject(widget, propertyName);
        if (!propertyInfo?.layoutSpecific) {
            continue;
        }

        let value = values[propertyName];

        if (applyToAllLayouts) {
            for (const layoutName of Object.keys(layoutProperties)) {
                setLayoutValue(
                    layoutProperties,
                    layoutName,
                    propertyName,
                    undefined
                );
            }

            if (
                value === undefined &&
                !canDefaultValueBeUndefined(propertyInfo)
            ) {
                delete result[propertyName];
            }
        } else {
            if (propertyInfo.type == PropertyType.Object) {
                value = value !== undefined ? getStyleValues(value) : undefined;
            }

            setLayoutValue(
                layoutProperties,
                pageLayout.name,
                propertyName,
                value
            );

            delete result[propertyName];
        }
    }

    setLayoutProperties(widget, layoutProperties);

    return result;
}

function updatePageLayoutStyle(layoutStyle: PageLayoutStyle, values: any) {
    const { widget, stylePropertyName, pageLayout } = layoutStyle;

    const layoutProperties = cloneLayoutProperties(widget);

    if (isApplyToAllLayouts(widget)) {
        updateObject(layoutStyle.baseStyle, values);

        const undefinedValues: any = {};
        for (const propertyName of Object.keys(values)) {
            undefinedValues[propertyName] = undefined;
        }
        for (const layoutName of Object.keys(layoutProperties)) {
            setLayoutStyleValues(
                layoutProperties,
                layoutName,
                stylePropertyName,
                undefinedValues
            );
        }
    } else {
        setLayoutStyleValues(
            layoutProperties,
            pageLayout.name,
            stylePropertyName,
            values
        );
    }

    setLayoutProperties(widget, layoutProperties);
}

////////////////////////////////////////////////////////////////////////////////
// widgets are moved into or out of the container widget

const POSITION_AND_SIZE = ["left", "top", "width", "height"] as const;

// Position and size, in each page layout, of the new widget that encloses the
// widgets (for example, the container created by "Put in Container"). The rect
// is its default position and size. Returns undefined if the widgets are not
// on the page with layouts.
export function getEnclosingWidgetLayoutProperties(
    widgets: Widget[],
    rect: Rect
) {
    const page = getLayoutsPage(widgets[0]);
    if (!page) {
        return undefined;
    }

    const layoutProperties: WidgetLayoutProperties = {};
    const layoutRects = new Map<PageLayout, Rect>();

    for (const pageLayout of getPageLayouts(page)) {
        const visibleWidgets = widgets.filter(widget =>
            isWidgetVisibleInLayout(widget, pageLayout)
        );

        if (visibleWidgets.length == 0) {
            // none of the enclosed widgets exists in this page layout
            setLayoutValue(
                layoutProperties,
                pageLayout.name,
                "visibleInLayout",
                false
            );
            layoutRects.set(pageLayout, rect);
            continue;
        }

        const builder = new BoundingRectBuilder();
        visibleWidgets.forEach(widget =>
            builder.addRect(widget.getRectInPageLayout(pageLayout))
        );
        const layoutRect = builder.getRect();
        layoutRects.set(pageLayout, layoutRect);

        for (const propertyName of POSITION_AND_SIZE) {
            if (layoutRect[propertyName] != rect[propertyName]) {
                setLayoutValue(
                    layoutProperties,
                    pageLayout.name,
                    propertyName,
                    layoutRect[propertyName]
                );
            }
        }
    }

    return {
        layoutProperties: nonEmpty(layoutProperties),
        layoutRects
    };
}

// Position of the enclosed widget relative to the enclosing widget (see
// getEnclosingWidgetLayoutProperties), by default and in each page layout.
export function getEnclosedWidgetLayoutValues(
    widget: Widget,
    rect: Rect,
    layoutRects: Map<PageLayout, Rect>
) {
    const left = widget.left - rect.left;
    const top = widget.top - rect.top;

    const layoutProperties = cloneLayoutProperties(widget);

    for (const [pageLayout, layoutRect] of layoutRects) {
        const widgetRect = widget.getRectInPageLayout(pageLayout);

        const layoutLeft = widgetRect.left - layoutRect.left;
        setLayoutValue(
            layoutProperties,
            pageLayout.name,
            "left",
            layoutLeft != left ? layoutLeft : undefined
        );

        const layoutTop = widgetRect.top - layoutRect.top;
        setLayoutValue(
            layoutProperties,
            pageLayout.name,
            "top",
            layoutTop != top ? layoutTop : undefined
        );
    }

    return {
        left,
        top,
        layoutProperties: nonEmpty(layoutProperties)
    };
}

// Position of the widget, by default and in each page layout, when it is
// moved out of the container, i.e. relative to the container parent.
export function getUnenclosedWidgetLayoutValues(
    widget: Widget,
    container: Widget
) {
    const left = widget.left + container.left;
    const top = widget.top + container.top;

    const layoutProperties = cloneLayoutProperties(widget);

    const page = getLayoutsPage(widget);
    if (page) {
        for (const pageLayout of getPageLayouts(page)) {
            const widgetRect = widget.getRectInPageLayout(pageLayout);
            const containerRect = container.getRectInPageLayout(pageLayout);

            const layoutLeft = widgetRect.left + containerRect.left;
            setLayoutValue(
                layoutProperties,
                pageLayout.name,
                "left",
                layoutLeft != left ? layoutLeft : undefined
            );

            const layoutTop = widgetRect.top + containerRect.top;
            setLayoutValue(
                layoutProperties,
                pageLayout.name,
                "top",
                layoutTop != top ? layoutTop : undefined
            );

            if (!isWidgetVisibleInLayout(container, pageLayout)) {
                setLayoutValue(
                    layoutProperties,
                    pageLayout.name,
                    "visibleInLayout",
                    false
                );
            }
        }
    }

    return {
        left,
        top,
        layoutProperties: nonEmpty(layoutProperties)
    };
}

// values of the given properties changed in the page layouts
export function pickLayoutValues(widget: Widget, propertyNames: string[]) {
    const layoutProperties = cloneLayoutProperties(widget);

    for (const [layoutName, layoutValues] of Object.entries(
        layoutProperties
    )) {
        for (const propertyName of Object.keys(layoutValues)) {
            if (propertyNames.indexOf(propertyName) == -1) {
                setLayoutValue(
                    layoutProperties,
                    layoutName,
                    propertyName,
                    undefined
                );
            }
        }
    }

    return nonEmpty(layoutProperties);
}

// values changed in the page layouts, without the given properties
export function omitLayoutValues(widget: Widget, propertyNames: string[]) {
    const layoutProperties = cloneLayoutProperties(widget);

    for (const layoutName of Object.keys(layoutProperties)) {
        for (const propertyName of propertyNames) {
            setLayoutValue(
                layoutProperties,
                layoutName,
                propertyName,
                undefined
            );
        }
    }

    return nonEmpty(layoutProperties);
}

// removes the page layout values from the widgets, given as JS objects, that
// are moved to the page without layouts (for example, to the user widget)
export function deleteLayoutValues(jsObject: any) {
    if (Array.isArray(jsObject)) {
        jsObject.forEach(deleteLayoutValues);
    } else if (jsObject && typeof jsObject == "object") {
        delete jsObject.layoutProperties;
        delete jsObject.visibleInLayout;
        Object.values(jsObject).forEach(deleteLayoutValues);
    }
}

////////////////////////////////////////////////////////////////////////////////

function* visitWidgets(object: IEezObject): IterableIterator<Widget> {
    if (Array.isArray(object)) {
        for (const child of object) {
            yield* visitWidgets(child);
        }
    } else {
        if (object instanceof ProjectEditor.WidgetClass) {
            yield object;
        }

        for (const propertyInfo of getClassInfo(object).properties) {
            if (
                propertyInfo.type == PropertyType.Object ||
                propertyInfo.type == PropertyType.Array
            ) {
                const value = getProperty(object, propertyInfo.name);
                if (value) {
                    yield* visitWidgets(value);
                }
            }
        }
    }
}

// widgets with the values changed in the page layouts
function getWidgetsWithLayoutProperties(object: IEezObject) {
    const widgets: Widget[] = [];
    for (const widget of visitWidgets(object)) {
        if (widget.layoutProperties) {
            widgets.push(widget);
        }
    }
    return widgets;
}

// called before the page layout is renamed
export function renamePageLayout(pageLayout: PageLayout, newName: string) {
    const oldName = pageLayout.name;
    if (oldName == newName) {
        return;
    }

    const page = getPageOfPageLayout(pageLayout);
    for (const widget of getWidgetsWithLayoutProperties(page.components)) {
        const layoutProperties = cloneLayoutProperties(widget);
        if (layoutProperties[oldName]) {
            layoutProperties[newName] = layoutProperties[oldName];
            delete layoutProperties[oldName];
            setLayoutProperties(widget, layoutProperties);
        }
    }
}

// called before the page layout is deleted
export function deletePageLayout(pageLayout: PageLayout) {
    const page = getPageOfPageLayout(pageLayout);
    for (const widget of getWidgetsWithLayoutProperties(page.components)) {
        const layoutProperties = cloneLayoutProperties(widget);
        if (layoutProperties[pageLayout.name]) {
            delete layoutProperties[pageLayout.name];
            setLayoutProperties(widget, layoutProperties);
        }
    }
}

// References to the renamed object (style, font, color...) are not found by
// the search inside the values changed in the page layouts, so they are
// replaced here.
export function replaceObjectReferenceInPageLayouts(
    project: IEezObject,
    object: IEezObject,
    newName: string
) {
    if (!(project instanceof ProjectEditor.ProjectClass)) {
        return;
    }

    const objectName = (object as any).name;
    if (!objectName) {
        return;
    }

    const objectParent = getParent(object);
    if (!objectParent) {
        return;
    }

    const objectCollectionPath =
        object instanceof ProjectEditor.StyleClass
            ? "allStyles"
            : getObjectPath(objectParent).join("/");

    function isReference(propertyInfo: PropertyInfo | undefined, value: any) {
        return (
            propertyInfo != undefined &&
            (propertyInfo.type == PropertyType.ObjectReference ||
                propertyInfo.type == PropertyType.ThemedColor ||
                propertyInfo.type == PropertyType.Enum) &&
            propertyInfo.referencedObjectCollectionPath ==
                objectCollectionPath &&
            value === objectName
        );
    }

    const widgets = project.pages.flatMap(page =>
        getWidgetsWithLayoutProperties(page.components)
    );

    for (const widget of widgets) {
        const layoutProperties = cloneLayoutProperties(widget);

        for (const layoutValues of Object.values(layoutProperties)) {
            for (const propertyName of Object.keys(layoutValues)) {
                const propertyInfo = findPropertyByNameInObject(
                    widget,
                    propertyName
                );

                if (propertyInfo?.type == PropertyType.Object) {
                    const styleValues = layoutValues[propertyName];
                    for (const stylePropertyName of Object.keys(styleValues)) {
                        if (
                            isReference(
                                findPropertyByNameInClassInfo(
                                    propertyInfo.typeClass!.classInfo,
                                    stylePropertyName
                                ),
                                styleValues[stylePropertyName]
                            )
                        ) {
                            styleValues[stylePropertyName] = newName;
                        }
                    }
                } else if (
                    isReference(propertyInfo, layoutValues[propertyName])
                ) {
                    layoutValues[propertyName] = newName;
                }
            }
        }

        setLayoutProperties(widget, layoutProperties);
    }
}
