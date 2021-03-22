import React from "react";
import { observable, computed } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    PropertyInfo,
    registerClass,
    PropertyType,
    isSubclassOf,
    generalGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    getParent,
    getClass,
    getLabel,
    cloneObject,
    getId
} from "project-editor/core/object";
import { getDocumentStore } from "project-editor/core/store";
import * as output from "project-editor/core/output";

import type {
    IResizeHandler,
    IDesignerContext,
    IDataContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import {
    WidgetContainerComponent,
    WidgetGeometry
} from "project-editor/features/gui/page-editor/render";

import {
    Project,
    findReferencedObject,
    getProject
} from "project-editor/project/project";

import { Widget, IWidget } from "project-editor/features/gui/widget";

import { findStyle } from "project-editor/features/gui/style";
import { getThemedColor } from "project-editor/features/gui/theme";
import { visitObjects } from "project-editor/core/search";
import { deleteObject, ICommandContext } from "project-editor/core/commands";
import { humanize } from "eez-studio-shared/string";
import { objectToClipboardData } from "project-editor/core/clipboard";
import { guid } from "eez-studio-shared/guid";
import {
    PageEditor,
    PagesNavigation,
    PageTabState
} from "project-editor/features/gui/PagesNavigation";
import { Rect } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

export interface IPageOrientation {
    x: number;
    y: number;
    width: number;
    height: number;
    style?: string;
    widgets: IWidget[];
}

export class PageOrientation extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable width: number;
    @observable height: number;
    @observable style?: string;
    @observable widgets: Widget[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "x",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "y",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "gui/styles",
                propertyGridGroup: styleGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            }
        ]
    };

    @computed
    get left() {
        return this.x;
    }

    @computed
    get top() {
        return this.y;
    }

    @computed
    get rect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    @computed
    get closePageIfTouchedOutside() {
        return (getParent(this) as Page).closePageIfTouchedOutside;
    }
}

registerClass(PageOrientation);

////////////////////////////////////////////////////////////////////////////////

export interface IConnectionLine {
    source: string;
    output: string;
    target: string;
    input: string;
}

export class ConnectionLine extends EezObject implements IConnectionLine {
    @observable source: string;
    @observable output: string;
    @observable target: string;
    @observable input: string;

