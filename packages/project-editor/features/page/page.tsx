import React from "react";
import { observable, computed, makeObservable } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    registerClass,
    PropertyType,
    getParent,
    getId,
    makeDerivedClassInfo,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    getDocumentStore,
    getLabel,
    isDashboardProject,
    Message,
    propertyInvalidValueMessage,
    propertyNotFoundMessage
} from "project-editor/store";

import type {
    IResizeHandler,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import {
    ComponentsContainerEnclosure,
    ComponentEnclosure,
    ComponentCanvas
} from "project-editor/flow/editor/render";

import type { Project } from "project-editor/project/project";

import { AutoSize, Component, Widget } from "project-editor/flow/component";
import {
    generalGroup,
    styleGroup,
    geometryGroup
} from "project-editor/components/PropertyGrid/groups";

import { findStyle } from "project-editor/features/style/style";
import { getThemedColor } from "project-editor/features/style/theme";
import { Flow } from "project-editor/flow/flow";
import { metrics } from "project-editor/features/page/metrics";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { buildWidget } from "project-editor/build/widgets";
import { WIDGET_TYPE_CONTAINER } from "project-editor/flow/components/component_types";
import classNames from "classnames";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import * as draw from "project-editor/flow/editor/draw";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";

////////////////////////////////////////////////////////////////////////////////

export class PageOrientation extends EezObject {
    x: number;
    y: number;
    width: number;
    height: number;
    style?: string;
    components: Component[];

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

    constructor() {
        super();

        makeObservable(this, {
            x: observable,
            y: observable,
            width: observable,
            height: observable,
            style: observable,
            components: observable,
            left: computed,
            top: computed,
            rect: computed,
            closePageIfTouchedOutside: computed
        });
    }

    get left() {
        return this.x;
    }

    get top() {
        return this.y;
    }

    get rect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    get closePageIfTouchedOutside() {
        return (getParent(this) as Page).closePageIfTouchedOutside;
    }
}

registerClass("PageOrientation", PageOrientation);

////////////////////////////////////////////////////////////////////////////////

export class Page extends Flow {
    id: number | undefined;
    name: string;
    description?: string;
    style?: string;
    usedIn?: string[];
    closePageIfTouchedOutside: boolean;

    left: number;
    top: number;
    width: number;
    height: number;

    scaleToFit: boolean;

    portrait: PageOrientation;

    isUsedAsCustomWidget: boolean;

    dataContextOverrides: string;

    constructor() {
        super();

        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            style: observable,
            usedIn: observable,
            closePageIfTouchedOutside: observable,
            left: observable,
            top: observable,
            width: observable,
            height: observable,
            scaleToFit: observable,
            portrait: observable,
            isUsedAsCustomWidget: observable,
            dataContextOverrides: observable,
            dataContextOverridesObject: computed
        });
    }

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup
            },
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
                name: "scaleToFit",
                type: PropertyType.Boolean,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles",
                propertyGridGroup: styleGroup
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: isDashboardProject
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
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: isDashboardProject
            }
        ],
        label: (page: Page) => {
            let label = page.name;
            if (page.isUsedAsCustomWidget) {
                label = "[CUSTOM WIDGET] " + label;
            }
            return label;
        },
        listLabel: (page: Page) => {
            let label: React.ReactNode = getLabel(page);
            if (page.isRuntimeSelectedPage) {
                label = <strong>{label}</strong>;
            }
            return label;
        },
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

            if (jsObject.css) {
                jsObject.style = jsObject.css;
                delete jsObject.css;
            }
        },
        isPropertyMenuSupported: true,
        newItem: (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            return showGenericDialog({
                dialogDefinition: {
                    title: "New Page",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {
                    name: project.pages.length == 0 ? "Main" : ""
                }
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    left: 0,
                    top: 0,
                    width: 480,
                    height: 272,
                    widgets: []
                });
            });
        },
        icon: "filter",
        check: (page: Page) => {
            let messages: Message[] = [];

            const DocumentStore = getDocumentStore(page);

            ProjectEditor.checkAssetId(DocumentStore, "pages", page, messages);

            if (page.dataContextOverrides) {
                try {
                    JSON.parse(page.dataContextOverrides);
                } catch {
                    messages.push(
                        propertyInvalidValueMessage(
                            page,
                            "dataContextOverrides"
                        )
                    );
                }
            }

            if (page.style && !findStyle(DocumentStore.project, page.style)) {
                messages.push(propertyNotFoundMessage(page, "style"));
            }

            if (DocumentStore.project.isFirmwareWithFlowSupportProject) {
                if (
                    page.width !=
                    DocumentStore.project.settings.general.displayWidth
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Width (${page.width}) is different from display width (${DocumentStore.project.settings.general.displayWidth})`,
                            getChildOfObject(page, "width")
                        )
                    );
                }

                if (page.width < 1 || page.width > 1280) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Width must be between 1 and 1280 `,
                            getChildOfObject(page, "width")
                        )
                    );
                }

                if (
                    page.height !=
                    DocumentStore.project.settings.general.displayHeight
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Height (${page.height}) is different from display height (${DocumentStore.project.settings.general.displayHeight})`,
                            getChildOfObject(page, "height")
                        )
                    );
                }

                if (page.height < 1 || page.height > 1280) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Height must be between 1 and 1280 `,
                            getChildOfObject(page, "height")
                        )
                    );
                }
            }

            return messages;
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

    get autoSize(): AutoSize {
        return "none";
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

    get isRuntimeSelectedPage() {
        const DocumentStore = getDocumentStore(this);
        return (
            DocumentStore.runtime &&
            DocumentStore.runtime instanceof ProjectEditor.WasmRuntimeClass &&
            DocumentStore.runtime.selectedPage == this &&
            !DocumentStore.project.isDashboardProject
        );
    }

    renderComponents(flowContext: IFlowContext) {
        const scaleToFit =
            this.scaleToFit &&
            flowContext.DocumentStore.runtime &&
            !flowContext.DocumentStore.runtime.isDebuggerActive;

        let width: number | undefined;
        let height: number | undefined;
        if (scaleToFit) {
            width = flowContext.viewState.transform.clientRect.width;
            height = flowContext.viewState.transform.clientRect.height;
        }

        return (
            <>
                {this.isRuntimeSelectedPage ? (
                    (
                        flowContext.DocumentStore.runtime! as WasmRuntime
                    ).renderPage()
                ) : (
                    <ComponentEnclosure
                        component={this}
                        flowContext={flowContext}
                        width={width}
                        height={height}
                    />
                )}

                {!flowContext.frontFace && (
                    <ComponentsContainerEnclosure
                        parent={this}
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

    render(flowContext: IFlowContext, width: number, height: number) {
        const pageStyle = findStyle(
            ProjectEditor.getProject(this),
            this.style || "default"
        );

        const isLayoutViewWidgetPage =
            !flowContext.document.findObjectById(getId(this)) &&
            !flowContext.DocumentStore.runtime;

        let pageBackground;
        if (
            !flowContext.DocumentStore.project.isDashboardProject &&
            !isLayoutViewWidgetPage
        ) {
            pageBackground = (
                <ComponentCanvas
                    component={this}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        if (pageStyle) {
                            draw.drawBackground(
                                ctx,
                                0,
                                0,
                                this.width,
                                this.height,
                                pageStyle,
                                true
                            );
                        }
                    }}
                />
            );
        }

        return (
            <>
                {pageBackground}

                <ComponentsContainerEnclosure
                    parent={this}
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
                    width={width}
                    height={height}
                />
            </>
        );
    }

    getClassName() {
        const style = findStyle(ProjectEditor.getProject(this), this.style);
        return classNames("EezStudio_Page", style?.classNames);
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        const isLayoutViewWidgetPage =
            !flowContext.document.findObjectById(getId(this)) &&
            !flowContext.DocumentStore.runtime;
        if (isLayoutViewWidgetPage) {
            // this is LayoutViewWidget page, forbid interaction with the content
            // and do not draw background (it is drawn by LayoutViewWidget)
            style.pointerEvents = "none";
        } else {
            const pageStyle = findStyle(
                ProjectEditor.getProject(this),
                this.style || "default"
            );

            if (pageStyle && pageStyle.backgroundColorProperty) {
                style.backgroundColor = to16bitsColor(
                    getThemedColor(
                        flowContext.DocumentStore,
                        pageStyle.backgroundColorProperty
                    )
                );
            }
        }
    }

    getWidgetType() {
        return WIDGET_TYPE_CONTAINER;
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // widgets
        const widgets = assets.DocumentStore.project.isDashboardProject
            ? []
            : (this.components.filter(
                  widget => widget instanceof Widget
              ) as Widget[]);

        dataBuffer.writeArray(widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );

        // flags
        let flags = 0;

        const CLOSE_PAGE_IF_TOUCHED_OUTSIDE_FLAG = 1 << 1;
        const PAGE_IS_USED_AS_CUSTOM_WIDGET = 1 << 2;
        const PAGE_CONTAINER = 1 << 3;

        if (this.closePageIfTouchedOutside) {
            flags |= CLOSE_PAGE_IF_TOUCHED_OUTSIDE_FLAG;
        }

        if (this.isUsedAsCustomWidget) {
            flags |= PAGE_IS_USED_AS_CUSTOM_WIDGET;
        } else {
            flags |= PAGE_CONTAINER;
        }

        dataBuffer.writeUint16(flags);

        // overlay
        dataBuffer.writeInt16(0);
    }
}

registerClass("Page", Page);

////////////////////////////////////////////////////////////////////////////////

export function findPage(project: Project, pageName: string) {
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "pages",
        pageName
    ) as Page | undefined;
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
                metrics
            }
        }
    }
};
