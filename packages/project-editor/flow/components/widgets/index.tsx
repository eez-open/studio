import { MenuItem } from "@electron/remote";

import React from "react";
import { observable, computed, makeObservable, toJS, runInAction } from "mobx";
import { observer } from "mobx-react";
import { range } from "lodash";
import * as FlexLayout from "flexlayout-react";

import { Button } from "eez-studio-ui/button";

import {
    IEezObject,
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    isAncestor,
    getParent,
    PropertyProps,
    MessageType,
    getId,
    IMessage
} from "project-editor/core/object";
import {
    Message,
    objectToJS,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    createObject,
    getChildOfObject,
    getAncestorOfType,
    updateObject,
    getObjectPathAsString
} from "project-editor/store";
import { getProjectStore, IContextMenuContext } from "project-editor/store";

import {
    checkObjectReference,
    getProject,
    ProjectType,
    findPage,
    findVariable,
    Project
} from "project-editor/project/project";

import type {
    IFlowContext,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import {
    ComponentsContainerEnclosure,
    ComponentEnclosure,
    ComponentCanvas
} from "project-editor/flow/editor/render";

import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import {
    getEnumTypeNameFromVariable,
    isEnumVariable
} from "project-editor/features/variable/value-type";
import * as draw from "project-editor/flow/editor/eez-gui-draw";

import {
    Widget,
    makeDataPropertyInfo,
    ComponentInput,
    ComponentOutput,
    makeStylePropertyInfo
} from "project-editor/flow/component";

import {
    EndActionComponent,
    InputActionComponent,
    OutputActionComponent,
    StartActionComponent
} from "project-editor/flow/components/actions";

import { Assets, DataBuffer } from "project-editor/build/assets";
import { buildWidget } from "project-editor/build/widgets";
import {
    WIDGET_TYPE_CONTAINER,
    WIDGET_TYPE_LIST,
    WIDGET_TYPE_GRID,
    WIDGET_TYPE_SELECT,
    WIDGET_TYPE_USER_WIDGET
} from "project-editor/flow/components/component-types";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    generalGroup,
    layoutGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import {
    getBooleanValue,
    evalProperty,
    getStringValue
} from "project-editor/flow/helper";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";
import { getComponentName } from "project-editor/flow/components/components-registry";
import type { Page } from "project-editor/features/page/page";
import { visitObjects } from "project-editor/core/search";

import { isArray } from "eez-studio-shared/util";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { showDialog } from "eez-studio-ui/dialog";
import { EditorFlowContext } from "project-editor/flow/editor/context";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import { ProjectContext } from "project-editor/project/context";
import {
    userPropertyValuesProperty,
    getAdditionalFlowPropertiesForUserProperties,
    UserPropertyValues
} from "project-editor/flow/user-property";

const LIST_TYPE_VERTICAL = 1;
const LIST_TYPE_HORIZONTAL = 2;

const GRID_FLOW_ROW = 1;
const GRID_FLOW_COLUMN = 2;

////////////////////////////////////////////////////////////////////////////////

const ContainerWidgetEditLayout = observer(
    class ContainerWidgetEditLayout extends React.Component<PropertyProps> {
        editLayout = () => {
            const containerWidget = this.props.objects[0] as ContainerWidget;
            const projectStore = getProjectStore(containerWidget);
            const page = getAncestorOfType<Page>(
                containerWidget,
                ProjectEditor.PageClass.classInfo
            );
            if (!page) {
                return;
            }
            const editor = projectStore.editorsStore.getEditorByObject(page!);
            if (!editor) {
                return;
            }

            const flowContext = new EditorFlowContext();
            flowContext.set(editor!.state as PageTabState, {
                disableUpdateComponentGeometry: true
            });

            let disposed = false;

            const onSave = () => {
                updateObject(containerWidget, {
                    dockingLayout: model.toJson()
                });

                projectStore.runtimeSettings.writeDockingManagerContainerLayout(
                    getObjectPathAsString(containerWidget),
                    undefined
                );

                onDispose();
            };

            const onDispose = () => {
                if (!disposed) {
                    disposed = true;

                    if (modalDialog) {
                        modalDialog.close();
                    }
                }
            };

            const model = containerWidget.getDockingLayoutModel(flowContext);

            const [modalDialog] = showDialog(
                <ProjectContext.Provider value={flowContext.projectStore}>
                    <div className="EezStudio_ContaineWidget_EditLayout EezStudio_FlowCanvasContainer">
                        <FlexLayoutContainer
                            key="flex-layout-container"
                            model={model}
                            factory={containerWidget.dockingLayoutFactory(
                                flowContext
                            )}
                        />
                        <div>
                            <Button
                                color="primary"
                                size="medium"
                                onClick={onSave}
                            >
                                Save
                            </Button>
                            <Button
                                color="secondary"
                                size="medium"
                                onClick={onDispose}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </ProjectContext.Provider>,
                {
                    jsPanel: {
                        id: "container-widget-edit-layout",
                        title: "Edit Layout",
                        width: page.width,
                        height: page.height,
                        onclosed: onDispose
                    }
                }
            );
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ margin: "4px 0" }}>
                    <Button
                        color="primary"
                        size="small"
                        onClick={this.editLayout}
                    >
                        Edit Layout
                    </Button>
                </div>
            );
        }
    }
);

