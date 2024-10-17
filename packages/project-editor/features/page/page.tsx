import React from "react";
import { observable, computed, makeObservable } from "mobx";
import classNames from "classnames";

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
    MessageType,
    PropertyInfo,
    getProperty,
    IMessage
} from "project-editor/core/object";
import {
    createObject,
    getChildOfObject,
    getProjectStore,
    getLabel,
    Message,
    propertyInvalidValueMessage,
    propertyNotFoundMessage
} from "project-editor/store";
import {
    isDashboardProject,
    isLVGLProject
} from "project-editor/project/project-type-traits";
import { Project, findStyle } from "project-editor/project/project";

import type {
    IResizeHandler,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import {
    ComponentsContainerEnclosure,
    ComponentEnclosure,
    ComponentCanvas
} from "project-editor/flow/editor/render";

import { AutoSize, Component, Widget } from "project-editor/flow/component";
import {
    generalGroup,
    styleGroup,
    geometryGroup
} from "project-editor/ui-components/PropertyGrid/groups";

import { getThemedColor } from "project-editor/features/style/theme";
import { Flow } from "project-editor/flow/flow";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { buildWidget } from "project-editor/build/widgets";
import { WIDGET_TYPE_CONTAINER } from "project-editor/flow/components/component-types";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { drawBackground } from "project-editor/flow/editor/eez-gui-draw";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import { LVGLPage } from "project-editor/lvgl/Page";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { visitObjects } from "project-editor/core/search";
import type {
    LVGLUserWidgetWidget,
    LVGLWidget
} from "project-editor/lvgl/widgets";
import { lvglBuildPageTimeline } from "project-editor/flow/timeline";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { PAGES_ICON } from "project-editor/ui-components/icons";

export const FLOW_FRAGMENT_PAGE_NAME = "$FlowFragment";

////////////////////////////////////////////////////////////////////////////////

export interface ICustomWidgetCreateParams {
    widgetIndex: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

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
                referencedObjectCollectionPath: "allStyles",
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
            left: computed,
            top: computed,
            rect: computed,
            closePageIfTouchedOutside: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            x: observable,
            y: observable,
            width: observable,
            height: observable,
            style: observable,
            components: observable
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

    isUsedAsUserWidget: boolean;

    dataContextOverrides: string;

    _lvglRuntime: LVGLPageRuntime | undefined;
    _lvglObj: number | undefined;
    _lvglUserWidgetOfPageCopy: LVGLUserWidgetWidget;

    constructor() {
        super();

        makeObservable(this, {
            dataContextOverridesObject: computed,
            rect: computed,
            _lvglWidgetsIncludingUserWidgets: computed({ keepAlive: true }),
            _lvglWidgetsIncludingUserWidgetsWithoutCopy: computed({
                keepAlive: true
            }),
            _lvglWidgets: computed({ keepAlive: true })
        });
    }

    override makeEditable() {
        super.makeEditable();

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
            isUsedAsUserWidget: observable,
            dataContextOverrides: observable,
            _lvglRuntime: observable,
            _lvglObj: observable
        });
    }

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                disabled: isLVGLProject
            },
            {
                name: "name",
                type: PropertyType.String,
                unique: (
                    page: Page,
                    parent: IEezObject,
                    propertyInfo?: PropertyInfo
                ) => {
                    const oldIdentifier = propertyInfo
                        ? getProperty(page, propertyInfo.name)
                        : undefined;

                    return (object: any, ruleName: string) => {
                        const newIdentifer = object[ruleName];
                        if (
                            oldIdentifier != undefined &&
                            newIdentifer == oldIdentifier
                        ) {
                            return null;
                        }

                        if (
                            ProjectEditor.getProjectStore(
                                page
                            ).lvglIdentifiers.getIdentifierByName(
                                page,
                                newIdentifer
                            ) == undefined
                        ) {
                            return null;
                        }

                        return "Not an unique name";
                    };
                },
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
                propertyGridGroup: generalGroup,
                disabled: isLVGLProject
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
                propertyGridGroup: geometryGroup,
                disabled: isLVGLProject
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "allStyles",
                propertyGridGroup: styleGroup,
                disabled: isLVGLProject
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                propertyGridGroup: generalGroup,
                disabled: object =>
                    isDashboardProject(object) || isLVGLProject(object)
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
                name: "isUsedAsUserWidget",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: true
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup,
                disabled: object =>
                    isDashboardProject(object) || isLVGLProject(object)
            }
        ],
        icon: PAGES_ICON,
        label: (page: Page) => {
            return page.name;
        },
        listLabel: (page: Page) => {
            let label: React.ReactNode = getLabel(page);
            if (page.isRuntimeSelectedPage) {
                label = <strong>{label}</strong>;
            }
            if (page.isRuntimePageWithoutFlowState) {
                label = <span style={{ opacity: 0.5 }}>{label}</span>;
            }
            return label;
        },
        beforeLoadHook: (page: Page, jsObject: any, project: Project) => {
            // MIGRATION TO LOW RES
            if ((window as any).__eezProjectMigration) {
                if (!jsObject.isUsedAsUserWidget) {
                    jsObject.width = __eezProjectMigration.displayTargetWidth;
                    jsObject.height = __eezProjectMigration.displayTargetHeight;
                } else {
                    jsObject.width = Math.floor(
                        (jsObject.width *
                            __eezProjectMigration.displayTargetWidth) /
                            __eezProjectMigration.displaySourceWidth
                    );
                    jsObject.height = Math.floor(
                        (jsObject.height *
                            __eezProjectMigration.displayTargetHeight) /
                            __eezProjectMigration.displaySourceHeight
                    );
                }
            }

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

            if (jsObject.isUsedAsCustomWidget != undefined) {
                jsObject.isUsedAsUserWidget = jsObject.isUsedAsCustomWidget;
                delete jsObject.isUsedAsCustomWidget;
            }

            // migrate old LVGL project so that all root widgets are childs of the single LVGLScreenWidget
            if (
                !jsObject.isUsedAsUserWidget &&
                project.projectTypeTraits.isLVGL
            ) {
                const widgets = [];
                const actions = [];

                for (let i = 0; i < jsObject.components.length; i++) {
                    const component = jsObject.components[i];
                    if (
                        component.type.startsWith("LVGL") &&
                        component.type.endsWith("Widget")
                    ) {
                        widgets.push(component);
                    } else {
                        actions.push(component);
                    }
                }

                // is migration required?
                if (
                    !(
                        widgets.length == 1 &&
                        widgets[0].type == "LVGLScreenWidget"
                    )
                ) {
                    // do migration
                    jsObject.components = [
                        ...actions,
                        {
                            type: "LVGLScreenWidget",
                            left: jsObject.left,
                            top: jsObject.top,
                            width: jsObject.width,
                            height: jsObject.height,
                            leftUnit: "px",
                            topUnit: "px",
                            widthUnit: "px",
                            heightUnit: "px",
                            scrollbarMode: "auto",
                            scrollDirection: "all",
                            hiddenFlagType: "literal",
                            clickableFlagType: "literal",
                            checkedStateType: "literal",
                            disabledStateType: "literal",
                            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
                            clickableFlag: true,
                            children: widgets
                        }
                    ];
                }
            }
        },
        isPropertyMenuSupported: true,
        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title:
                        parent == project.userPages
                            ? "New Page"
                            : "New User Widget",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.invalidCharacters("."),
                                validators.unique(
                                    {},
                                    project.pages,
                                    "Page or User Widget with this name already exists"
                                )
                            ]
                        }
                    ]
                },
                values: {
                    name:
                        parent == project.userPages &&
                        project.userPages.length == 0
                            ? "Main"
                            : ""
                }
            });

            const pageProperties: Partial<Page> = {
                name: result.values.name,
                left: 0,
                top: 0,
                width: project.projectTypeTraits.isDashboard
                    ? 800
                    : project._store.project.settings.general.displayWidth ??
                      480,
                height: project.projectTypeTraits.isDashboard
                    ? 450
                    : project._store.project.settings.general.displayHeight ??
                      272,
                components: [],
                isUsedAsUserWidget: parent == project.userWidgets
            };

            const page = createObject<Page>(
                project._store,
                pageProperties,
                Page
            );

            return page;
        },

        addObjectHook: (page: Page, parent: IEezObject) => {
            page.isUsedAsUserWidget =
                parent == ProjectEditor.getProject(parent).userWidgets;
        },

        getIcon: (page: Page) =>
            page.isUsedAsUserWidget ? "svg:user_widget" : "svg:page",

        check: (page: Page, messages: IMessage[]) => {
            const projectStore = getProjectStore(page);

            ProjectEditor.checkAssetId(projectStore, "pages", page, messages);

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

            if (page.style && !findStyle(projectStore.project, page.style)) {
                messages.push(propertyNotFoundMessage(page, "style"));
            }

            if (
                projectStore.projectTypeTraits.hasDisplaySizeProperty &&
                !page.isUsedAsUserWidget
            ) {
                const isSimulatorPage =
                    page.usedIn &&
                    page.usedIn.length == 1 &&
                    page.usedIn[0].toLowerCase() == "simulator";

                if (
                    !isSimulatorPage &&
                    projectStore.project.settings.general.displayWidth !=
                        undefined &&
                    page.width !=
                        projectStore.project.settings.general.displayWidth &&
                    !(page.scaleToFit || page.isUsedAsUserWidget)
                ) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            `Width (${page.width}) is different from display width (${projectStore.project.settings.general.displayWidth})`,
                            getChildOfObject(page, "width")
                        )
                    );
                }

                const MAX_WIDTH = 4096;
                const MAX_HEIGHT = 4096;

                if (page.width < 1 || page.width > MAX_WIDTH) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Width must be between 1 and ${MAX_WIDTH}`,
                            getChildOfObject(page, "width")
                        )
                    );
                }

                if (
                    !isSimulatorPage &&
                    projectStore.project.settings.general.displayHeight !=
                        undefined &&
                    page.height !=
                        projectStore.project.settings.general.displayHeight &&
                    !(page.scaleToFit || page.isUsedAsUserWidget)
                ) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            `Height (${page.height}) is different from display height (${projectStore.project.settings.general.displayHeight})`,
                            getChildOfObject(page, "height")
                        )
                    );
                }

                if (page.height < 1 || page.height > MAX_HEIGHT) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Height must be between 1 and ${MAX_HEIGHT}`,
                            getChildOfObject(page, "height")
                        )
                    );
                }
            }
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
        },

        findChildIndex: (parent: Page[], page: Page) => {
            return parent.findIndex(child => child.name == page.name);
        }
    });

    get rect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    }

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
        const projectStore = getProjectStore(this);
        return (
            !projectStore.projectTypeTraits.isDashboard &&
            projectStore.runtime &&
            projectStore.runtime instanceof ProjectEditor.WasmRuntimeClass &&
            projectStore.runtime.selectedPage == this
        );
    }

    get isRuntimePageWithoutFlowState() {
        const projectStore = getProjectStore(this);
        return (
            !projectStore.projectTypeTraits.isDashboard &&
            projectStore.runtime &&
            projectStore.runtime instanceof ProjectEditor.WasmRuntimeClass &&
            !projectStore.runtime.getFlowState(this)
        );
    }

    renderWidgetComponents(flowContext: IFlowContext) {
        if (this.isRuntimeSelectedPage) {
            const projectStore = getProjectStore(this);
            return (
                <>
                    {projectStore.runtime!.isDebuggerActive &&
                        projectStore.runtime!.isPaused && (
                            <ComponentEnclosure
                                component={this}
                                flowContext={flowContext}
                            />
                        )}
                    {(
                        flowContext.projectStore.runtime! as WasmRuntime
                    ).renderPage()}
                </>
            );
        }

        if (flowContext.projectStore.projectTypeTraits.isLVGL) {
            return (
                <>
                    <ComponentEnclosure
                        component={this}
                        flowContext={flowContext}
                    />
                    <LVGLPage page={this} flowContext={flowContext} />
                </>
            );
        }

        let width: number | undefined;
        let height: number | undefined;

        const scaleToFit =
            this.scaleToFit &&
            flowContext.projectStore.projectTypeTraits.isDashboard &&
            flowContext.projectStore.runtime &&
            !flowContext.projectStore.runtime.isDebuggerActive;
        if (scaleToFit) {
            width = flowContext.viewState.transform.clientRect.width;
            height = flowContext.viewState.transform.clientRect.height;
        }

        return (
            <>
                {flowContext.projectStore.projectTypeTraits.isDashboard &&
                    flowContext.projectStore.openProjectsManager.styles.map(
                        style => style.render()
                    )}
                <ComponentEnclosure
                    component={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
            </>
        );
    }

    renderActionComponents(flowContext: IFlowContext) {
        return (
            <>
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

        const isUserWidgetWidgetPage =
            !flowContext.document.findObjectById(getId(this)) &&
            !flowContext.projectStore.runtime;

        let pageBackground;
        if (
            !flowContext.projectStore.projectTypeTraits.isDashboard &&
            !flowContext.projectStore.projectTypeTraits.isLVGL &&
            !isUserWidgetWidgetPage
        ) {
            pageBackground = (
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        if (pageStyle) {
                            drawBackground(
                                ctx,
                                0,
                                0,
                                width,
                                height,
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
                    isRTL={
                        flowContext.projectStore.runtime
                            ? flowContext.projectStore.runtime.isRTL
                            : undefined
                    }
                />
            </>
        );
    }

    getClassName(flowContext: IFlowContext) {
        const project = ProjectEditor.getProject(this);
        let style = findStyle(project, this.style);
        if (!project.projectTypeTraits.isLVGL) {
            style = findStyle(project, this.style);
        }
        return classNames("EezStudio_Page", style?.classNames);
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        if (flowContext.projectStore.projectTypeTraits.isLVGL) {
            return;
        }

        const isUserWidgetWidgetPage =
            !flowContext.document.findObjectById(getId(this)) &&
            !flowContext.projectStore.runtime;
        if (isUserWidgetWidgetPage) {
            // this is UserWidgetWidget page, forbid interaction with the content
            // and do not draw background (it is drawn by UserWidgetWidget)
            style.pointerEvents = "none";
        } else {
            const pageStyle = findStyle(
                ProjectEditor.getProject(this),
                this.style || "default"
            );

            if (pageStyle && pageStyle.backgroundColorProperty) {
                style.backgroundColor = to16bitsColor(
                    getThemedColor(
                        flowContext.projectStore,
                        pageStyle.backgroundColorProperty
                    ).colorValue
                );
            }
        }
    }

    getWidgetType() {
        return WIDGET_TYPE_CONTAINER;
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // widgets
        const widgets = assets.projectStore.projectTypeTraits.isDashboard
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
        const PAGE_IS_USED_AS_USER_WIDGET = 1 << 2;
        const PAGE_CONTAINER = 1 << 3;
        const PAGE_SCALE_TO_FIT = 1 << 4;

        if (this.closePageIfTouchedOutside) {
            flags |= CLOSE_PAGE_IF_TOUCHED_OUTSIDE_FLAG;
        }

        if (this.isUsedAsUserWidget) {
            flags |= PAGE_IS_USED_AS_USER_WIDGET;
        } else {
            flags |= PAGE_CONTAINER;
        }

        if (this.scaleToFit) {
            flags |= PAGE_SCALE_TO_FIT;
        }

        dataBuffer.writeUint16(flags);

        // overlay
        dataBuffer.writeInt16(0);

        // layout
        const CONTAINER_WIDGET_LAYOUT_STATIC = 0;

        let layout = CONTAINER_WIDGET_LAYOUT_STATIC;

        dataBuffer.writeUint16(layout);

        // reserved1
        dataBuffer.writeUint16(0);
    }

    get lvglScreenWidget() {
        return this.isUsedAsUserWidget ||
            !ProjectEditor.getProject(this).projectTypeTraits.isLVGL
            ? undefined
            : (this.components.find(
                  component => component instanceof Widget
              ) as LVGLWidget);
    }

    lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number,
        customWidget?: ICustomWidgetCreateParams
    ) {
        if (this.lvglScreenWidget) {
            const lvglObj = this.lvglScreenWidget!.lvglCreate(
                runtime,
                parentObj,
                customWidget
            );

            return lvglObj;
        } else {
            const obj = customWidget
                ? runtime.wasm._lvglCreateUserWidget(
                      parentObj,
                      customWidget.widgetIndex,
                      customWidget.left,
                      customWidget.top,
                      customWidget.width,
                      customWidget.height
                  )
                : runtime.wasm._lvglCreateScreen(
                      parentObj,
                      runtime.getWidgetIndex(this),
                      this.left,
                      this.top,
                      this.width,
                      this.height
                  );

            this.components
                .filter(component => component instanceof Widget)
                .map((widget: Widget) => widget.lvglCreate(runtime, obj));

            return obj;
        }
    }

    lvglBuild(build: LVGLBuild) {
        if (this.lvglScreenWidget) {
            this.lvglScreenWidget!.lvglBuild(build);

            this._lvglWidgets.forEach(lvglWidget =>
                lvglWidget.lvglPostBuild(build)
            );
        } else {
            build.line(`lv_obj_t *obj = parent_obj;`);

            build.line(`{`);
            build.indent();

            build.line(`lv_obj_t *parent_obj = obj;`);

            for (const widget of this.components) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    build.line(`{`);
                    build.indent();

                    widget.lvglBuild(build);

                    build.unindent();
                    build.line(`}`);
                }
            }

            build.unindent();
            build.line(`}`);

            this._lvglWidgets.forEach(lvglWidget =>
                lvglWidget.lvglPostBuild(build)
            );
        }
    }

    lvglBuildTick(build: LVGLBuild) {
        if (!this.isUsedAsUserWidget) {
            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let flowIndex = build.assets.getFlowIndex(this);
                build.line(`void *flowState = getFlowState(0, ${flowIndex});`);
            }
        }

        for (const widget of this.components) {
            if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                widget.lvglBuildTick(build);
            }
        }

        if (ProjectEditor.getProject(this).projectTypeTraits.hasFlowSupport) {
            lvglBuildPageTimeline(build, this);
        }
    }

    getLvglGroupWidgets(groupName: string) {
        let groupWidgets: LVGLWidget[][] = [];

        for (const widgetPath of this
            ._lvglWidgetsIncludingUserWidgetsWithoutCopy) {
            if (widgetPath[widgetPath.length - 1].group == groupName) {
                groupWidgets.push(widgetPath);
            }
        }

        groupWidgets.sort((a, b) => {
            let aIndex = a[a.length - 1].groupIndex;
            let bIndex = b[b.length - 1].groupIndex;

            if (aIndex <= 0) {
                if (bIndex > 0) {
                    return 1;
                }
            } else if (bIndex <= 0) {
                return -1;
            }

            if (aIndex == bIndex) {
                aIndex = groupWidgets.indexOf(a);
                bIndex = groupWidgets.indexOf(b);
            }

            return aIndex - bIndex;
        });

        return groupWidgets;
    }

    get _lvglWidgets() {
        const widgets: LVGLWidget[] = [];

        function addWidgets(page: Page) {
            for (const widget of visitObjects(page.components)) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    widgets.push(widget);
                }
            }
        }

        addWidgets(this);

        return widgets;
    }

    get _lvglWidgetsIncludingUserWidgets() {
        const widgets: LVGLWidget[] = [];

        function addWidgets(page: Page) {
            for (const widget of visitObjects(page.components)) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    widgets.push(widget);

                    if (
                        widget instanceof
                        ProjectEditor.LVGLUserWidgetWidgetClass
                    ) {
                        const userWidgetPageCopy = widget.userWidgetPageCopy;
                        if (userWidgetPageCopy && !widget.isCycleDetected) {
                            addWidgets(userWidgetPageCopy);
                        }
                    }
                }
            }
        }

        addWidgets(this);

        return widgets;
    }

    get _lvglWidgetsIncludingUserWidgetsWithoutCopy() {
        const allWidgets: LVGLWidget[][] = [];

        function addWidgets(page: Page, widgetPath: LVGLWidget[]) {
            for (const widget of visitObjects(page.components)) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    allWidgets.push([...widgetPath, widget]);

                    if (
                        widget instanceof
                        ProjectEditor.LVGLUserWidgetWidgetClass
                    ) {
                        const userWidgetPage = widget.userWidgetPage;
                        if (userWidgetPage && !widget.isCycleDetected) {
                            addWidgets(userWidgetPage, [...widgetPath, widget]);
                        }
                    }
                }
            }
        }

        addWidgets(this, []);

        return allWidgets;
    }
}

registerClass("Page", Page);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-page",
    version: "0.1.0",
    description: "Pages support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Pages",
    mandatory: true,
    key: "userPages",
    type: PropertyType.Array,
    typeClass: Page,
    icon: "svg:pages",
    create: () => []
};

export default feature;