    static classInfo: ClassInfo = {
        label: (connectionLine: ConnectionLine) => {
            return `${getLabel(connectionLine.sourceWidget!)}@${humanize(
                connectionLine.output
            )} ➝ ${getLabel(connectionLine.targetWidget!)}@${humanize(
                connectionLine.input
            )}`;
        },

        properties: [
            {
                name: "source",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "output",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "target",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "input",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],

        isSelectable: () => true
    };

    @computed get sourceWidget() {
        const page = getParent(getParent(this)) as Page;
        return page.wiredWidgets.get(this.source);
    }

    @computed get targetWidget() {
        const page = getParent(getParent(this)) as Page;
        return page.wiredWidgets.get(this.target);
    }

    @computed get sourcePosition() {
        if (!(this.sourceWidget && this.sourceWidget._geometry)) {
            return undefined;
        }

        const outputGeometry = this.sourceWidget._geometry.outputs[this.output];
        if (!outputGeometry) {
            return undefined;
        }

        return {
            x: this.sourceWidget.left + outputGeometry.position.x,
            y: this.sourceWidget.top + outputGeometry.position.y
        };
    }

    @computed get targetPosition() {
        if (!(this.targetWidget && this.targetWidget._geometry)) {
            return undefined;
        }
        const inputGeometry = this.targetWidget._geometry.inputs[this.input];
        if (!inputGeometry) {
            return undefined;
        }

        return {
            x: this.targetWidget.left + inputGeometry.position.x,
            y: this.targetWidget.top + inputGeometry.position.y
        };
    }
}

registerClass(ConnectionLine);

////////////////////////////////////////////////////////////////////////////////

export interface IPageFragment {
    widgets: IWidget[];
    connectionLines: IConnectionLine[];
}

export class PageFragment extends EezObject implements IPageFragment {
    widgets: Widget[];
    connectionLines: ConnectionLine[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine
            }
        ]
    };

    addObjects(page: Page, objects: IEezObject[]) {
        this.widgets = [];
        this.connectionLines = [];

        const DocumentStore = getDocumentStore(page);

        const wireIDMap = new Map<string, string>();

        objects.forEach((object: Widget) => {
            const clone = cloneObject(DocumentStore, object) as Widget;
            if (object.wireID) {
                wireIDMap.set(object.wireID, object.wireID);
            }
            this.widgets.push(clone);
        });

        page.connectionLines.forEach(connectionLine => {
            const source = wireIDMap.get(connectionLine.source);
            const target = wireIDMap.get(connectionLine.target);
            if (source && target) {
                const clone = cloneObject(
                    DocumentStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }

    rewire() {
        const wireIDMap = new Map<string, string>();

        this.widgets.forEach((object: Widget) => {
            if (object.wireID) {
                const wireID = guid();
                wireIDMap.set(object.wireID, wireID);
                object.wireID = wireID;
            }
        });

        this.connectionLines.forEach(connectionLine => {
            const newSource = wireIDMap.get(connectionLine.source)!;
            const newTarget = wireIDMap.get(connectionLine.target)!;
            connectionLine.source = newSource;
            connectionLine.target = newTarget;
        });
    }
}

registerClass(PageFragment);

////////////////////////////////////////////////////////////////////////////////

export interface IPage {
    name: string;
    description?: string;
    style?: string;
    widgets: IWidget[];
    usedIn?: string[];
    closePageIfTouchedOutside: boolean;

    left: number;
    top: number;
    width: number;
    height: number;

    portrait: IPageOrientation;

    isUsedAsCustomWidget: boolean;

    dataContextOverrides: string;

    connectionLines: IConnectionLine[];
}

export class Page extends EezObject implements IPage {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable widgets: Widget[];
    @observable usedIn?: string[];
    @observable closePageIfTouchedOutside: boolean;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    @observable portrait: PageOrientation;

    @observable isUsedAsCustomWidget: boolean;

    @observable dataContextOverrides: string;

    @observable connectionLines: ConnectionLine[];

    @observable _geometry: WidgetGeometry;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                isAssetName: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                propertyGridGroup: generalGroup
            },
            {
                name: "dataContextOverrides",
                displayName: "Data context",
                type: PropertyType.JSON,
                propertyGridGroup: generalGroup
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "gui/styles",
                propertyGridGroup: styleGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                propertyGridGroup: generalGroup
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "portrait",
                type: PropertyType.Object,
                typeClass: PageOrientation,
                isOptional: true,
                hideInPropertyGrid: true,
                enumerable: false
            },
            {
                name: "isUsedAsCustomWidget",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine,
                hideInPropertyGrid: true
            }
        ],
        beforeLoadHook: (page: Page, jsObject: any) => {
            if (jsObject.landscape) {
                Object.assign(jsObject, jsObject.landscape);
                delete jsObject.landscape;
            }

            if (jsObject["x"] !== undefined) {
                jsObject["left"] = jsObject["x"];
                delete jsObject["x"];
            }

            if (jsObject["y"] !== undefined) {
                jsObject["top"] = jsObject["y"];
                delete jsObject["y"];
            }

            if (!jsObject.connectionLines) {
                jsObject.connectionLines = [];
            }
        },
        isPropertyMenuSupported: true,
        newItem: (parent: IEezObject) => {
            return Promise.resolve({
                name: "Page",
                left: 0,
                top: 0,
                width: 480,
                height: 272,
                widgets: []
            });
        },
        createEditorState: (page: Page) => {
            return new PageTabState(page);
        },
        navigationComponentId: "pages",
        findPastePlaceInside: (
            object: IEezObject,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): IEezObject | PropertyInfo | undefined => {
            if (object) {
                if (isSubclassOf(classInfo, Widget.classInfo)) {
                    return (object as Page).widgets;
                } else if (classInfo === PageFragment.classInfo) {
                    return object;
                }
            }
            return undefined;
        },
        editorComponent: PageEditor,
        navigationComponent: PagesNavigation,
        icon: "filter_none",
        check: (object: Page) => {
            let messages: output.Message[] = [];

            if (object.dataContextOverrides) {
                try {
                    JSON.parse(object.dataContextOverrides);
                } catch {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "dataContextOverrides"
                        )
                    );
                }
            }

            return messages;
        },
        getRect: (object: Page) => {
            return {
                left: object.left,
                top: object.top,
                width: object._geometry?.width ?? 0,
                height: object._geometry?.height ?? 0
            };
        },
        setRect: (object: Page, value: Rect) => {
            const props: Partial<Rect> = {};

            if (value.left !== object.left) {
                props.left = value.left;
            }

            if (value.top !== object.top) {
                props.top = value.top;
            }

            if (value.width !== object._geometry?.width ?? 0) {
                props.width = value.width;
            }

            if (value.height !== object._geometry?.height ?? 0) {
                props.height = value.height;
            }

            const DocumentStore = getDocumentStore(object);
            DocumentStore.updateObject(object, props);
        },
        isMoveable: (object: Page) => {
            return !object.isAction;
        },
        isSelectable: (object: Page) => {
            return !object.isAction;
        },
        showSelectedObjectsParent: (object: Page) => {
            return !object.isAction;
        },
        getResizeHandlers(object: Page) {
            return object.getResizeHandlers();
        }
    };

    get autoSize() {
        return false;
    }

    @computed get isAction() {
        return getClass(getParent(this)).name == "Action";
    }

    @computed get wiredWidgets() {
        const widgets = new Map<string, Widget>();

        const v = visitObjects(this.widgets);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Widget) {
                const widget = visitResult.value;
                if (widget.wireID) {
                    widgets.set(widget.wireID, widget);
                }
            }
        }

        return widgets;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 50,
                y: 100,
                type: "s-resize"
            },
            {
                x: 100,
                y: 100,
                type: "se-resize"
            }
        ];
    }

    @computed
    get dataContextOverridesObject() {
        try {
            return JSON.parse(this.dataContextOverrides);
        } catch {
            return undefined;
        }
    }

    deleteConnectionLines(context: ICommandContext, widget: Widget) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceWidget == widget ||
                    connectionLine.targetWidget == widget
            )
            .forEach(connectionLine => deleteObject(context, connectionLine));
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const pageFragment = new PageFragment();
        pageFragment.addObjects(this, objects);
        return objectToClipboardData(pageFragment);
    }

    pastePageFragment(pageFragment: PageFragment) {
        const DocumentStore = getDocumentStore(this);

        DocumentStore.UndoManager.setCombineCommands(true);

        pageFragment.rewire();

        pageFragment.widgets.forEach(widget => {
            widget.left += 20;
            widget.top += 20;
        });

        DocumentStore.addObjects(
            this.connectionLines,
            pageFragment.connectionLines
        );

        const widgets = DocumentStore.addObjects(
            this.widgets,
            pageFragment.widgets
        );

        DocumentStore.UndoManager.setCombineCommands(false);

        return widgets;
    }

    render(designerContext: IDesignerContext, dataContext: IDataContext) {
        return (
            <WidgetContainerComponent
                widgets={this.widgets}
                designerContext={designerContext}
                dataContext={dataContext.create(
                    this.dataContextOverridesObject
                )}
            />
        );
    }

    getClassName() {
        return "";
    }

    styleHook(
        style: React.CSSProperties,
        designerContext: IDesignerContext | undefined
    ) {
        const pageStyle = findStyle(getProject(this), this.style || "default");
        if (pageStyle && pageStyle.backgroundColorProperty) {
            style.backgroundColor = to16bitsColor(
                getThemedColor(
                    getDocumentStore(style),
                    pageStyle.backgroundColorProperty
                )
            );
        }

        if (!designerContext?.document.findObjectById(getId(this))) {
            // this is layout widget page,
            // forbid interaction with the content
            style.pointerEvents = "none";
        }
    }
}

registerClass(Page);

////////////////////////////////////////////////////////////////////////////////

export function findPage(project: Project, pageName: string) {
    return findReferencedObject(project, "gui/pages", pageName) as
        | Page
        | undefined;
}
