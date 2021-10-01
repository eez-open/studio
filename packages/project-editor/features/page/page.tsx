import React from "react";
import { observable, computed } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    registerClass,
    PropertyType,
    generalGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    getParent,
    getId,
    makeDerivedClassInfo
} from "project-editor/core/object";
import { getDocumentStore } from "project-editor/core/store";
import * as output from "project-editor/core/output";

import type {
    IResizeHandler,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import {
    ComponentsContainerEnclosure,
    ComponentGeometry,
    ComponentEnclosure
} from "project-editor/flow/flow-editor/render";

import {
    Project,
    findReferencedObject,
    getProject
} from "project-editor/project/project";

import { Component, Widget } from "project-editor/flow/component";

import { findStyle } from "project-editor/features/style/style";
import { getThemedColor } from "project-editor/features/style/theme";
import {
    PageEditor,
    PagesNavigation,
    PageTabState
} from "project-editor/features/page/PagesNavigation";
import { Rect } from "eez-studio-shared/geometry";
import { Flow } from "project-editor/flow/flow";
import { metrics } from "project-editor/features/page/metrics";
import { build } from "project-editor/features/page/build";
import { Assets, DataBuffer } from "./build/assets";
import { buildWidget } from "./build/widgets";
import { WIDGET_TYPE_CONTAINER } from "project-editor/flow/widgets/widget_types";
import classNames from "classnames";

////////////////////////////////////////////////////////////////////////////////

export class PageOrientation extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable width: number;
    @observable height: number;
    @observable style?: string;
    @observable components: Component[];

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
                referencedObjectCollectionPath: "styles",
                propertyGridGroup: styleGroup
            },
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component,
                hideInPropertyGrid: true
            }
        ],
        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.widgets) {
                jsObject.components = jsObject.widgets;
                delete jsObject.widgets;
            }
        }
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

export class Page extends Flow {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable usedIn?: string[];
    @observable closePageIfTouchedOutside: boolean;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    @observable portrait: PageOrientation;

    @observable isUsedAsCustomWidget: boolean;

    @observable dataContextOverrides: string;

    @observable css: string;

    @observable _geometry: ComponentGeometry;

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
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
                referencedObjectCollectionPath: "styles",
                propertyGridGroup: styleGroup,
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).isDashboardProject
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).isDashboardProject
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).isDashboardProject
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
                name: "css",
                type: PropertyType.String,
                propertyGridGroup: styleGroup,
                hideInPropertyGrid: (object: IEezObject) =>
                    !getDocumentStore(object).isDashboardProject
            }
        ],
        beforeLoadHook: (page: Page, jsObject: any) => {
            if (jsObject.widgets) {
                jsObject.components = jsObject.widgets;
                delete jsObject.widgets;
            }

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
        editorComponent: PageEditor,
        navigationComponent: PagesNavigation,
        icon: "filter",
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
            return true;
        },
        isSelectable: (object: Page) => {
            return true;
        },
        showSelectedObjectsParent: (object: Page) => {
            return true;
        },
        getResizeHandlers(object: Page) {
            return object.getResizeHandlers();
        }
    });

    set geometry(value: ComponentGeometry) {
        this._geometry = value;
    }

    get autoSize() {
        return false;
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

    get pageRect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    }

    renderComponents(flowContext: IFlowContext) {
        return (
            <>
                <ComponentEnclosure
                    component={this}
                    flowContext={flowContext}
                />

                {!flowContext.frontFace && (
                    <ComponentsContainerEnclosure
                        components={this.components.filter(
                            component => !(component instanceof Widget)
                        )}
                        flowContext={
                            flowContext.flowState
                                ? flowContext
                                : flowContext.overrideDataContext(
                                      this.dataContextOverridesObject
                                  )
                        }
                    />
                )}
            </>
        );
    }

    render(flowContext: IFlowContext) {
        return (
            <ComponentsContainerEnclosure
                components={this.components.filter(
                    component => component instanceof Widget
                )}
                flowContext={
                    flowContext.flowState
                        ? flowContext
                        : flowContext.overrideDataContext(
                              this.dataContextOverridesObject
                          )
                }
            />
        );
    }

    getClassName() {
        return classNames(
            { EezStudio_PageFlowContainer: !this.isUsedAsCustomWidget },
            {
                [this.css]: getDocumentStore(this).isDashboardProject
            }
        );
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        const pageStyle = findStyle(getProject(this), this.style || "default");
        if (pageStyle && pageStyle.backgroundColorProperty) {
            style.backgroundColor = to16bitsColor(
                getThemedColor(
                    getDocumentStore(style),
                    pageStyle.backgroundColorProperty
                )
            );
        }

        if (
            !flowContext.document.findObjectById(getId(this)) &&
            !flowContext.DocumentStore.runtimeStore.isRuntimeMode
        ) {
            // this is layout widget page,
            // forbid interaction with the content
            style.pointerEvents = "none";
        }
    }

    getWidgetType() {
        return WIDGET_TYPE_CONTAINER;
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // widgets
        const widgets = this.components.filter(
            widget => widget instanceof Widget
        ) as Widget[];

        dataBuffer.writeArray(widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );

        // flags
        let flags = 0;

        if (this.closePageIfTouchedOutside) {
            flags |= 2;
        }

        dataBuffer.writeUint16(flags);

        // overlay
        dataBuffer.writeInt16(0);
    }
}

registerClass(Page);

////////////////////////////////////////////////////////////////////////////////

export function findPage(project: Project, pageName: string) {
    return findReferencedObject(project, "pages", pageName) as Page | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-page",
    version: "0.1.0",
    description: "Pages support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Pages",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "pages",
                type: PropertyType.Array,
                typeClass: Page,
                icon: "filter",
                create: () => [],
                build: build,
                metrics
            }
        }
    }
};