const DockingLayoutTabComponentEnclosure = observer(
    class DockingLayoutTabComponentEnclosure extends React.Component<{
        flowContext: IFlowContext;
        widget: Widget;
    }> {
        width: number = 0;
        height: number = 0;

        el: HTMLElement | null = null;
        requestAnimationFrameId: any;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                width: observable,
                height: observable
            });
        }

        updateSize = () => {
            if (!this.el) {
                let dataFlowObjectId = getId(this.props.widget);
                const container = document.getElementById(
                    this.props.flowContext.viewState.containerId
                );
                const el = container?.querySelector(
                    `[data-eez-flow-object-id='${dataFlowObjectId}']`
                );
                if (el) {
                    this.el = el.parentElement;
                }
            }

            if (this.el) {
                const rect = this.el.getBoundingClientRect();
                if (rect.width != this.width || rect.height != this.height) {
                    runInAction(() => {
                        this.width = rect.width;
                        this.height = rect.height;
                    });
                }
            }

            this.requestAnimationFrameId = requestAnimationFrame(
                this.updateSize
            );
        };

        componentDidMount() {
            this.updateSize();
        }

        componentWillUnmount() {
            cancelAnimationFrame(this.requestAnimationFrameId);
        }

        render() {
            return (
                <ComponentEnclosure
                    component={this.props.widget}
                    flowContext={this.props.flowContext}
                    left={0}
                    top={0}
                    width={this.width}
                    height={this.height}
                />
            );
        }
    }
);

export class ContainerWidget extends Widget {
    name?: string;
    widgets: Widget[];
    overlay?: string;
    shadow?: boolean;
    layout: "static" | "horizontal" | "vertical" | "docking-manager";
    dockingLayout: any;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_CONTAINER,

        label: (widget: ContainerWidget) => {
            let name = getComponentName(widget.type);

            if (widget.name) {
                return widget.name;
            }
            return name;
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            }),
            makeDataPropertyInfo("overlay", {
                disabled: (containerWidget: ContainerWidget) => {
                    const project = ProjectEditor.getProject(containerWidget);
                    return (
                        project.projectTypeTraits.hasFlowSupport ||
                        project.projectTypeTraits.isDashboard
                    );
                }
            }),
            {
                name: "shadow",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                disabled: (containerWidget: ContainerWidget) => {
                    return !containerWidget.overlay;
                }
            },
            {
                name: "layout",
                type: PropertyType.Enum,
                enumItems: (object: IEezObject) =>
                    getProject(object).projectTypeTraits.isDashboard
                        ? [
                              {
                                  id: "static"
                              },
                              {
                                  id: "horizontal"
                              },
                              {
                                  id: "vertical"
                              },
                              {
                                  id: "docking-manager",
                                  label: "Docking Manager"
                              }
                          ]
                        : [
                              {
                                  id: "static"
                              },
                              {
                                  id: "horizontal"
                              },
                              {
                                  id: "vertical"
                              }
                          ],
                propertyGridGroup: layoutGroup
            },
            {
                name: "dockingLayout",
                type: PropertyType.Any,
                propertyGridGroup: layoutGroup,
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            },
            {
                name: "editLayout",
                type: PropertyType.Any,
                propertyGridGroup: layoutGroup,
                computed: true,
                propertyGridRowComponent: ContainerWidgetEditLayout,
                skipSearch: true,
                hideInPropertyGrid: (widget: ContainerWidget) => {
                    return widget.layout != "docking-manager";
                }
            },
            makeStylePropertyInfo("style", "Default style", {
                hideInDocumentation: "none"
            })
        ],

        defaultValue: {
            type: "Container",
            style: {
                useStyle: "default"
            },
            widgets: [],
            layout: "static",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        beforeLoadHook: (
            widget: ContainerWidget,
            jsWidget: Partial<ContainerWidget>,
            project: Project
        ) => {
            if (jsWidget.layout == undefined) {
                jsWidget.layout = "static";
            } else if (jsWidget.layout == "docking-manager") {
                if (!project.projectTypeTraits.isDashboard) {
                    jsWidget.layout = "static";
                }
            }
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M4 12h8m0 3h8m-8-6h8m-8-5v16" />
            </svg>
        ),

        check: (object: ContainerWidget, messages: IMessage[]) => {
            checkObjectReference(object, "overlay", messages);
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            widgets: observable,
            overlay: observable,
            shadow: observable,
            layout: observable,
            dockingLayout: observable
        });
    }

    getDockingLayoutModel(flowContext: IFlowContext) {
        let savedDockingLayout;
        if (flowContext.flowState) {
            savedDockingLayout =
                flowContext.projectStore.runtimeSettings.readDockingManagerContainerLayout(
                    getObjectPathAsString(this)
                );
        }

        const dockingLayout = savedDockingLayout ||
            toJS(this.dockingLayout) || {
                global: {
                    borderEnableAutoHide: true,
                    splitterSize: 4,
                    splitterExtra: 4,
                    legacyOverflowMenu: false,
                    tabEnableRename: false
                },
                borders: [
                    /*
                    {
                        type: "border",
                        location: "top",
                        children: []
                    },
                    {
                        type: "border",
                        location: "left",
                        children: []
                    },
                    {
                        type: "border",
                        location: "right",
                        children: []
                    },
                    {
                        type: "border",
                        location: "bottom",
                        children: []
                    }
                    */
                ],
                layout: {
                    type: "row",
                    children: this.widgets.map((widget, i) => ({
                        type: "tabset",
                        children: [
                            {
                                type: "tab",
                                enableClose: false,
                                name: `Child ${i}`,
                                id: `child${i}`,
                                component: `child${i}`,
                                icon: undefined
                            }
                        ]
                    }))
                }
            };

        const model = FlexLayout.Model.fromJson(dockingLayout);

        let tabSetNode: FlexLayout.TabSetNode;
        let tabSetNodeTabIndex = -1;
        let numTabNodes = 0;

        model.visitNodes((node, level) => {
            if (node instanceof FlexLayout.TabSetNode) {
                if (!tabSetNode) {
                    tabSetNode = node;
                }
            } else if (node instanceof FlexLayout.TabNode) {
                numTabNodes++;

                const i = parseInt(node.getId().slice("child".length));
                if (i > tabSetNodeTabIndex) {
                    tabSetNode = node.getParent() as FlexLayout.TabSetNode;
                    tabSetNodeTabIndex = i;
                }
            }
        });

        if (numTabNodes > this.widgets.length) {
            for (let i = this.widgets.length; i < numTabNodes; i++) {
                model.doAction(FlexLayout.Actions.deleteTab(`child${i}`));
            }
        } else if (numTabNodes < this.widgets.length) {
            for (let i = numTabNodes; i < this.widgets.length; i++) {
                const tab = model.doAction(
                    FlexLayout.Actions.addNode(
                        {
                            type: "tab",
                            enableClose: false,
                            name: `Child ${i}`,
                            id: `child${i}`,
                            component: `child${i}`,
                            icon: undefined
                        },
                        tabSetNode!.getId(),
                        FlexLayout.DockLocation.BOTTOM,
                        -1,
                        false
                    )
                );
                tabSetNode = tab!.getParent() as FlexLayout.TabSetNode;
            }
        }

        for (let i = 0; i < this.widgets.length; i++) {
            const widget = this.widgets[i];
            const title = getStringValue(
                flowContext,
                widget,
                "tabTitle",
                widget.tabTitle ? `{${widget.tabTitle}}` : `Child ${i + 1}`
            );
            model.doAction(FlexLayout.Actions.renameTab(`child${i}`, title));
        }

        return model;
    }

    dockingLayoutFactory = (flowContext: IFlowContext) => {
        return (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component) {
                const i = parseInt(component?.slice("child".length));
                const widget = this.widgets[i];

                return (
                    <DockingLayoutTabComponentEnclosure
                        widget={widget}
                        flowContext={flowContext}
                    />
                );
            }

            return null;
        };
    };

    // getClassName(flowContext: IFlowContext) {
    //     return classNames(super.getClassName(flowContext), {
    //         "eez-flow-editor-capture-pointers": this.layout == "docking-manager"
    //     });
    // }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        if (this.overlay) {
            if (this.shadow) {
                style.boxShadow = "1px 1px 8px 1px rgba(0,0,0,0.5)";
            }
            style.opacity = this.style.opacityProperty / 255;
        }
    }

    override render(
        flowContext: IFlowContext,
        containerWidth: number,
        containerHeight: number
    ): React.ReactNode {
        let children;
        if (flowContext.flowState && this.layout == "horizontal") {
            let offset = 0;

            children = this.widgets.map((widget, i) => {
                let left = offset;
                let top = 0;
                let width = widget.width;
                let height = widget.height;

                if (
                    !getBooleanValue(
                        flowContext,
                        widget,
                        "visible",
                        !widget.visible
                    )
                ) {
                    return null;
                }

                offset += width;

                if (
                    flowContext.projectStore.runtime &&
                    flowContext.projectStore.runtime.isRTL
                ) {
                    left = containerWidth - (left + width);
                }

                return (
                    <ComponentEnclosure
                        key={getId(widget)}
                        component={widget}
                        flowContext={flowContext}
                        left={left}
                        top={top}
                        width={width}
                        height={height}
                    />
                );
            });
        } else if (flowContext.flowState && this.layout == "vertical") {
            let offset = 0;

            children = this.widgets.map((widget, i) => {
                let left = 0;
                let top = offset;
                let width = widget.width;
                let height = widget.height;

                if (
                    !getBooleanValue(
                        flowContext,
                        widget,
                        "visible",
                        !widget.visible
                    )
                ) {
                    return null;
                }

                offset += height;

                if (
                    flowContext.projectStore.runtime &&
                    flowContext.projectStore.runtime.isRTL
                ) {
                    left = containerWidth - (left + width);
                }

                return (
                    <ComponentEnclosure
                        key={getId(widget)}
                        component={widget}
                        flowContext={flowContext}
                        left={left}
                        top={top}
                        width={width}
                        height={height}
                    />
                );
            });
        } else if (this.layout == "docking-manager") {
            children = [
                <FlexLayoutContainer
                    key="flex-layout-container"
                    model={this.getDockingLayoutModel(flowContext)}
                    factory={this.dockingLayoutFactory(flowContext)}
                    onModelChange={model => {
                        if (flowContext.flowState) {
                            flowContext.projectStore.runtimeSettings.writeDockingManagerContainerLayout(
                                getObjectPathAsString(this),
                                model.toJson()
                            );
                        }
                    }}
                />
            ];
        } else {
            children = (
                <ComponentsContainerEnclosure
                    parent={this}
                    components={this.widgets}
                    flowContext={flowContext}
                    width={containerWidth}
                    height={containerHeight}
                    isRTL={
                        flowContext.projectStore.runtime
                            ? flowContext.projectStore.runtime.isRTL
                            : undefined
                    }
                />
            );
        }

        const fragment = (
            <>
                {flowContext.projectStore.projectTypeTraits
                    .isDashboard ? null : (
                    <ComponentCanvas
                        component={this}
                        width={containerWidth}
                        height={containerHeight}
                        draw={(ctx: CanvasRenderingContext2D) => {
                            draw.drawBackground(
                                ctx,
                                0,
                                0,
                                containerWidth,
                                containerHeight,
                                this.style,
                                true
                            );
                        }}
                    />
                )}

                {children}

                {super.render(flowContext, containerWidth, containerHeight)}
            </>
        );

        const onClick = this.onClick(flowContext);

        if (onClick) {
            return (
                <div
                    onClick={onClick}
                    style={{
                        width: containerWidth,
                        height: containerHeight
                    }}
                >
                    {fragment}
                </div>
            );
        } else {
            return fragment;
        }
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // widgets
        dataBuffer.writeArray(this.widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );

        let overlay = assets.getWidgetDataItemIndex(this, "overlay");

        // flags
        let flags = 0;

        const SHADOW_FLAG = 1 << 0;

        if (overlay && this.shadow) {
            flags |= SHADOW_FLAG;
        }

        dataBuffer.writeUint16(flags);

        // overlay
        dataBuffer.writeInt16(overlay);

        // layout
        const CONTAINER_WIDGET_LAYOUT_STATIC = 0;
        const CONTAINER_WIDGET_LAYOUT_HORIZONTAL = 1;
        const CONTAINER_WIDGET_LAYOUT_VERTICAL = 2;

        let layout = CONTAINER_WIDGET_LAYOUT_STATIC;

        if (this.layout === "horizontal") {
            layout = CONTAINER_WIDGET_LAYOUT_HORIZONTAL;
        } else if (this.layout === "vertical") {
            layout = CONTAINER_WIDGET_LAYOUT_VERTICAL;
        }

        dataBuffer.writeUint16(layout);

        // reserved1
        dataBuffer.writeUint16(0);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ListWidget extends Widget {
    itemWidget?: Widget;
    listType?: string;
    gap?: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_LIST,

        properties: [
            {
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            },
            {
                name: "listType",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "vertical"
                    },
                    {
                        id: "horizontal"
                    }
                ]
            },
            {
                name: "gap",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style"),
            makeDataPropertyInfo("data")
        ],

        defaultValue: {
            itemWidget: {
                type: "Container",
                widgets: [],
                left: 0,
                top: 0,
                width: 64,
                height: 32
            },
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            listType: "vertical",
            gap: 0
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="4" width="16" height="6" rx="2" />
                <rect x="4" y="14" width="16" height="6" rx="2" />
            </svg>
        ),

        check: (object: ListWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "List item widget is missing",
                        object
                    )
                );
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            itemWidget: observable,
            listType: observable,
            gap: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        let dataValue;
        if (this.data) {
            if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
                try {
                    dataValue = evalProperty(flowContext, this, "data");
                } catch (err) {
                    //console.error(err);
                }
            } else {
                dataValue = flowContext.dataContext.get(this.data);
            }
        }

        if (!isArray(dataValue)) {
            dataValue = [{}];
        }

        const iterators =
            flowContext.dataContext.get(FLOW_ITERATOR_INDEXES_VARIABLE) || [];

        return (
            <>
                {range(flowContext.flowState ? dataValue.length : 1).map(i => (
                    <ListWidgetItem
                        key={i}
                        flowContext={flowContext}
                        listWidget={this}
                        itemWidget={itemWidget}
                        i={i}
                        gap={this.gap || 0}
                        iterators={iterators}
                    />
                ))}

                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // itemWidget
        const itemWidget = this.itemWidget;
        if (itemWidget) {
            dataBuffer.writeObjectOffset(() =>
                buildWidget(itemWidget, assets, dataBuffer)
            );
        } else {
            dataBuffer.writeUint32(0);
        }

        // listType
        dataBuffer.writeUint8(
            this.listType === "vertical"
                ? LIST_TYPE_VERTICAL
                : LIST_TYPE_HORIZONTAL
        );

        // gap
        dataBuffer.writeUint8(this.gap || 0);
    }
}

const ListWidgetItem = observer(
    class ListWidgetItem extends React.Component<{
        flowContext: IFlowContext;
        listWidget: ListWidget;
        itemWidget: Widget;
        i: number;
        gap: number;
        iterators: any;
    }> {
        render() {
            const { flowContext, listWidget, itemWidget, i, gap, iterators } =
                this.props;
            let xListItem = 0;
            let yListItem = 0;

            if (listWidget.listType === "horizontal") {
                xListItem += i * (itemWidget.width + gap);
            } else {
                yListItem += i * (itemWidget.height + gap);
            }

            const overridenFlowContext = flowContext.overrideDataContext({
                [FLOW_ITERATOR_INDEX_VARIABLE]: i,
                [FLOW_ITERATOR_INDEXES_VARIABLE]: [i, ...iterators]
            });

            return (
                <ComponentEnclosure
                    component={itemWidget}
                    flowContext={overridenFlowContext}
                    left={xListItem}
                    top={yListItem}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class GridWidget extends Widget {
    itemWidget?: Widget;
    gridFlow?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_GRID,

        properties: [
            {
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            },
            {
                name: "gridFlow",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "row"
                    },
                    {
                        id: "column"
                    }
                ]
            },
            makeStylePropertyInfo("style", "Default style"),
            makeDataPropertyInfo("data")
        ],

        defaultValue: {
            itemWidget: {
                type: "Container",
                widgets: [],
                left: 0,
                top: 0,
                width: 32,
                height: 32,
                gridFlow: "row"
            },
            left: 0,
            top: 0,
            width: 64,
            height: 64
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="4" y="4" width="6" height="6" rx="1"></rect>
                <rect x="14" y="4" width="6" height="6" rx="1"></rect>
                <rect x="4" y="14" width="6" height="6" rx="1"></rect>
                <rect x="14" y="14" width="6" height="6" rx="1"></rect>
            </svg>
        ),

        check: (object: GridWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "Grid item widget is missing",
                        object
                    )
                );
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            itemWidget: observable,
            gridFlow: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        let dataValue;
        if (this.data) {
            if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
                try {
                    dataValue = evalProperty(flowContext, this, "data");
                } catch (err) {
                    //console.error(err);
                }
            } else {
                dataValue = flowContext.dataContext.get(this.data);
            }
        }

        if (dataValue == undefined && flowContext.flowState) {
            return null;
        }

        if (!isArray(dataValue)) {
            dataValue = [{}];
        }

        const iterators =
            flowContext.dataContext.get(FLOW_ITERATOR_INDEXES_VARIABLE) || [];

        return (
            <>
                {range(flowContext.flowState ? dataValue.length : 1).map(i => (
                    <GridWidgetItem
                        key={i}
                        flowContext={flowContext}
                        gridWidget={this}
                        itemWidget={itemWidget}
                        i={i}
                        width={width}
                        height={height}
                        iterators={iterators}
                    />
                ))}

                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // itemWidget
        const itemWidget = this.itemWidget;
        if (itemWidget) {
            dataBuffer.writeObjectOffset(() =>
                buildWidget(itemWidget, assets, dataBuffer)
            );
        } else {
            dataBuffer.writeUint32(0);
        }

        // gridFlow
        dataBuffer.writeUint8(
            this.gridFlow === "column" ? GRID_FLOW_COLUMN : GRID_FLOW_ROW
        );
    }
}

const GridWidgetItem = observer(
    class GridWidgetItem extends React.Component<{
        flowContext: IFlowContext;
        gridWidget: GridWidget;
        itemWidget: Widget;
        i: number;
        width: number;
        height: number;
        iterators: any;
    }> {
        render() {
            const {
                flowContext,
                gridWidget,
                itemWidget,
                i,
                width,
                height,
                iterators
            } = this.props;

            const rows = Math.floor(height / itemWidget.height);
            const cols = Math.floor(width / itemWidget.width);

            let row;
            let col;
            if (gridWidget.gridFlow === "column") {
                row = i % rows;
                col = Math.floor(i / rows);
            } else {
                col = i % cols;
                row = Math.floor(i / cols);
            }

            let xListItem = col * itemWidget.width;
            let yListItem = row * itemWidget.height;

            const overridenFlowContext = flowContext.overrideDataContext({
                [FLOW_ITERATOR_INDEX_VARIABLE]: i,
                [FLOW_ITERATOR_INDEXES_VARIABLE]: [i, ...iterators]
            });

            return (
                <ComponentEnclosure
                    component={itemWidget}
                    flowContext={overridenFlowContext}
                    left={xListItem}
                    top={yListItem}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

export class SelectWidget extends Widget {
    widgets: Widget[];

    _lastSelectedIndexInSelectWidget: number | undefined;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_SELECT,

        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true,
                childLabel: (childObject: IEezObject, childLabel: string) => {
                    let label;

                    if (getParent(childObject)) {
                        let selectWidgetProperties = getParent(
                            getParent(childObject)
                        ) as SelectWidget;

                        label = selectWidgetProperties.getChildLabel(
                            childObject as Widget
                        );
                    }

                    if (!label) {
                        label = (getParent(childObject) as IEezObject[])
                            .indexOf(childObject)
                            .toString();
                    }

                    return `${label} ➔ ${childLabel}`;
                },

                interceptAddObject: (widgets: Widget[], object: Widget) => {
                    object.left = 0;
                    object.top = 0;
                    object.width = (getParent(widgets) as SelectWidget).width;
                    object.height = (getParent(widgets) as SelectWidget).height;
                    return object;
                }
            },
            makeStylePropertyInfo("style", "Default style"),
            makeDataPropertyInfo("data", {}, "boolean")
        ],

        defaultValue: {
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path fill="none" d="M0 0h24v24H0z" />
                <path d="M10 2c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1H8v2h5V9c0-.552.448-1 1-1h6c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1h-6c-.552 0-1-.448-1-1v-1H8v6h5v-1c0-.552.448-1 1-1h6c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1h-6c-.552 0-1-.448-1-1v-1H7c-.552 0-1-.448-1-1V8H4c-.552 0-1-.448-1-1V3c0-.552.448-1 1-1h6zm9 16h-4v2h4v-2zm0-8h-4v2h4v-2zM9 4H5v2h4V4z" />
            </svg>
        ),

        check: (object: SelectWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            } else {
                let variable = findVariable(getProject(object), object.data);
                if (variable) {
                    if (variable.type != "integer") {
                        let enumItems: string[] = [];
                        if (isEnumVariable(variable)) {
                            const project = getProject(variable);
                            const enumName =
                                getEnumTypeNameFromVariable(variable);
                            enumItems = enumName
                                ? project.variables.enumsMap
                                      .get(enumName)
                                      ?.members.map(member => member.name) ?? []
                                : [];
                        } else if (variable.type == "boolean") {
                            enumItems = ["0", "1"];
                        }

                        if (enumItems.length > object.widgets.length) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    "Some select children are missing",
                                    object
                                )
                            );
                        } else if (enumItems.length < object.widgets.length) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    "Too many select children defined",
                                    object
                                )
                            );
                        }
                    }
                }
            }

            object.widgets.forEach(childObject => {
                if (childObject.width != object.width) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            "Child of Select widget has different width",
                            childObject
                        )
                    );
                }

                if (childObject.height != object.height) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            "Child of Select widget has different height",
                            childObject
                        )
                    );
                }
            });
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            widgets: observable
        });
    }

    getChildLabel(childObject: Widget) {
        if (this.widgets) {
            let index = this.widgets.indexOf(childObject);
            if (index != -1) {
                if (this.data) {
                    let variable = findVariable(getProject(this), this.data);
                    if (variable) {
                        if (isEnumVariable(variable)) {
                            let enumItems: string[];

                            const project = getProject(this);
                            const enumName =
                                getEnumTypeNameFromVariable(variable);
                            enumItems = enumName
                                ? project.variables.enumsMap
                                      .get(enumName)
                                      ?.members.map(member => member.name) ?? []
                                : [];

                            if (index < enumItems.length) {
                                let enumItemLabel = htmlEncode(
                                    enumItems[index]
                                );
                                return enumItemLabel;
                            }
                        } else if (variable.type == "boolean") {
                            if (index == 0) {
                                return "0";
                            } else if (index == 1) {
                                return "1";
                            }
                        }
                    }
                }
            }
        }

        return undefined;
    }

    getSelectedIndex(flowContext: IFlowContext) {
        let index: number;

        if (flowContext.flowState) {
            try {
                index = evalProperty(flowContext, this, "data");

                if (typeof index === "number") {
                    // pass
                } else if (typeof index === "boolean") {
                    index = index ? 1 : 0;
                } else {
                    index = -1;
                }

                return index;
            } catch (err) {
                //console.error(err);
                return -1;
            }
        } else {
            const selectedObjects = flowContext.viewState.selectedObjects;

            for (let i = 0; i < this.widgets.length; ++i) {
                if (
                    selectedObjects.find(selectedObject =>
                        isAncestor(selectedObject.object, this.widgets[i])
                    )
                ) {
                    this._lastSelectedIndexInSelectWidget = i;
                    return i;
                }
            }

            if (
                this._lastSelectedIndexInSelectWidget !== undefined &&
                this._lastSelectedIndexInSelectWidget < this.widgets.length
            ) {
                return this._lastSelectedIndexInSelectWidget;
            }

            try {
                index = evalProperty(flowContext, this, "data");

                if (typeof index === "number") {
                    // pass
                } else if (typeof index === "boolean") {
                    index = index ? 1 : 0;
                } else {
                    index = 0;
                }

                return index;
            } catch (err) {
                //console.error(err);
            }

            if (this.widgets.length > 0) {
                this._lastSelectedIndexInSelectWidget = 0;
                return 0;
            }

            return -1;
        }
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const index = this.getSelectedIndex(flowContext);

        let selectedWidget =
            index >= 0 && index < this.widgets.length
                ? this.widgets[index]
                : null;

        const fragment = (
            <>
                {flowContext.projectStore.projectTypeTraits
                    .isDashboard ? null : (
                    <ComponentCanvas
                        component={this}
                        width={width}
                        height={height}
                        draw={(ctx: CanvasRenderingContext2D) => {
                            draw.drawBackground(
                                ctx,
                                0,
                                0,
                                width,
                                height,
                                this.style,
                                true
                            );
                        }}
                    />
                )}
                <ComponentsContainerEnclosure
                    parent={this}
                    components={this.widgets}
                    flowContext={flowContext}
                    visibleComponent={selectedWidget}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );

        const onClick = this.onClick(flowContext);

        if (onClick) {
            return (
                <div
                    onClick={onClick}
                    style={{
                        width: width,
                        height: height
                    }}
                >
                    {fragment}
                </div>
            );
        } else {
            return fragment;
        }
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // widgets
        dataBuffer.writeArray(this.widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const UserWidgetPropertyGridUI = observer(
    class UserWidgetPropertyGridUI extends React.Component<PropertyProps> {
        showUserWidgetPage = () => {
            (this.props.objects[0] as UserWidgetWidget).open();
        };

        fitSize = () => {
            (this.props.objects[0] as UserWidgetWidget).fitSize();
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ display: "flex", marginTop: 5, marginBottom: 5 }}>
                    <Button
                        color="primary"
                        size="small"
                        onClick={this.showUserWidgetPage}
                    >
                        Show User Widget
                    </Button>
                    <Button
                        color="secondary"
                        size="small"
                        onClick={this.fitSize}
                        style={{ marginLeft: 10 }}
                    >
                        Fit to User Widget Size
                    </Button>
                </div>
            );
        }
    }
);

export class UserWidgetWidget extends Widget {
    userWidgetPageName: string;
    userPropertyValues: UserPropertyValues;
    context?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_USER_WIDGET,

        properties: [
            makeDataPropertyInfo("context"),
            {
                name: "userWidgetPageName",
                displayName: "User widget",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "userWidgets"
            },
            userPropertyValuesProperty,
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: UserWidgetPropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (widget: UserWidgetWidget) => {
                    if (!widget.userWidgetPageName) {
                        return true;
                    }

                    const project = getProject(widget);

                    const userWidgetPage = findPage(
                        project,
                        widget.userWidgetPageName
                    );
                    if (!userWidgetPage) {
                        return true;
                    }

                    return false;
                }
            }
        ],

        getAdditionalFlowProperties:
            getAdditionalFlowPropertiesForUserProperties,

        beforeLoadHook: (
            widget: UserWidgetWidget,
            jsWidget: Partial<UserWidgetWidget>
        ) => {
            if ((jsWidget as any).layout != undefined) {
                jsWidget.userWidgetPageName = (jsWidget as any).layout;
                delete (jsWidget as any).layout;
            }
        },

        label: (widget: UserWidgetWidget) => {
            let name = getComponentName(widget.type);

            if (widget.userWidgetPageName) {
                return `${name}: ${widget.userWidgetPageName}`;
            }

            return name;
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: USER_WIDGET_ICON,

        check: (object: UserWidgetWidget, messages: IMessage[]) => {
            if (!object.data && !object.userWidgetPageName) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "Either user widget page or data must be set",
                        object
                    )
                );
            } else {
                if (object.data && object.userWidgetPageName) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "Both user widget page and data set, only user widget page is used",
                            object
                        )
                    );
                }

                if (object.userWidgetPageName) {
                    let userWidgetPage = findPage(
                        getProject(object),
                        object.userWidgetPageName
                    );
                    if (!userWidgetPage) {
                        messages.push(
                            propertyNotFoundMessage(
                                object,
                                "userWidgetPageName"
                            )
                        );
                    } else {
                        if (!userWidgetPage.isUsedAsUserWidget) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Page "${userWidgetPage.name}" is not an user widget page`,
                                    object
                                )
                            );
                        }

                        if (object.isCycleDetected) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Cycle detected in user widget page`,
                                    getChildOfObject(
                                        object,
                                        "userWidgetPageName"
                                    )
                                )
                            );
                        }
                    }
                }
            }

            checkObjectReference(object, "context", messages);
        },

        open: (object: UserWidgetWidget) => {
            object.open();
        },

        extendContextMenu: (
            thisObject: Widget,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[],
            editable: boolean
        ): void => {
            UserWidgetWidget.classInfo.parentClassInfo!.extendContextMenu!(
                thisObject,
                context,
                objects,
                menuItems,
                editable
            );

            if (objects.length === 1) {
                const object = objects[0];
                if (object instanceof UserWidgetWidget) {
                    menuItems.push(
                        new MenuItem({
                            label: "Replace with Container",
                            click: () => {
                                const widget = object.replaceWithContainer();
                                if (widget) {
                                    context.selectObject(widget);
                                }
                            }
                        })
                    );
                }
            }
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            userWidgetPage: computed,
            isCycleDetected: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            userWidgetPageName: observable,
            userPropertyValues: observable,
            context: observable
        });
    }

    get userWidgetPage() {
        return this.getUserWidgetPage(getProjectStore(this).dataContext);
    }

    getUserWidgetPage(dataContext: IDataContext) {
        let userWidgetPage;

        const project = getProject(this);

        if (this.data) {
            const userWidgetPageName = dataContext.get(this.data);
            if (userWidgetPageName) {
                userWidgetPage = findPage(project, userWidgetPageName);
            }
        }

        if (!userWidgetPage) {
            userWidgetPage = findPage(project, this.userWidgetPageName);
        }

        return userWidgetPage;
    }

    get isCycleDetected() {
        const visited = new Set<Page>();

        function testForCycle(page: Page): boolean {
            if (visited.has(page)) {
                return false;
            }

            visited.add(page);

            for (const widget of visitObjects(page)) {
                if (widget instanceof ProjectEditor.UserWidgetWidgetClass) {
                    if (widget.userWidgetPageName) {
                        const userWidgetPage = findPage(
                            project,
                            widget.userWidgetPageName
                        );
                        if (userWidgetPage) {
                            if (userWidgetPage === origPage) {
                                return true;
                            }
                            if (testForCycle(userWidgetPage)) {
                                return true;
                            }
                        }
                    }
                }
            }

            return false;
        }

        if (!this.userWidgetPageName) {
            return false;
        }

        const project = getProject(this);

        const userWidgetPage = findPage(project, this.userWidgetPageName);
        if (!userWidgetPage) {
            return false;
        }

        const origPage = getAncestorOfType(
            this,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        return testForCycle(userWidgetPage);
    }

    getInputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getInputs();
        }

        const startComponents: ComponentInput[] = page.components
            .filter(component => component instanceof StartActionComponent)
            .map(() => ({
                name: "@seqin",
                type: "null",
                isSequenceInput: true,
                isOptionalInput: false
            }));

        const inputComponents: ComponentInput[] = page.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((inputActionComponent: InputActionComponent) => ({
                name: inputActionComponent.objID,
                displayName: inputActionComponent.name,
                type: inputActionComponent.inputType,
                isSequenceInput: false,
                isOptionalInput: false
            }));

        return [...startComponents, ...inputComponents, ...super.getInputs()];
    }

    getOutputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getOutputs();
        }

        const endComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof EndActionComponent)
            .map(() => ({
                name: "@seqout",
                type: "any",
                isSequenceOutput: true,
                isOptionalOutput: true
            }));

        const outputComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((outputActionComponent: OutputActionComponent) => ({
                name: outputActionComponent.objID,
                displayName: outputActionComponent.name,
                type: outputActionComponent.outputType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }));

        return [...endComponents, ...outputComponents, ...super.getOutputs()];
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        let element;

        const userWidgetPage = this.getUserWidgetPage(flowContext.dataContext);
        if (userWidgetPage && !this.isCycleDetected) {
            let flowStateExists = true;
            if (flowContext.flowState) {
                flowStateExists =
                    !!flowContext.flowState.getFlowStateByComponent(this);
            }

            if (flowStateExists) {
                element = (
                    <ComponentEnclosure
                        component={userWidgetPage}
                        flowContext={
                            flowContext.flowState
                                ? flowContext.overrideFlowState(this)
                                : flowContext
                        }
                        width={width}
                        height={height}
                    />
                );
            }
        }

        return (
            <>
                {flowContext.projectStore.projectTypeTraits
                    .isDashboard ? null : (
                    <ComponentCanvas
                        component={this}
                        width={width}
                        height={height}
                        draw={(ctx: CanvasRenderingContext2D) => {
                            draw.drawBackground(
                                ctx,
                                0,
                                0,
                                width,
                                height,
                                this.style,
                                true
                            );
                        }}
                    />
                )}
                {element}
                {super.render(flowContext, width, height)}
            </>
        );
    }

    open() {
        if (this.userWidgetPage) {
            getProjectStore(this).navigationStore.showObjects(
                [this.userWidgetPage],
                true,
                false,
                false
            );
        }
    }

    fitSize() {
        if (this.userWidgetPage) {
            updateObject(this, {
                width: this.userWidgetPage.rect.width,
                height: this.userWidgetPage.rect.height
            });
        }
    }

    replaceWithContainer() {
        if (this.userWidgetPage) {
            var containerWidgetJsObject: Partial<ContainerWidget> =
                Object.assign({}, ContainerWidget.classInfo.defaultValue);

            containerWidgetJsObject.widgets =
                this.userWidgetPage.components.map(widget =>
                    objectToJS(widget)
                );

            containerWidgetJsObject.left = this.left;
            containerWidgetJsObject.top = this.top;
            containerWidgetJsObject.width = this.width;
            containerWidgetJsObject.height = this.height;

            const projectStore = getProjectStore(this);

            return projectStore.replaceObject(
                getParent(this),
                this,
                createObject<ContainerWidget>(
                    projectStore,
                    containerWidgetJsObject,
                    ContainerWidget
                )
            );
        }
        return undefined;
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // layout
        let userWidgetPage: number = 0;
        if (this.userWidgetPageName) {
            userWidgetPage = assets.getPageIndex(this, "userWidgetPageName");
        }
        dataBuffer.writeInt16(userWidgetPage);

        // context
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "context"));

        // component index
        dataBuffer.writeUint16(assets.getComponentIndex(this));
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const userWidgetPage = this.userWidgetPage;
        if (userWidgetPage) {
            // flowIndex
            const flowIndex = assets.flows.indexOf(userWidgetPage);
            dataBuffer.writeInt16(flowIndex);

            // inputsStartIndex
            if (userWidgetPage.inputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildInputs.findIndex(
                        input =>
                            input.name ==
                            userWidgetPage.inputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(1);
            }

            // outputsStartIndex
            if (userWidgetPage.outputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildOutputs.findIndex(
                        output =>
                            output.name ==
                            userWidgetPage.outputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(0);
            }
        } else {
            // flowIndex
            dataBuffer.writeInt16(-1);
            // inputsStartIndex
            dataBuffer.writeUint8(0);
            // outputsStartIndex
            dataBuffer.writeUint8(0);
        }
    }
}

registerClass("ContainerWidget", ContainerWidget);
registerClass("ListWidget", ListWidget);
registerClass("GridWidget", GridWidget);
registerClass("SelectWidget", SelectWidget);
registerClass("UserWidgetWidget", UserWidgetWidget);
