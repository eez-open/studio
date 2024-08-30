import { MenuItem } from "@electron/remote";
import React from "react";
import { observable, computed, makeObservable } from "mobx";
import classNames from "classnames";
import { each } from "lodash";

import { validators } from "eez-studio-shared/validation";
import { BoundingRectBuilder, Point, Rect } from "eez-studio-shared/geometry";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import * as notification from "eez-studio-ui/notification";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    PropertyInfo,
    PropertyType,
    findClass,
    areAllChildrenOfTheSameParent,
    IOnSelectParams,
    getParent,
    makeDerivedClassInfo,
    PropertyProps,
    isPropertyHidden,
    getProperty,
    MessageType,
    registerClass,
    FlowPropertyType,
    setParent,
    IMessage,
    IPropertyGridGroupDefinition,
    isPropertyOptional,
    setKey
} from "project-editor/core/object";
import {
    getChildOfObject,
    isEezObjectArray,
    getClassInfo,
    getLabel,
    findPropertyByNameInObject,
    getAncestorOfType,
    Message,
    propertyNotSetMessage,
    updateObject,
    createObject,
    ProjectStore,
    getObjectIcon
} from "project-editor/store";
import {
    isLVGLProject,
    isNotDashboardProject,
    isNotLVGLProject,
    isNotProjectWithFlowSupport
} from "project-editor/project/project-type-traits";
import { objectToJS } from "project-editor/store";
import { IContextMenuContext, getProjectStore } from "project-editor/store";

import type {
    IResizeHandler,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import {
    calcComponentGeometry,
    ComponentGeometry
} from "project-editor/flow/editor/render";
import {
    IResizing,
    ResizingProperty
} from "project-editor/flow/editor/resizing-widget-property";

import type {
    ICustomWidgetCreateParams,
    Page
} from "project-editor/features/page/page";
import {
    conditionalStylesProperty,
    Style
} from "project-editor/features/style/style";
import type {
    ContainerWidget,
    UserWidgetWidget,
    ListWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";
import { WIDGET_TYPE_NONE } from "project-editor/flow/components/component-types";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import {
    buildAssignableExpression,
    buildExpression,
    checkAssignableExpression,
    checkExpression,
    checkTemplateLiteralExpression,
    evalConstantExpression,
    parseIdentifier
} from "project-editor/flow/expression";
import {
    variableTypeProperty,
    ValueType,
    VariableTypeFieldComponent,
    CLICK_EVENT_STRUCT_NAME,
    isValidType,
    migrateType,
    makeActionParamsValue
} from "project-editor/features/variable/value-type";
import { expressionBuilder } from "./expression/ExpressionBuilder";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import type {
    IActionComponentDefinition,
    IComponentProperty,
    IDashboardComponentContext
} from "eez-studio-types";
import {
    flowGroup,
    generalGroup,
    geometryGroup,
    layoutGroup,
    specificGroup,
    styleGroup,
    timelineGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import { IconAction } from "eez-studio-ui/action";
import { observer } from "mobx-react";
import {
    ALIGN_HORIZONTAL_LEFT_ICON,
    ALIGN_HORIZONTAL_CENTER_ICON,
    ALIGN_HORIZONTAL_RIGHT_ICON,
    ALIGN_VERTICAL_TOP_ICON,
    ALIGN_VERTICAL_CENTER_ICON,
    ALIGN_VERTICAL_BOTTOM_ICON,
    DISTRIBUTE_HORIZONTAL_LEFT_ICON,
    DISTRIBUTE_HORIZONTAL_CENTER_ICON,
    DISTRIBUTE_HORIZONTAL_RIGHT_ICON,
    DISTRIBUTE_HORIZONTAL_GAPS_ICON,
    DISTRIBUTE_VERTICAL_TOP_ICON,
    DISTRIBUTE_VERTICAL_CENTER_ICON,
    DISTRIBUTE_VERTICAL_BOTTOM_ICON,
    DISTRIBUTE_VERTICAL_GAPS_ICON
} from "project-editor/ui-components/icons";
import { ProjectContext } from "project-editor/project/context";
import { Icon } from "eez-studio-ui/icon";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";

import {
    getTimelineEditorState,
    getTimelineRect,
    isTimelineEditorActive,
    TimelineKeyframe,
    TimelineKeyframePropertyUI,
    timelineStyleHook
} from "project-editor/flow/timeline";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";

import {
    getSerializationProject,
    wireSourceChanged
} from "project-editor/store/serialization";
import { StylePropertyUI } from "project-editor/features/style/StylePropertyUI";
import { findVariable } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

let positionAndSize:
    | {
          top: number;
          left: number;
          width: number;
          height: number;
      }
    | undefined = undefined;

////////////////////////////////////////////////////////////////////////////////

const resizingProperty: PropertyInfo = {
    name: "resizing",
    type: PropertyType.Any,
    propertyGridGroup: geometryGroup,
    propertyGridRowComponent: ResizingProperty,
    skipSearch: true,
    hideInPropertyGrid: (widget: Widget) =>
        isLVGLProject(widget) || isWidgetUnderDockingManager(widget)
};

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    props?: Partial<PropertyInfo>,
    expressionType: ValueType = "any"
): PropertyInfo {
    return Object.assign(
        makeExpressionProperty(
            {
                name,
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "variables/globalVariables",
                propertyGridGroup: specificGroup,
                onSelect: (
                    object: IEezObject,
                    propertyInfo: PropertyInfo,
                    params: IOnSelectParams
                ) => {
                    return expressionBuilder(
                        object,
                        propertyInfo,
                        {
                            assignableExpression: false,
                            title: "Expression Builder"
                        },
                        params
                    );
                },
                isOnSelectAvailable: (component: Component) => {
                    return ProjectEditor.getProject(component).projectTypeTraits
                        .hasFlowSupport;
                }
            },
            expressionType
        ),
        props
    );
}

export function makeStylePropertyInfo(
    name: string,
    displayName?: string,
    props?: Partial<PropertyInfo>
): PropertyInfo {
    return Object.assign(
        {
            name,
            displayName,
            type: PropertyType.Object,
            typeClass: Style,
            propertyGridGroup: styleGroup,
            propertyGridCollapsable: true,
            propertyGridCollapsableDefaultPropertyName: "useStyle",
            enumerable: false,
            hideInPropertyGrid: true
        },
        props
    );
}

export function makeTextPropertyInfo(
    name: string,
    props?: Partial<PropertyInfo>
): PropertyInfo {
    return Object.assign(
        {
            name,
            type: PropertyType.String,
            propertyGridGroup: specificGroup
        },
        props
    );
}

export function migrateStyleProperty(jsObject: any, propertyName: string) {
    if (jsObject[propertyName] === undefined) {
        jsObject[propertyName] = {
            useStyle: "default"
        };
    } else if (typeof jsObject[propertyName] === "string") {
        jsObject[propertyName] = {
            useStyle: jsObject[propertyName]
        };
    } else if (jsObject[propertyName].inheritFrom) {
        jsObject[propertyName].useStyle = jsObject[propertyName].inheritFrom;
        delete jsObject[propertyName].inheritFrom;
    }
}

function getClassFromType(projectStore: ProjectStore, type: string) {
    if (type.startsWith("Local.")) {
        return findClass("UserWidgetWidget");
    }

    if (type == "OverrideStyle") {
        type = "OverrideStyleActionComponent";
    }

    let componentClass;

    const projectTypeTraits =
        projectStore.project?.projectTypeTraits ||
        getSerializationProject().projectTypeTraits;
    if (projectTypeTraits.isDashboard) {
        if (
            type + "Widget" == "DropDownListWidget" ||
            type == "DropDownListWidget"
        ) {
            type = "DropDownListDashboardWidget";
        } else if (
            type + "Widget" == "QRCodeWidget" ||
            type == "QRCodeWidget"
        ) {
            type = "QRCodeDashboardWidget";
        } else if (
            type + "Widget" == "ProgressWidget" ||
            type == "ProgressWidget"
        ) {
            type = "ProgressDashboardWidget";
        } else if (
            type + "Widget" == "ButtonWidget" ||
            type == "ButtonWidget"
        ) {
            type = "ButtonDashboardWidget";
        } else if (type + "Widget" == "TextWidget" || type == "TextWidget") {
            type = "TextDashboardWidget";
        } else if (
            type + "Widget" == "BitmapWidget" ||
            type == "BitmapWidget"
        ) {
            type = "BitmapDashboardWidget";
        } else if (
            type + "Widget" == "RectangleWidget" ||
            type == "RectangleWidget"
        ) {
            type = "RectangleDashboardWidget";
        }
    }

    componentClass = findClass(type + "Widget");
    if (componentClass) {
        return componentClass;
    }

    componentClass = findClass(type);
    if (componentClass) {
        return componentClass;
    }

    if (type.endsWith("ActionComponent")) {
        type = type.substring(0, type.length - "ActionComponent".length);

        componentClass = findClass(type);

        if (componentClass) {
            return componentClass;
        }
    }

    componentClass = projectStore.importedActionComponentClasses.get(type);
    if (componentClass) {
        return componentClass;
    }

    return NotFoundComponent;
}

export function getComponentClass(projectStore: ProjectStore, jsObject: any) {
    if (jsObject.type === "EvalActionComponent") {
        jsObject.type = "EvalJSExprActionComponent";
    }
    if (jsObject.type === "ScpiActionComponent") {
        jsObject.type = "SCPIActionComponent";
    }
    if (jsObject.type === "GetVariableActionComponent") {
        jsObject.type = "WatchVariableActionComponent";
    }
    if (jsObject.type === "HTTPGet") {
        jsObject.type = "HTTP";
    }
    if (
        jsObject.type === "LayoutViewWidget" ||
        jsObject.type === "LayoutView"
    ) {
        jsObject.type = "UserWidgetWidget";
    }
    if (jsObject.type == "SCPITerminalWidget") {
        jsObject.type = "InstrumentTerminalWidget";
    }
    return getClassFromType(projectStore, jsObject.type);
}

export function outputIsOptionalIfAtLeastOneOutputExists(
    component: Component,
    componentOutput: ComponentOutput
) {
    const connectionLines = ProjectEditor.getFlow(component).connectionLines;

    for (const componentOutput of component.outputs) {
        if (componentOutput.name != "@seqout") {
            if (
                connectionLines.find(
                    connectionLine =>
                        connectionLine.sourceComponent === component &&
                        connectionLine.output === componentOutput.name
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function isComponentInputOptional(
    component: Component,
    componentInput: ComponentInput
) {
    return typeof componentInput.isOptionalInput == "boolean"
        ? componentInput.isOptionalInput
        : componentInput.isOptionalInput(component, componentInput);
}

function isComponentOutputOptional(
    component: Component,
    componentOutput: ComponentOutput
) {
    return typeof componentOutput.isOptionalOutput == "boolean"
        ? componentOutput.isOptionalOutput
        : componentOutput.isOptionalOutput(component, componentOutput);
}

////////////////////////////////////////////////////////////////////////////////

export function makeExpressionProperty(
    propertyInfo: PropertyInfo,
    expressionType: ValueType
): PropertyInfo {
    return Object.assign(
        {
            flowProperty: "input",
            expressionType,
            propertyMenu:
                propertyInfo.flowProperty == undefined
                    ? (props: PropertyProps) => {
                          let menuItems: Electron.MenuItem[] = [];

                          if (props.objects.length == 1) {
                              const component = props.objects[0] as Component;

                              if (
                                  !getProperty(
                                      component,
                                      props.propertyInfo.name
                                  ) &&
                                  !component.customInputs.find(
                                      componentInput =>
                                          componentInput.name ==
                                          props.propertyInfo.name
                                  )
                              ) {
                                  menuItems.push(
                                      new MenuItem({
                                          label: "Convert to input",
                                          click: () => {
                                              const projectStore =
                                                  getProjectStore(
                                                      props.objects[0]
                                                  );

                                              projectStore.undoManager.setCombineCommands(
                                                  true
                                              );

                                              const customInput =
                                                  createObject<CustomInput>(
                                                      projectStore,
                                                      {
                                                          name: props
                                                              .propertyInfo
                                                              .name,
                                                          type:
                                                              props.propertyInfo
                                                                  .expressionType ||
                                                              "any"
                                                      },
                                                      CustomInput
                                                  );

                                              projectStore.addObject(
                                                  component.customInputs,
                                                  customInput
                                              );

                                              projectStore.updateObject(
                                                  component,
                                                  {
                                                      [props.propertyInfo.name]:
                                                          customInput.name
                                                  }
                                              );

                                              projectStore.undoManager.setCombineCommands(
                                                  false
                                              );
                                          }
                                      })
                                  );
                              }
                          }

                          return menuItems;
                      }
                    : undefined,
            onSelect: (
                object: IEezObject,
                propertyInfo: PropertyInfo,
                params: IOnSelectParams
            ) =>
                expressionBuilder(
                    object,
                    propertyInfo,
                    {
                        assignableExpression: false,
                        title:
                            propertyInfo.flowProperty == "scpi-template-literal"
                                ? "SCPI Builder"
                                : "Expression Builder"
                    },
                    params
                ),
            monospaceFont: true,
            disableSpellcheck: true
        } as Partial<PropertyInfo>,
        propertyInfo
    );
}

export function makeAssignableExpressionProperty(
    propertyInfo: PropertyInfo,
    expressionType: ValueType
): PropertyInfo {
    return Object.assign(
        {
            flowProperty: "assignable",
            expressionType,
            onSelect: (
                object: IEezObject,
                propertyInfo: PropertyInfo,
                params: IOnSelectParams
            ) =>
                expressionBuilder(
                    object,
                    propertyInfo,
                    {
                        assignableExpression: true,
                        title: "Expression Builder"
                    },
                    params
                ),
            monospaceFont: true,
            disableSpellcheck: true
        } as Partial<PropertyInfo>,
        propertyInfo
    );
}

export function makeTemplateLiteralProperty(
    propertyInfo: PropertyInfo
): PropertyInfo {
    return Object.assign(
        {
            flowProperty: "template-literal",
            expressionType: "string",
            monospaceFont: true,
            disableSpellcheck: true
        } as Partial<PropertyInfo>,
        propertyInfo
    );
}

export function isFlowProperty(
    object: IEezObject | undefined,
    propertyInfo: PropertyInfo,
    flowPropertyTypes: FlowPropertyType[]
) {
    if (!propertyInfo.flowProperty) {
        return false;
    }

    let flowProperty;
    if (typeof propertyInfo.flowProperty == "string") {
        flowProperty = propertyInfo.flowProperty;
    } else {
        flowProperty = propertyInfo.flowProperty(object);
        if (!flowProperty) {
            return false;
        }
    }

    if (
        flowProperty == "input" &&
        propertyInfo.type == PropertyType.ObjectReference &&
        propertyInfo.referencedObjectCollectionPath == "actions"
    ) {
        return false;
    }

    return flowPropertyTypes.indexOf(flowProperty) != -1;
}

////////////////////////////////////////////////////////////////////////////////

// Return immediate parent, which can be of type Page or Widget
// (i.e. ContainerWidget, ListWidget, GridWidget, SelectWidget)
export function getWidgetParent(widget: Component | Page) {
    let parent = getParent(widget);
    if (isEezObjectArray(parent)) {
        parent = getParent(parent);
    }
    return parent as Component | Page;
}

////////////////////////////////////////////////////////////////////////////////

export function componentInputOrOutputUnique(
    object: IEezObject,
    parent: IEezObject,
    collection: "inputs" | "outputs",
    propertyInfo?: PropertyInfo
) {
    const oldName = propertyInfo
        ? getProperty(object, propertyInfo.name)
        : undefined;
    const component = getAncestorOfType(
        parent,
        Component.classInfo
    ) as Component;

    return (object: any, ruleName: string) => {
        if (!component) {
            return "Not component descendant";
        }

        const newName = object[ruleName];
        if (oldName != undefined && newName == oldName) {
            return null;
        }

        let isIdentifier = false;
        try {
            isIdentifier = parseIdentifier(newName);
        } catch (err) {}
        if (!isIdentifier) {
            return "Input name is not a valid identifier. Identifier starts with a letter or an underscore (_), followed by zero or more letters, digits, or underscores. Spaces are not allowed.";
        }

        if (
            ((component as any)[collection] as PropertyInfo[]).find(
                inputOrOutput => inputOrOutput.name == newName
            )
        ) {
            return "Input name is not unique";
        }

        return null;
    };
}

export function componentInputUnique(
    object: IEezObject,
    parent: IEezObject,
    propertyInfo?: PropertyInfo
) {
    return componentInputOrOutputUnique(object, parent, "inputs", propertyInfo);
}

export function componentOutputUnique(
    object: IEezObject,
    parent: IEezObject,
    propertyInfo?: PropertyInfo
) {
    return componentInputOrOutputUnique(
        object,
        parent,
        "outputs",
        propertyInfo
    );
}

////////////////////////////////////////////////////////////////////////////////

export interface ComponentInput {
    name: string;
    type: ValueType;
    isSequenceInput: boolean;
    isOptionalInput:
        | boolean
        | ((component: Component, componentInput: ComponentInput) => boolean);

    alwaysBuild?: boolean;

    displayName?:
        | ((component: Component, componentInput: ComponentInput) => string)
        | string;
}

export interface ComponentOutput {
    name: string;
    type: ValueType;
    isSequenceOutput: boolean;
    isOptionalOutput:
        | boolean
        | ((component: Component, componentOutput: ComponentOutput) => boolean);

    displayName?:
        | ((component: Component, componentOutput: ComponentOutput) => string)
        | string;
}

export class CustomInput extends EezObject implements ComponentInput {
    name: string;
    type: ValueType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable
        });
    }

    get isSequenceInput() {
        return false;
    }
    get isOptionalInput() {
        return false;
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: componentInputUnique
            },
            variableTypeProperty
        ],

        defaultValue: {},

        beforeLoadHook: (object: CustomInput, objectJS: any) => {
            migrateType(objectJS);
        },

        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Component Input",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                componentInputUnique(
                                    createObject<CustomInput>(
                                        project._store,
                                        {},
                                        CustomInput
                                    ),
                                    parent
                                )
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const customInputProperties: Partial<CustomInput> = {
                name: result.values.name,
                type: result.values.type
            };

            const customInput = createObject<CustomInput>(
                project._store,
                customInputProperties,
                CustomInput
            );

            return customInput;
        },

        updateObjectValueHook: (object: CustomInput, values: any) => {
            if (values.name != undefined && object.name != values.name) {
                const component = getAncestorOfType<Component>(
                    object,
                    Component.classInfo
                );
                if (component) {
                    ProjectEditor.getFlow(
                        component
                    ).rerouteConnectionLinesInput(
                        component,
                        object.name,
                        values.name
                    );
                }
            }
        },

        deleteObjectRefHook: (customInput: CustomInput) => {
            const component = getAncestorOfType<Component>(
                customInput,
                Component.classInfo
            ) as Component;

            ProjectEditor.getFlow(component).deleteConnectionLinesToInput(
                component,
                customInput.name
            );
        }
    };

    get asPropertyType() {
        return PropertyType.String;
    }

    get asPropertyInfo(): PropertyInfo {
        return {
            name: this.name,
            type: this.asPropertyType,
            displayName: this.name
        };
    }
}

export class CustomOutput extends EezObject implements ComponentOutput {
    name: string;
    type: ValueType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable
        });
    }

    get isSequenceOutput() {
        return false;
    }
    get isOptionalOutput() {
        return false;
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: componentOutputUnique
            },
            variableTypeProperty
        ],

        defaultValue: {},

        beforeLoadHook: (object: CustomOutput, objectJS: any) => {
            migrateType(objectJS);
        },

        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Component Output",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                componentOutputUnique(
                                    createObject<CustomOutput>(
                                        project._store,
                                        {},
                                        CustomOutput
                                    ),
                                    parent
                                ),
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const customOutputProperties: Partial<CustomOutput> = {
                name: result.values.name,
                type: result.values.type
            };

            const customOutput = createObject<CustomOutput>(
                project._store,
                customOutputProperties,
                CustomOutput
            );

            return customOutput;
        },

        updateObjectValueHook: (object: CustomInput, values: any) => {
            if (values.name != undefined && object.name != values.name) {
                const component = getAncestorOfType<Component>(
                    object,
                    Component.classInfo
                );
                if (component) {
                    ProjectEditor.getFlow(
                        component
                    ).rerouteConnectionLinesOutput(
                        component,
                        object.name,
                        values.name
                    );
                }
            }
        },

        deleteObjectRefHook: (customOutput: CustomOutput) => {
            const component = getAncestorOfType<Component>(
                customOutput,
                Component.classInfo
            ) as Component;

            ProjectEditor.getFlow(component).deleteConnectionLinesFromOutput(
                component,
                customOutput.name
            );
        }
    };

    get asPropertyType() {
        return PropertyType.String;
    }

    get asPropertyInfo(): PropertyInfo {
        return {
            name: this.name,
            type: this.asPropertyType,
            displayName: this.name
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

function addBreakpointMenuItems(
    component: Component,
    menuItems: Electron.MenuItem[]
) {
    if (getClassInfo(component).isFlowExecutableComponent === false) {
        return;
    }

    var additionalMenuItems: Electron.MenuItem[] = [];

    const projectStore = getProjectStore(component);

    const uiStateStore = projectStore.uiStateStore;

    if (projectStore.projectTypeTraits.hasFlowSupport) {
        if (uiStateStore?.isBreakpointAddedForComponent(component)) {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Remove Breakpoint",
                    click: () => uiStateStore.removeBreakpoint(component)
                })
            );

            if (uiStateStore.isBreakpointEnabledForComponent(component)) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Disable Breakpoint",
                        click: () => uiStateStore.disableBreakpoint(component)
                    })
                );
            } else {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Enable Breakpoint",
                        click: () => uiStateStore.enableBreakpoint(component)
                    })
                );
            }
        } else {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Add Breakpoint",
                    click: () => uiStateStore.addBreakpoint(component)
                })
            );
        }
    }

    if (menuItems.length > 0) {
        additionalMenuItems.push(
            new MenuItem({
                type: "separator"
            })
        );
    }

    menuItems.unshift(...additionalMenuItems);
}

////////////////////////////////////////////////////////////////////////////////

interface ComponentAdapter {
    component: Component;
    rect: Rect;
    left: number;
    top: number;
    width: number;
    height: number;
}

const AlignAndDistributePropertyGridUI = observer(
    class AlignAndDistributePropertyGridUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                components: computed,
                boundingRect: computed,
                componentsHorizontallySorted: computed,
                componentsVerticallySorted: computed
            });
        }

        get components(): ComponentAdapter[] {
            return (this.props.objects as Component[]).map(component => {
                const absolutePosition = component.absolutePositionPoint;

                return {
                    component,
                    rect: {
                        left: absolutePosition.x,
                        top: absolutePosition.y,
                        width: component.rect.width,
                        height: component.rect.height
                    },
                    left: absolutePosition.x,
                    top: absolutePosition.y,
                    width: component.rect.width,
                    height: component.rect.height
                };
            });
        }

        get boundingRect() {
            const rectBuilder = new BoundingRectBuilder();
            this.components.forEach(component =>
                rectBuilder.addRect(component.rect)
            );
            return rectBuilder.getRect();
        }

        get componentsHorizontallySorted() {
            return this.components.slice().sort((a, b) => a.left - b.left);
        }

        get componentsVerticallySorted() {
            return this.components.slice().sort((a, b) => a.top - b.top);
        }

        updateObject(
            componentAdapter: ComponentAdapter,
            props: {
                left?: number;
                top?: number;
            }
        ) {
            let parentPosition: Point;

            const parent = getWidgetParent(componentAdapter.component);
            if (parent instanceof Component) {
                parentPosition = parent.absolutePositionPoint;
            } else {
                parentPosition = { x: 0, y: 0 };
            }

            if (props.left != undefined) {
                props.left -= parentPosition.x;
            }

            if (props.top != undefined) {
                props.top -= parentPosition.y;
            }

            const classInfo = getClassInfo(componentAdapter.component);

            if (classInfo.setRect) {
                classInfo.setRect(componentAdapter.component, props);
            } else {
                this.context.updateObject(componentAdapter.component, {
                    left: props.left
                });
            }
        }

        onAlignHorizontalLeft = () => {
            const boundingRect = this.boundingRect;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    left: boundingRect.left
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onAlignHorizontalCenter = () => {
            const boundingRect = this.boundingRect;

            const center = boundingRect.left + boundingRect.width / 2;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    left: Math.round(center - component.width / 2)
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onAlignHorizontalRight = () => {
            const boundingRect = this.boundingRect;

            const right = boundingRect.left + boundingRect.width;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    left: right - component.width
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onAlignVerticalTop = () => {
            const boundingRect = this.boundingRect;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    top: boundingRect.top
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onAlignVerticalCenter = () => {
            const boundingRect = this.boundingRect;

            const center = boundingRect.top + boundingRect.height / 2;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    top: Math.round(center - component.height / 2)
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onAlignVerticalBottom = () => {
            const boundingRect = this.boundingRect;

            const bottom = boundingRect.top + boundingRect.height;

            this.context.undoManager.setCombineCommands(true);

            this.components.forEach(component =>
                this.updateObject(component, {
                    top: bottom - component.height
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeHorizontalLeft = () => {
            const components = this.componentsHorizontallySorted;

            if (components.length < 3) {
                return;
            }

            const leftFirst = components[0].left;
            const leftLast = components[components.length - 1].left;

            const totalWidth = leftLast - leftFirst;

            const width = totalWidth / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    left: Math.round(leftFirst + width * (i + 1))
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeHorizontalCenter = () => {
            const components = this.componentsHorizontallySorted;

            if (components.length < 3) {
                return;
            }

            const centerFirst = components[0].left + components[0].width / 2;
            const centerLast =
                components[components.length - 1].left +
                components[components.length - 1].width / 2;

            const totalWidth = centerLast - centerFirst;

            const width = totalWidth / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    left: Math.round(
                        centerFirst + width * (i + 1) - component.width / 2
                    )
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeHorizontalRight = () => {
            const components = this.componentsHorizontallySorted;

            if (components.length < 3) {
                return;
            }

            const rightFirst = components[0].left + components[0].width;
            const rightLast =
                components[components.length - 1].left +
                components[components.length - 1].width;

            const totalWidth = rightLast - rightFirst;

            const width = totalWidth / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    left: Math.round(
                        rightFirst + width * (i + 1) - component.width
                    )
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeHorizontalGaps = () => {
            const components = this.componentsHorizontallySorted;

            if (components.length < 3) {
                return;
            }

            let totalGap = 0;
            for (let i = 1; i < components.length; i++) {
                totalGap +=
                    components[i].left -
                    (components[i - 1].left + components[i - 1].width);
            }

            let gap = totalGap / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            let left = components[0].left + components[0].width;

            components
                .slice(1, components.length - 1)
                .forEach((component, i) => {
                    left += gap;
                    this.updateObject(component, {
                        left: Math.round(left)
                    });
                    left += component.width;
                });

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeVerticalTop = () => {
            const components = this.componentsVerticallySorted;

            if (components.length < 3) {
                return;
            }

            const topFirst = components[0].top;
            const topLast = components[components.length - 1].top;

            const totalHeight = topLast - topFirst;

            const height = totalHeight / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    top: Math.round(topFirst + height * (i + 1))
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeVerticalCenter = () => {
            const components = this.componentsVerticallySorted;

            if (components.length < 3) {
                return;
            }

            const centerFirst = components[0].top + components[0].height / 2;
            const centerLast =
                components[components.length - 1].top +
                components[components.length - 1].height / 2;

            const totalHeight = centerLast - centerFirst;

            const height = totalHeight / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    top: Math.round(
                        centerFirst + height * (i + 1) - component.height / 2
                    )
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeVerticalBottom = () => {
            const components = this.componentsVerticallySorted;

            if (components.length < 3) {
                return;
            }

            const bottomFirst = components[0].top + components[0].height;
            const bottomLast =
                components[components.length - 1].top +
                components[components.length - 1].height;

            const totalHeight = bottomLast - bottomFirst;

            const height = totalHeight / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            components.slice(1, components.length - 1).forEach((component, i) =>
                this.updateObject(component, {
                    top: Math.round(
                        bottomFirst + height * (i + 1) - component.height
                    )
                })
            );

            this.context.undoManager.setCombineCommands(false);
        };

        onDistributeVerticalGaps = () => {
            const components = this.componentsVerticallySorted;

            if (components.length < 3) {
                return;
            }

            let totalGap = 0;
            for (let i = 1; i < components.length; i++) {
                totalGap +=
                    components[i].top -
                    (components[i - 1].top + components[i - 1].height);
            }

            let gap = totalGap / (components.length - 1);

            this.context.undoManager.setCombineCommands(true);

            let top = components[0].top + components[0].height;

            components
                .slice(1, components.length - 1)
                .forEach((component, i) => {
                    top += gap;
                    this.updateObject(component, {
                        top: Math.round(top)
                    });
                    top += component.height;
                });

            this.context.undoManager.setCombineCommands(false);
        };

        render() {
            return (
                <div className="EezStudio_AlignAndDistributeIcons EezStudio_ActionGroups">
                    <div className="EezStudio_ActionGroup">
                        <div className="EezStudio_ActionGroup_Title">Align</div>
                        <div className="EezStudio_ActionGroup_Actions">
                            <div className="EezStudio_ActionGroup_Actions_Group">
                                <IconAction
                                    icon={ALIGN_HORIZONTAL_LEFT_ICON()}
                                    title="Align left edges"
                                    onClick={this.onAlignHorizontalLeft}
                                />
                                <IconAction
                                    icon={ALIGN_HORIZONTAL_CENTER_ICON()}
                                    title="Center on vertical axis"
                                    onClick={this.onAlignHorizontalCenter}
                                />
                                <IconAction
                                    icon={ALIGN_HORIZONTAL_RIGHT_ICON()}
                                    title="Align right edges"
                                    onClick={this.onAlignHorizontalRight}
                                />
                            </div>
                            <div className="EezStudio_ActionGroup_Actions_Group">
                                <IconAction
                                    icon={ALIGN_VERTICAL_TOP_ICON()}
                                    title="Align top edges"
                                    onClick={this.onAlignVerticalTop}
                                />
                                <IconAction
                                    icon={ALIGN_VERTICAL_CENTER_ICON()}
                                    title="Center on horizontal axis"
                                    onClick={this.onAlignVerticalCenter}
                                />
                                <IconAction
                                    icon={ALIGN_VERTICAL_BOTTOM_ICON()}
                                    title="Align bottom edges"
                                    onClick={this.onAlignVerticalBottom}
                                />
                            </div>
                        </div>
                    </div>
                    {this.components.length >= 3 && (
                        <div className="EezStudio_ActionGroup">
                            <div className="EezStudio_ActionGroup_Title">
                                Distribute
                            </div>
                            <div className="EezStudio_ActionGroup_Actions">
                                <div className="EezStudio_ActionGroup_Actions_Group">
                                    <IconAction
                                        icon={DISTRIBUTE_HORIZONTAL_LEFT_ICON()}
                                        title="Distribute left edges equidistantly"
                                        onClick={
                                            this.onDistributeHorizontalLeft
                                        }
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_HORIZONTAL_CENTER_ICON()}
                                        title="Distribute centers equidistantly horizontally"
                                        onClick={
                                            this.onDistributeHorizontalCenter
                                        }
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_HORIZONTAL_RIGHT_ICON()}
                                        title="Distribute right edges equidistantly"
                                        onClick={
                                            this.onDistributeHorizontalRight
                                        }
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_HORIZONTAL_GAPS_ICON()}
                                        title="Make horizontal gaps equal"
                                        onClick={
                                            this.onDistributeHorizontalGaps
                                        }
                                    />
                                </div>
                                <div className="EezStudio_ActionGroup_Actions_Group">
                                    <IconAction
                                        icon={DISTRIBUTE_VERTICAL_TOP_ICON()}
                                        title="Distribute top edges equidistantly"
                                        onClick={this.onDistributeVerticalTop}
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_VERTICAL_CENTER_ICON()}
                                        title="Distribute centers equidistantly vertically"
                                        onClick={
                                            this.onDistributeVerticalCenter
                                        }
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_VERTICAL_BOTTOM_ICON()}
                                        title="Distribute bottom edges equidistantly"
                                        onClick={
                                            this.onDistributeVerticalBottom
                                        }
                                    />
                                    <IconAction
                                        icon={DISTRIBUTE_VERTICAL_GAPS_ICON()}
                                        title="Make vertical gaps equal"
                                        onClick={this.onDistributeVerticalGaps}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const CenterWidgetUI = observer(
    class CenterWidgetUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get widget() {
            return this.props.objects[0] as Widget;
        }

        get parent() {
            return getWidgetParent(this.widget);
        }

        onCenterHorizontally = () => {
            const parentRect = this.parent.rect;
            const rect = this.widget.rect;

            const left = Math.round((parentRect.width - rect.width) / 2);

            const classInfo = getClassInfo(this.widget);

            classInfo.setRect!(this.widget, {
                left
            });
        };

        onCenterVertically = () => {
            const parentRect = this.parent.rect;
            const rect = this.widget.rect;

            const top = Math.round((parentRect.height - rect.height) / 2);

            const classInfo = getClassInfo(this.widget);

            classInfo.setRect!(this.widget, {
                top
            });
        };

        render() {
            return (
                <div className="EezStudio_AlignAndDistributeIcons">
                    <IconAction
                        icon={ALIGN_HORIZONTAL_CENTER_ICON()}
                        title="Center horizontally relative to parent"
                        onClick={this.onCenterHorizontally}
                    />
                    <IconAction
                        icon={ALIGN_VERTICAL_CENTER_ICON()}
                        title="Center vertically relative to parent"
                        onClick={this.onCenterVertically}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

function getComponentLabel(component: Component) {
    const classInfo = getClassInfo(component);
    if (classInfo.label && classInfo.label != getComponentLabel) {
        return classInfo.label(component);
    }

    let name = getComponentName(component.type);

    if (component instanceof Widget) {
        if (component.data) {
            return `${name}: ${component.data}`;
        }
    }

    return name;
}

////////////////////////////////////////////////////////////////////////////////

function isWidgetUnderDockingManager(widget: Component) {
    const parent = getWidgetParent(widget);
    return (
        parent instanceof ProjectEditor.ContainerWidgetClass &&
        parent.layout == "docking-manager"
    );
}

////////////////////////////////////////////////////////////////////////////////

export type AutoSize = "width" | "height" | "both" | "none";

export class Component extends EezObject {
    type: string;

    left: number;
    top: number;
    width: number;
    height: number;

    customInputs: CustomInput[];
    customOutputs: CustomOutput[];

    _geometry: ComponentGeometry;

    catchError: boolean;

    constructor() {
        super();

        makeObservable(this, {
            absolutePositionPoint: computed,
            absolutePosition: computed,
            inputs: computed,
            outputs: computed,
            buildInputs: computed({ keepAlive: true }),
            buildOutputs: computed({ keepAlive: true }),
            isMoveable: computed,
            rect: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            left: observable,
            top: observable,
            width: observable,
            height: observable,
            customInputs: observable,
            customOutputs: observable,
            _geometry: observable,
            catchError: observable
        });
    }

    static classInfo: ClassInfo = {
        getClass: function (projectStore: ProjectStore, jsObject: any) {
            return getComponentClass(projectStore, jsObject);
        },

        label: getComponentLabel,

        listLabel: (component: Component) => {
            const label = getComponentLabel(component);
            const icon = getObjectIcon(component);
            return (
                <>
                    {icon && (
                        <Icon
                            icon={icon as any}
                            style={{
                                opacity: 0.66,
                                marginRight: 5,
                                width: 18,
                                height: 18
                            }}
                        />
                    )}
                    <span title={label}>{label}</span>
                </>
            );
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            },
            {
                name: "alignAndDistribute",
                type: PropertyType.Any,
                propertyGridGroup: geometryGroup,
                computed: true,
                propertyGridRowComponent: AlignAndDistributePropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (widget: Widget) => {
                    if (isWidgetUnderDockingManager(widget)) {
                        return true;
                    }
                    const projectStore = ProjectEditor.getProjectStore(widget);
                    const propertyGridObjects =
                        projectStore.navigationStore.propertyGridObjects;

                    if (propertyGridObjects.length < 2) {
                        return true;
                    }

                    if (
                        propertyGridObjects.find(
                            object => !(object instanceof Component)
                        )
                    ) {
                        return true;
                    }

                    return false;
                }
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup,
                disabled: isActionComponent,
                hideInPropertyGrid: isWidgetUnderDockingManager,
                hideInDocumentation: "action"
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup,
                disabled: isActionComponent,
                hideInPropertyGrid: isWidgetUnderDockingManager,
                hideInDocumentation: "action"
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup,
                disabled: isActionComponent,
                hideInPropertyGrid: isWidgetUnderDockingManager,
                hideInDocumentation: "action"
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup,
                disabled: isActionComponent,
                hideInPropertyGrid: isWidgetUnderDockingManager,
                hideInDocumentation: "action"
            },
            {
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true,
                disabled: isActionComponent,
                hideInPropertyGrid: isWidgetUnderDockingManager,
                hideInDocumentation: "action"
            },
            {
                name: "centerWidgetUI",
                displayName: "Center widget",
                type: PropertyType.Any,
                propertyGridGroup: geometryGroup,
                computed: true,
                propertyGridRowComponent: CenterWidgetUI,
                skipSearch: true,
                hideInPropertyGrid: (widget: Widget) => {
                    if (isWidgetUnderDockingManager(widget)) {
                        return true;
                    }
                    const projectStore = ProjectEditor.getProjectStore(widget);
                    if (!projectStore) {
                        return false;
                    }
                    const propertyGridObjects =
                        projectStore.navigationStore.propertyGridObjects;
                    return !(
                        propertyGridObjects.length == 1 &&
                        propertyGridObjects[0] instanceof Widget
                    );
                },
                hideInDocumentation: "action"
            },
            {
                name: "customInputs",
                displayName: "Inputs",
                type: PropertyType.Array,
                typeClass: CustomInput,
                propertyGridGroup: flowGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                disabled: isNotProjectWithFlowSupport
            },
            {
                name: "customOutputs",
                displayName: "Outputs",
                type: PropertyType.Array,
                typeClass: CustomOutput,
                propertyGridGroup: flowGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                disabled: isNotProjectWithFlowSupport
            },
            {
                name: "catchError",
                type: PropertyType.Boolean,
                propertyGridGroup: flowGroup,
                disabled: isNotProjectWithFlowSupport,
                checkboxStyleSwitch: true
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject["x"] !== undefined) {
                jsObject["left"] = jsObject["x"];
                delete jsObject["x"];
            }

            if (jsObject["y"] !== undefined) {
                jsObject["top"] = jsObject["y"];
                delete jsObject["y"];
            }

            if (typeof jsObject.left === "string") {
                jsObject.left = parseInt(jsObject.left);
            }

            if (typeof jsObject.top === "string") {
                jsObject.top = parseInt(jsObject.top);
            }

            if (typeof jsObject.width === "string") {
                jsObject.width = parseInt(jsObject.width);
            }

            if (typeof jsObject.height === "string") {
                jsObject.height = parseInt(jsObject.height);
            }

            if (jsObject.asInputProperties) {
                if (!jsObject.customInputs) {
                    jsObject.customInputs = [];
                }

                const classInfo = getClassInfo(object);

                for (const inputProperty of jsObject.asInputProperties) {
                    jsObject[inputProperty] = inputProperty;

                    const propertyInfo = classInfo.properties.find(
                        propertyInfo => propertyInfo.name == inputProperty
                    );

                    jsObject.customInputs.push({
                        name: inputProperty,
                        type: propertyInfo?.expressionType ?? "string"
                    });
                }
                delete jsObject.asInputProperties;
            }
        },

        extendContextMenu: (
            thisObject: Component,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[]
        ): void => {
            addBreakpointMenuItems(thisObject, menuItems);
        },

        isPropertyMenuSupported: true,

        getRect: (object: Component) => {
            return object.rect;
        },
        setRect: (object: Component, value: Partial<Rect>) => {
            const projectStore = getProjectStore(object);

            const props: Partial<Rect> = {};

            const { left, top } = object.fromRelativePosition(
                value.left ?? object.rect.left,
                value.top ?? object.rect.top
            );

            if (left !== object.left) {
                props.left = left;
            }

            if (top !== object.top) {
                props.top = top;
            }

            const width = value.width ?? object.rect.width;
            const height = value.height ?? object.rect.height;

            if (!(object.autoSize == "width" || object.autoSize == "both")) {
                if (width !== object.width) {
                    props.width = width;
                }
            }

            if (!(object.autoSize == "height" || object.autoSize == "both")) {
                if (height !== object.height) {
                    props.height = height;
                }
            }

            projectStore.updateObject(object, props);
        },
        isMoveable: (object: Component) => {
            return object.isMoveable;
        },
        isSelectable: (object: Component) => {
            return true;
        },

        check: (component: Component, messages: IMessage[]) => {
            const connectionLines =
                ProjectEditor.getFlow(component).connectionLines;

            // check connections to inputs
            component.inputs.forEach(componentInput => {
                if (componentInput instanceof CustomInput) {
                    // if (
                    //     componentInput.type === "any" ||
                    //     componentInput.type === "array:any"
                    // ) {
                    //     messages.push(
                    //         new Message(
                    //             MessageType.WARNING,
                    //             `Any type used`,
                    //             getChildOfObject(componentInput, "type")
                    //         )
                    //     );
                    // }

                    const project = ProjectEditor.getProject(component);
                    if (!isValidType(project, componentInput.type)) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid type`,
                                getChildOfObject(componentInput, "type")
                            )
                        );
                    }
                }

                if (
                    !ProjectEditor.getFlow(component).connectionLines.find(
                        connectionLine =>
                            connectionLine.targetComponent === component &&
                            connectionLine.input === componentInput.name
                    ) &&
                    !isComponentInputOptional(component, componentInput)
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `No connection to input "${
                                componentInput.displayName ||
                                componentInput.name
                            }"`,
                            component
                        )
                    );
                }

                // if (
                //     !componentInput.isSequenceInput &&
                //     connectionLines.filter(
                //         connectionLine =>
                //             connectionLine.targetComponent === component &&
                //             connectionLine.input === componentInput.name
                //     ).length > 1
                // ) {
                //     messages.push(
                //         new Message(
                //             MessageType.WARNING,
                //             `Multiple connections lines to data input "${
                //                 componentInput.displayName ||
                //                 componentInput.name
                //             }"`,
                //             component
                //         )
                //     );
                // }
            });

            // check connection from outputs
            component.outputs.forEach(componentOutput => {
                if (componentOutput instanceof CustomOutput) {
                    // if (
                    //     componentOutput.type === "any" ||
                    //     componentOutput.type === "array:any"
                    // ) {
                    //     messages.push(
                    //         new Message(
                    //             MessageType.WARNING,
                    //             `Any type used`,
                    //             getChildOfObject(componentOutput, "type")
                    //         )
                    //     );
                    // }

                    const project = ProjectEditor.getProject(componentOutput);
                    if (!isValidType(project, componentOutput.type)) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid type`,
                                getChildOfObject(componentOutput, "type")
                            )
                        );
                    }
                }

                if (
                    !connectionLines.find(
                        connectionLine =>
                            connectionLine.sourceComponent === component &&
                            connectionLine.output === componentOutput.name
                    ) &&
                    !isComponentOutputOptional(component, componentOutput)
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Output "${
                                componentOutput.displayName
                                    ? typeof componentOutput.displayName ==
                                      "string"
                                        ? componentOutput.displayName
                                        : componentOutput.displayName(
                                              component,
                                              componentOutput
                                          )
                                    : componentOutput.name
                            }" is not connected`,
                            component
                        )
                    );
                }

                // if (
                //     componentOutput.isSequenceOutput &&
                //     connectionLines.filter(
                //         connectionLine =>
                //             connectionLine.sourceComponent === component &&
                //             connectionLine.output === componentOutput.name
                //     ).length > 1
                // ) {
                //     messages.push(
                //         new Message(
                //             MessageType.WARNING,
                //             `Multiple connections lines from sequence output "${
                //                 componentOutput.displayName
                //                     ? typeof componentOutput.displayName ==
                //                       "string"
                //                         ? componentOutput.displayName
                //                         : componentOutput.displayName(
                //                               component,
                //                               componentOutput
                //                           )
                //                     : componentOutput.name
                //             }"`,
                //             component
                //         )
                //     );
                // }
            });

            const projectStore = getProjectStore(component);

            // check properties
            for (const propertyInfo of getClassInfo(component).properties) {
                if (
                    propertyInfo.type == PropertyType.Array &&
                    propertyInfo.hasExpressionProperties
                ) {
                    if (isPropertyHidden(component, propertyInfo)) {
                        continue;
                    }

                    const value = getProperty(component, propertyInfo.name);

                    for (const object of value) {
                        for (const propertyInfo2 of propertyInfo.typeClass!
                            .classInfo.properties) {
                            checkProperty(
                                projectStore,
                                component,
                                messages,
                                object,
                                propertyInfo2
                            );
                        }
                    }
                } else {
                    checkProperty(
                        projectStore,
                        component,
                        messages,
                        component,
                        propertyInfo
                    );
                }
            }
        },

        updateObjectValueHook: (object: Component, values: any) => {
            if (values.catchError !== undefined) {
                if (!values.catchError && object.catchError) {
                    const flow = ProjectEditor.getFlow(object);
                    flow.deleteConnectionLinesFromOutput(object, "@error");
                }
            }
        },

        isFlowExecutableComponent: true,

        deleteObjectRefHook: (
            component: Component,
            options?: { dropPlace?: IEezObject | PropertyInfo }
        ) => {
            const flow = ProjectEditor.getFlow(component);

            let keepConnectionLines =
                options &&
                options.dropPlace &&
                flow == ProjectEditor.getFlow(options.dropPlace as any);

            if (!keepConnectionLines) {
                flow.deleteConnectionLines(component);
            }
        },

        objectsToClipboardData: (components: Component[]) => {
            const flow = ProjectEditor.getFlow(components[0]);
            if (flow) {
                return flow.objectsToClipboardData(components);
            }
            return undefined;
        }
    };

    get relativePosition() {
        return { left: this.left, top: this.top };
    }

    get componentWidth() {
        return this.width ?? 0;
    }

    get componentHeight() {
        return this.height ?? 0;
    }

    fromRelativePosition(left: number, top: number) {
        return { left, top };
    }

    get autoSize(): AutoSize {
        if (ProjectEditor.getProject(this).projectTypeTraits.isDashboard) {
            const parent = getWidgetParent(this);
            if (
                parent instanceof ProjectEditor.ContainerWidgetClass &&
                parent.layout == "docking-manager"
            ) {
                return "both";
            }
        }

        return "none";
    }

    get geometry() {
        if (this._geometry) {
            return this._geometry;
        }

        return calcComponentGeometry(this, undefined, undefined);
    }

    set geometry(value: ComponentGeometry) {
        this._geometry = value;
        this.width = this._geometry.width;
        this.height = this._geometry.height;
    }

    get rect(): Rect {
        if (this instanceof Widget) {
            if (isWidgetUnderDockingManager(this)) {
                const parent = getWidgetParent(this);
                return {
                    left: 0,
                    top: 0,
                    width: parent.width,
                    height: parent.height
                };
            }

            if (this.timeline.length > 0) {
                const timelineEditorState = getTimelineEditorState(this);
                if (timelineEditorState) {
                    return this.getTimelineRect(timelineEditorState.position);
                }
            }
        }

        return {
            left: this.relativePosition.left,
            top: this.relativePosition.top,
            width: this.componentWidth,
            height: this.componentHeight
        };
    }

    get absolutePositionPoint() {
        let x = this.rect.left;
        let y = this.rect.top;

        for (
            let parent = getWidgetParent(this);
            parent &&
            (parent instanceof ProjectEditor.PageClass ||
                parent instanceof ProjectEditor.WidgetClass);
            parent = getWidgetParent(parent)
        ) {
            x += parent.rect.left;
            y += parent.rect.top;
        }

        return { x, y };
    }

    get absolutePosition() {
        const point = this.absolutePositionPoint;

        return `${point.x}, ${point.y}`;
    }

    isInputProperty(property: PropertyInfo | string) {
        const propertyName =
            typeof property == "string" ? property : property.name;
        return !!this.customInputs.find(
            customInput => customInput.name == propertyName
        );
    }

    get inputs(): ComponentInput[] {
        return this.getInputs();
    }

    getInputs(): ComponentInput[] {
        return this.customInputs ?? [];
    }

    get outputs(): ComponentOutput[] {
        return this.getOutputs();
    }

    getOutputs(): ComponentOutput[] {
        const outputs: ComponentOutput[] = [...(this.customOutputs ?? [])];

        if (this.catchError) {
            outputs.push({
                name: "@error",
                displayName: "@Error",
                type: "string",
                isOptionalOutput: false,
                isSequenceOutput: false
            });
        }

        return outputs;
    }

    getEventHandlers(): EventHandler[] | undefined {
        return undefined;
    }

    get buildInputs() {
        const flow = ProjectEditor.getFlow(this);
        return this.inputs.filter(
            input =>
                input.name != "@seqin" ||
                input.alwaysBuild === true ||
                flow.connectionLines.find(
                    connectionLine =>
                        connectionLine.targetComponent == this &&
                        connectionLine.input == "@seqin"
                )
        );
    }

    get buildOutputs() {
        const outputs: {
            name: string;
            type: "output" | "property";
            valueType: ValueType;
        }[] = [];

        const eventHandlers = this.getEventHandlers();
        if (eventHandlers) {
            for (const eventHandler of eventHandlers) {
                outputs.push({
                    name: eventHandler.eventName,
                    type:
                        eventHandler.handlerType == "flow"
                            ? "output"
                            : "property",
                    valueType: eventHandler.eventParamExpressionType
                });
            }
        }

        for (const componentOutput of this.outputs) {
            if (!outputs.find(output => output.name == componentOutput.name)) {
                outputs.push({
                    name: componentOutput.name,
                    type: "output",
                    valueType: componentOutput.type
                });
            }
        }

        return outputs;
    }

    get isMoveable() {
        return true;
    }

    draw?: (ctx: CanvasRenderingContext2D) => void;

    render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return null;
    }

    getClassName(flowContext: IFlowContext) {
        return "";
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        // if (!flowContext.projectStore.projectTypeTraits.isDashboard) {
        //     const backgroundColor = this.style.backgroundColorProperty;
        //     style.backgroundColor = to16bitsColor(backgroundColor);
        // }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

function getWidgetEvents(object: IEezObject) {
    const widgetEvents = getClassInfo(
        getAncestorOfType<Widget>(object, ProjectEditor.WidgetClass.classInfo)!
    ).widgetEvents;

    if (!widgetEvents) {
        return {};
    }

    if (typeof widgetEvents == "function") {
        return widgetEvents(object);
    }

    return widgetEvents;
}

function getEventEnumItems(
    eventHandlers: EventHandler[],
    eventHandler: EventHandler | undefined
) {
    const existingEventNames: string[] = eventHandlers
        .filter(eh => eh != eventHandler)
        .map(eventHandler => eventHandler.eventName);

    const widgetEvents = getWidgetEvents(eventHandlers);

    return Object.keys(widgetEvents)
        .filter(eventName => existingEventNames.indexOf(eventName) == -1)
        .map(eventName => ({
            id: eventName,
            label: eventName
        }));
}

export class EventHandler extends EezObject {
    eventName: string;
    handlerType: "flow" | "action";
    action: string;
    userData: number;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            eventName: observable,
            handlerType: observable,
            action: observable,
            userData: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "eventName",
                displayName: "Event",
                type: PropertyType.Enum,
                enumItems: (eventHandler: EventHandler) => {
                    const eventHandlers = getParent(
                        eventHandler
                    ) as EventHandler[];
                    return getEventEnumItems(eventHandlers, eventHandler);
                },
                enumDisallowUndefined: true
            },
            {
                name: "handlerType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "flow", label: "Flow" },
                    { id: "action", label: "Action" }
                ],
                enumDisallowUndefined: true,
                disabled: eventHandler =>
                    !ProjectEditor.getProject(eventHandler).projectTypeTraits
                        .hasFlowSupport
            },
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "actions",
                disabled: (eventHandler: EventHandler) => {
                    return eventHandler.handlerType != "action";
                }
            },
            {
                name: "userData",
                type: PropertyType.Number,
                disabled: isNotLVGLProject
            }
        ],

        listLabel: (eventHandler: EventHandler, collapsed) =>
            !collapsed
                ? ""
                : `${eventHandler.eventName} ${eventHandler.handlerType}${
                      eventHandler.handlerType == "action"
                          ? `: ${eventHandler.action}`
                          : ""
                  }`,

        updateObjectValueHook: (
            eventHandler: EventHandler,
            values: Partial<EventHandler>
        ) => {
            if (
                values.handlerType == "action" &&
                eventHandler.handlerType == "flow"
            ) {
                const widget = getAncestorOfType<Widget>(
                    eventHandler,
                    ProjectEditor.WidgetClass.classInfo
                )!;

                ProjectEditor.getFlow(widget).deleteConnectionLinesFromOutput(
                    widget,
                    eventHandler.eventName
                );
            } else if (
                values.eventName != undefined &&
                eventHandler.eventName != values.eventName
            ) {
                const widget = getAncestorOfType<Widget>(
                    eventHandler,
                    ProjectEditor.WidgetClass.classInfo
                );
                if (widget) {
                    ProjectEditor.getFlow(widget).rerouteConnectionLinesOutput(
                        widget,
                        eventHandler.eventName,
                        values.eventName
                    );
                }
            }
        },

        deleteObjectRefHook: (eventHandler: EventHandler) => {
            const widget = getAncestorOfType<Widget>(
                eventHandler,
                ProjectEditor.WidgetClass.classInfo
            )!;

            ProjectEditor.getFlow(widget).deleteConnectionLinesFromOutput(
                widget,
                eventHandler.eventName
            );
        },

        defaultValue: {
            handlerType: "flow"
        },

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.trigger) {
                jsObject.eventName = jsObject.trigger;
                delete jsObject.trigger;
            }

            if (jsObject.userData == undefined) {
                jsObject.userData = 0;
            }
        },

        newItem: async (eventHandlers: EventHandler[]) => {
            const project = ProjectEditor.getProject(eventHandlers);

            const eventEnumItems = getEventEnumItems(eventHandlers, undefined);

            if (eventEnumItems.length == 0) {
                notification.info("All event handlers are already defined");
                return;
            }

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Event Handler",
                    fields: [
                        {
                            name: "eventName",
                            displayName: "Event",
                            type: "enum",
                            enumItems: eventEnumItems
                        },
                        {
                            name: "handlerType",
                            type: "enum",
                            enumItems: [
                                { id: "flow", label: "Flow" },
                                { id: "action", label: "Action" }
                            ],
                            visible: () =>
                                project.projectTypeTraits.hasFlowSupport
                        },
                        {
                            name: "action",
                            type: "enum",
                            enumItems: project.actions.map(action => ({
                                id: action.name,
                                label: action.name
                            })),
                            visible: (values: any) => {
                                return values.handlerType == "action";
                            }
                        }
                    ]
                },
                values: {
                    handlerType: project.projectTypeTraits.hasFlowSupport
                        ? "flow"
                        : "action"
                },
                dialogContext: project
            });

            const properties: Partial<EventHandler> = {
                eventName: result.values.eventName,
                handlerType: result.values.handlerType,
                action: result.values.action
            };

            const eventHandler = createObject<EventHandler>(
                project._store,
                properties,
                EventHandler
            );

            return eventHandler;
        },

        check: (eventHandler: EventHandler, messages: IMessage[]) => {
            if (eventHandler.handlerType == "action") {
                if (!eventHandler.action) {
                    messages.push(
                        propertyNotSetMessage(eventHandler, "action")
                    );
                }
                ProjectEditor.documentSearch.checkObjectReference(
                    eventHandler,
                    "action",
                    messages
                );
            }
        }
    };

    get eventCode() {
        return getWidgetEvents(this)[this.eventName].code;
    }

    get eventParamExpressionType() {
        const widget = getAncestorOfType(
            this,
            ProjectEditor.WidgetClass.classInfo
        );
        if (widget) {
            const classInfo = getClassInfo(widget);
            if (classInfo.overrideEventParamExpressionType) {
                const valueType = classInfo.overrideEventParamExpressionType(
                    widget,
                    this.eventName
                );
                if (valueType != undefined) {
                    return valueType;
                }
            }
        }

        return getWidgetEvents(this)[this.eventName].paramExpressionType;
    }
}

const eventsGroup: IPropertyGridGroupDefinition = {
    id: "widget-event-handlers",
    title: "Events",
    position: 4
};

export const eventHandlersProperty: PropertyInfo = {
    name: "eventHandlers",
    type: PropertyType.Array,
    typeClass: EventHandler,
    propertyGridGroup: eventsGroup,
    partOfNavigation: false,
    enumerable: false,
    defaultValue: []
};

////////////////////////////////////////////////////////////////////////////////

export class Widget extends Component {
    data?: string;
    visible?: string;
    resizing: IResizing;
    style: Style;

    allowOutside: boolean;

    locked: boolean;
    hiddenInEditor: boolean;

    eventHandlers: EventHandler[];

    timeline: TimelineKeyframe[];

    tabTitle: string;

    outputWidgetHandle: boolean;

    static classInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            resizingProperty,
            makeDataPropertyInfo("data", {
                disabled: isLVGLProject,
                hideInDocumentation: "all"
            }),
            makeDataPropertyInfo(
                "visible",
                {
                    disabled: isLVGLProject
                },
                "boolean"
            ),
            makeStylePropertyInfo("style", "Default style", {
                hideInDocumentation: "all"
            }),
            {
                name: "styleUI",
                type: PropertyType.Any,
                propertyGridGroup: styleGroup,
                propertyGridRowComponent: StylePropertyUI,
                computed: true,
                skipSearch: true,
                hideInPropertyGrid: isLVGLProject
            },
            {
                name: "allowOutside",
                displayName: `Hide "Widget is outside of its parent" warning`,
                type: PropertyType.Boolean,
                propertyGridGroup: geometryGroup,
                disabled: component => isLVGLProject(component),
                hideInPropertyGrid: isWidgetUnderDockingManager
            },
            {
                name: "locked",
                type: PropertyType.Boolean,
                hideInPropertyGrid: true
            },
            {
                name: "hiddenInEditor",
                type: PropertyType.Boolean,
                hideInPropertyGrid: true
            },
            {
                name: "timeline",
                type: PropertyType.Array,
                typeClass: TimelineKeyframe,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                hideInPropertyGrid: true
            },
            {
                name: "timelineUI",
                displayName: "Keyframe editor",
                type: PropertyType.Any,
                propertyGridGroup: timelineGroup,
                propertyGridRowComponent: TimelineKeyframePropertyUI,
                computed: true,
                skipSearch: true,
                hideInPropertyGrid: (widget: Widget) =>
                    !ProjectEditor.getProject(widget).projectTypeTraits
                        .hasFlowSupport ||
                    !isTimelineEditorActive(widget) ||
                    isWidgetUnderDockingManager(widget)
            },
            makeExpressionProperty(
                {
                    name: "tabTitle",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: layoutGroup,
                    hideInPropertyGrid: (widget: Widget) => {
                        const projectStore =
                            ProjectEditor.getProjectStore(widget);

                        if (projectStore.projectTypeTraits.isDashboard) {
                            const parent = getWidgetParent(widget);
                            if (
                                parent instanceof
                                    ProjectEditor.ContainerWidgetClass &&
                                parent.layout == "docking-manager"
                            ) {
                                return false;
                            }
                        }
                        return true;
                    }
                },
                "string"
            ),
            eventHandlersProperty,
            {
                name: "outputWidgetHandle",
                type: PropertyType.Boolean,
                propertyGridGroup: flowGroup,
                disabled: isNotDashboardProject,
                checkboxStyleSwitch: true
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            // MIGRATION TO LOW RES
            if ((window as any).__eezProjectMigration) {
                jsObject.left = Math.floor(
                    (jsObject.left * __eezProjectMigration.displayTargetWidth) /
                        __eezProjectMigration.displaySourceWidth
                );
                jsObject.top = Math.floor(
                    (jsObject.top * __eezProjectMigration.displayTargetHeight) /
                        __eezProjectMigration.displaySourceHeight
                );
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

            if (jsObject.eventHandlers == undefined) {
                jsObject.eventHandlers = [];
            }

            const classInfo = getClassInfo(object);

            if (
                classInfo.widgetEvents &&
                typeof classInfo.widgetEvents == "object"
            ) {
                if (jsObject.action) {
                    for (const eventName of Object.keys(
                        classInfo.widgetEvents
                    )) {
                        const eventDef = classInfo.widgetEvents[eventName];
                        if (eventDef.oldName == "action") {
                            jsObject.eventHandlers.push({
                                eventName,
                                handlerType: "action",
                                action: jsObject.action
                            });
                            break;
                        }
                    }

                    delete jsObject.action;
                }

                if (jsObject.asOutputProperties?.length > 0) {
                    for (const asOutputProperty of jsObject.asOutputProperties) {
                        for (const eventName of Object.keys(
                            classInfo.widgetEvents
                        )) {
                            const eventDef = classInfo.widgetEvents[eventName];
                            if (eventDef.oldName == asOutputProperty) {
                                jsObject.eventHandlers.push({
                                    eventName,
                                    handlerType: "flow"
                                });
                                wireSourceChanged(
                                    object,
                                    asOutputProperty,
                                    eventName
                                );
                                break;
                            }
                        }
                    }
                    delete jsObject.asOutputProperties;
                }
            }

            if (jsObject.type.startsWith("Local.")) {
                jsObject.layout = jsObject.type.substring("Local.".length);
                jsObject.type = "UserWidgetWidget";
            }

            migrateStyleProperty(jsObject, "style");

            if (jsObject.style && typeof jsObject.style.padding === "number") {
                delete jsObject.style.padding;
            }

            delete jsObject.activeStyle;

            if (jsObject.className) {
                jsObject.style = {
                    useStyle: jsObject.className
                };
                delete jsObject.className;
            }
        },

        extendContextMenu: (
            thisObject: Widget,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[]
        ): void => {
            addBreakpointMenuItems(thisObject, menuItems);

            var additionalMenuItems: Electron.MenuItem[] = [];

            const project = ProjectEditor.getProject(objects[0]);
            if (!project.projectTypeTraits.isLVGL) {
                if (objects.length === 1) {
                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Put in Select",
                            click: () => {
                                const selectWidget = (
                                    objects[0] as Widget
                                ).putInSelect();
                                context.selectObject(selectWidget);
                            }
                        })
                    );
                }

                if (areAllChildrenOfTheSameParent(objects)) {
                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Put in Container",
                            click: () => {
                                const containerWidget = Widget.putInContainer(
                                    objects as Widget[]
                                );
                                context.selectObject(containerWidget);
                            }
                        })
                    );

                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Put in List",
                            click: () => {
                                const listWidget = Widget.putInList(
                                    objects as Widget[]
                                );
                                context.selectObject(listWidget);
                            }
                        })
                    );

                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Create User Widget",
                            click: async () => {
                                const layoutWidget =
                                    await Widget.createUserWidgetPage(
                                        objects as Widget[]
                                    );
                                if (layoutWidget) {
                                    context.selectObject(layoutWidget);
                                }
                            }
                        })
                    );

                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Replace with User Widget",
                            click: async () => {
                                const layoutWidget =
                                    await Widget.replaceWithUserWidgetPage(
                                        objects as Widget[]
                                    );
                                if (layoutWidget) {
                                    context.selectObject(layoutWidget);
                                }
                            }
                        })
                    );
                }
            }

            if (additionalMenuItems.length > 0) {
                additionalMenuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Copy position and size",
                        click: async () => {
                            positionAndSize = thisObject.rect;
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Paste position and size",
                        click: async () => {
                            if (positionAndSize) {
                                updateObject(thisObject, {
                                    top: positionAndSize.top,
                                    left: positionAndSize.left,
                                    width: positionAndSize.width,
                                    height: positionAndSize.height
                                });
                            }
                        },
                        enabled: positionAndSize != undefined
                    })
                );
            }

            menuItems.unshift(...additionalMenuItems);
        },

        check: (object: Component, messages: IMessage[]) => {
            if (
                object instanceof Widget &&
                !(object instanceof ProjectEditor.LVGLWidgetClass) &&
                !object.allowOutside
            ) {
                const parent = getWidgetParent(object);
                if (
                    !(
                        parent instanceof ProjectEditor.ContainerWidgetClass &&
                        parent.layout == "docking-manager"
                    )
                ) {
                    if (object.left < 0) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                "Widget is outside of its parent",
                                getChildOfObject(object, "left")
                            )
                        );
                    }

                    if (object.top < 0) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                "Widget is outside of its parent",
                                getChildOfObject(object, "top")
                            )
                        );
                    }

                    if (
                        object.left + object.width >
                        getWidgetParent(object).rect.width
                    ) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                "Widget is outside of its parent",
                                getChildOfObject(object, "width")
                            )
                        );
                    }

                    if (
                        object.top + object.height >
                        getWidgetParent(object).rect.height
                    ) {
                        messages.push(
                            new Message(
                                MessageType.WARNING,
                                "Widget is outside of its parent",
                                getChildOfObject(object, "height")
                            )
                        );
                    }
                }
            }

            const projectStore = getProjectStore(object);

            if (!projectStore.projectTypeTraits.hasFlowSupport) {
                ProjectEditor.documentSearch.checkObjectReference(
                    object,
                    "data",
                    messages
                );
            }
        },

        updateObjectValueHook: (object: Widget, values: any) => {
            if (values.outputWidgetHandle !== undefined) {
                if (!values.outputWidgetHandle && object.outputWidgetHandle) {
                    const flow = ProjectEditor.getFlow(object);
                    flow.deleteConnectionLinesFromOutput(object, "@widget");
                }
            }
        },

        showSelectedObjectsParent: () => {
            return true;
        },
        getResizeHandlers(widget: Widget) {
            return widget.getResizeHandlers();
        },
        isSelectable(widget: Widget) {
            return !widget.locked;
        },
        isMoveable(widget: Widget) {
            const parent = ProjectEditor.getWidgetParent(widget);
            if (
                parent instanceof ProjectEditor.ContainerWidgetClass &&
                parent.layout == "docking-manager"
            ) {
                return false;
            }

            return !widget.locked && !getTimelineEditorState(widget);
        },

        getAdditionalFlowProperties: (widget: Widget) => {
            const additionalProperties: PropertyInfo[] = [];

            const classInfo = getClassInfo(widget);

            for (const propertyInfo of classInfo.properties) {
                if (
                    propertyInfo.type == PropertyType.Object &&
                    propertyInfo.typeClass == Style
                ) {
                    const style = (widget as any)[propertyInfo.name] as Style;

                    if (style.conditionalStyles) {
                        for (
                            let index = 0;
                            index < style.conditionalStyles.length;
                            index++
                        ) {
                            additionalProperties.push(
                                Object.assign(
                                    {},
                                    ProjectEditor.conditionalStyleConditionProperty,
                                    {
                                        name: `${propertyInfo.name}.${conditionalStylesProperty.name}[${index}].${ProjectEditor.conditionalStyleConditionProperty.name}`
                                    }
                                )
                            );
                        }
                    }
                }
            }

            return additionalProperties;
        },

        execute: (context: IDashboardComponentContext) => {
            if (context.getOutputType("@widget")) {
                if (
                    !context.WasmFlowRuntime.hasWidgetHandle(
                        context.flowStateIndex,
                        context.getComponentIndex()
                    )
                ) {
                    context.propagateValue(
                        "@widget",
                        context.WasmFlowRuntime.getWidgetHandle(
                            context.flowStateIndex,
                            context.getComponentIndex()
                        )
                    );
                }
            }
        },

        widgetEvents: {
            CLICKED: {
                code: 1,
                paramExpressionType: `struct:${CLICK_EVENT_STRUCT_NAME}`,
                oldName: "action"
            }
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            styleObject: computed,
            tabTitle: observable
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            data: observable,
            visible: observable,
            resizing: observable,
            style: observable,
            allowOutside: observable,
            locked: observable,
            hiddenInEditor: observable,
            timeline: observable,
            eventHandlers: observable,
            outputWidgetHandle: observable
        });
    }

    get styleObject() {
        return this.style;
    }

    get styles() {
        return [this.style];
    }

    getOutputs(): ComponentOutput[] {
        const outputs = super.getOutputs();

        if (this.outputWidgetHandle) {
            outputs.push({
                name: "@widget",
                displayName: "@Widget",
                type: "widget",
                isOptionalOutput: false,
                isSequenceOutput: false
            });
        }

        return [
            ...outputs,
            ...this.eventHandlers
                .filter(eventHandler => eventHandler.handlerType == "flow")
                .map(eventHandler => ({
                    name: eventHandler.eventName,
                    type: eventHandler.eventParamExpressionType,
                    isOptionalOutput: false,
                    isSequenceOutput: false
                }))
        ];
    }

    getEventHandlers(): EventHandler[] | undefined {
        return this.eventHandlers;
    }

    isFlowEventHander(eventName: string) {
        return (
            this.eventHandlers.find(
                eventHandler =>
                    eventHandler.eventName == eventName &&
                    eventHandler.handlerType == "flow"
            ) != undefined
        );
    }

    getDefaultActionEventName() {
        const widgetEvents = getWidgetEvents(this);

        for (const eventName of Object.keys(widgetEvents)) {
            const eventDef = widgetEvents[eventName];
            if (eventDef.oldName == "action") {
                return eventName;
            }
        }

        return "CLICKED";
    }

    get action() {
        const defaultActionEventName = this.getDefaultActionEventName();

        return this.eventHandlers.find(
            eventHandler =>
                eventHandler.eventName == defaultActionEventName &&
                eventHandler.handlerType == "action"
        )?.action;
    }

    putInSelect() {
        const projectStore = getProjectStore(this);

        var selectWidgetProperties: Partial<SelectWidget> = Object.assign(
            {},
            getClassFromType(projectStore, "Select")?.classInfo.defaultValue,
            { type: "Select" }
        );

        const selectWidget = createObject<SelectWidget>(
            projectStore,
            selectWidgetProperties,
            ProjectEditor.SelectWidgetClass
        );

        selectWidget.left = this.left;
        selectWidget.top = this.top;
        selectWidget.width = this.width;
        selectWidget.height = this.height;

        selectWidget.widgets.push(this);

        projectStore.undoManager.setCombineCommands(true);

        const result = projectStore.replaceObject(
            this,
            selectWidget,
            selectWidget.widgets
        );

        projectStore.updateObject(this, {
            left: 0,
            top: 0
        });

        projectStore.undoManager.setCombineCommands(false);

        return result;
    }

    static createWidgets(fromWidgets: Component[]) {
        let x1 = fromWidgets[0].left;
        let y1 = fromWidgets[0].top;
        let x2 = fromWidgets[0].left + fromWidgets[0].width;
        let y2 = fromWidgets[0].top + fromWidgets[0].height;

        for (let i = 1; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            x1 = Math.min(widget.left, x1);
            y1 = Math.min(widget.top, y1);
            x2 = Math.max(widget.left + widget.width, x2);
            y2 = Math.max(widget.top + widget.height, y2);
        }

        const widgets = [];

        for (let i = 0; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            let widgetJsObject = objectToJS(widget);

            widgetJsObject.left = fromWidgets[i].left - x1;
            delete widgetJsObject.left_;
            widgetJsObject.top = fromWidgets[i].top - y1;
            delete widgetJsObject.top_;

            widgets.push(widgetJsObject);
        }

        return {
            widgets,
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    static getBoundingRect(widgets: Widget[]) {
        let x1 = widgets[0].left;
        let y1 = widgets[0].top;
        let x2 = widgets[0].left + widgets[0].width;
        let y2 = widgets[0].top + widgets[0].height;

        for (let i = 1; i < widgets.length; i++) {
            let widget = widgets[i];

            x1 = Math.min(widget.left, x1);
            y1 = Math.min(widget.top, y1);
            x2 = Math.max(widget.left + widget.width, x2);
            y2 = Math.max(widget.top + widget.height, y2);
        }

        return {
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    static repositionWidgets(
        projectStore: ProjectStore,
        widgets: Widget[],
        boundingRect: Rect
    ) {
        for (let i = 0; i < widgets.length; i++) {
            let widget = widgets[i];

            projectStore.updateObject(widget, {
                left: widgets[i].left - boundingRect.left,
                top: widgets[i].top - boundingRect.top
            });
        }
    }

    static putInContainer(fromWidgets: Widget[]) {
        const projectStore = getProjectStore(fromWidgets[0]);

        var containerWidgetProperties: Partial<ContainerWidget> = Object.assign(
            {},
            getClassFromType(projectStore, "Container")?.classInfo.defaultValue,
            { type: "Container" }
        );

        var containerWidget = createObject<ContainerWidget>(
            projectStore,
            containerWidgetProperties,
            ProjectEditor.ContainerWidgetClass
        );

        const boundingRect = Widget.getBoundingRect(fromWidgets);

        containerWidget.left = boundingRect.left;
        containerWidget.top = boundingRect.top;
        containerWidget.width = boundingRect.width;
        containerWidget.height = boundingRect.height;

        fromWidgets.forEach(widget => {
            containerWidget.widgets.push(widget);
        });

        projectStore.undoManager.setCombineCommands(true);

        const result = projectStore.replaceObjects(
            fromWidgets,
            containerWidget,
            containerWidget.widgets
        );

        Widget.repositionWidgets(projectStore, fromWidgets, boundingRect);

        projectStore.undoManager.setCombineCommands(false);

        return result;
    }

    static putInList(fromWidgets: Widget[]) {
        const projectStore = getProjectStore(fromWidgets[0]);

        let boundingRect: Rect | undefined;

        var containerWidgetJsObjectProperties: Partial<ContainerWidget> =
            Object.assign(
                {},
                getClassFromType(projectStore, "Container")?.classInfo
                    .defaultValue,
                { type: "Container" }
            );

        let containerWidget = createObject<ContainerWidget>(
            projectStore,
            containerWidgetJsObjectProperties,
            ProjectEditor.ContainerWidgetClass
        );

        boundingRect = Widget.getBoundingRect(fromWidgets);

        fromWidgets.forEach(widget => {
            containerWidget.widgets.push(widget);
        });

        containerWidget.left = boundingRect.left;
        containerWidget.top = boundingRect.top;
        containerWidget.width = boundingRect.width;
        containerWidget.height = boundingRect.height;

        var listWidgetJsObjectProperties: Partial<ListWidget> = Object.assign(
            {},
            getClassFromType(projectStore, "List")?.classInfo.defaultValue,
            { type: "List" }
        );
        const listWidget = createObject<ListWidget>(
            projectStore,
            listWidgetJsObjectProperties,
            ProjectEditor.ListWidgetClass
        );

        listWidget.itemWidget = containerWidget;
        setParent(containerWidget, listWidget);
        setKey(containerWidget, "itemWidget");

        listWidget.left = containerWidget.left;
        listWidget.top = containerWidget.top;
        listWidget.width = containerWidget.width;
        listWidget.height = containerWidget.height;

        containerWidget.left = 0;
        containerWidget.top = 0;

        projectStore.undoManager.setCombineCommands(true);

        const result = projectStore.replaceObjects(
            fromWidgets,
            listWidget,
            containerWidget.widgets
        );

        if (boundingRect) {
            Widget.repositionWidgets(projectStore, fromWidgets, boundingRect);
        }

        projectStore.undoManager.setCombineCommands(false);

        return result;
    }

    static async createUserWidgetPage(fromWidgets: Component[]) {
        const projectStore = getProjectStore(fromWidgets[0]);

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "User widget name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(
                                    {},
                                    projectStore.project.pages,
                                    "Page or User Widget with this name already exists"
                                )
                            ]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const userWidgetName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            projectStore.addObject(
                projectStore.project.userWidgets,
                createObject<Page>(
                    projectStore,
                    {
                        name: userWidgetName,
                        left: 0,
                        top: 0,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        components: createWidgetsResult.widgets,
                        isUsedAsUserWidget: true
                    },
                    ProjectEditor.PageClass
                )
            );

            return projectStore.replaceObjects(
                fromWidgets,
                createObject<UserWidgetWidget>(
                    projectStore,
                    {
                        type: "UserWidgetWidget",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        userWidgetPageName: userWidgetName
                    },
                    ProjectEditor.UserWidgetWidgetClass
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    static async replaceWithUserWidgetPage(fromWidgets: Component[]) {
        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "User widget name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const userWidgetPageName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            return getProjectStore(fromWidgets[0]).replaceObjects(
                fromWidgets,
                createObject<UserWidgetWidget>(
                    getProjectStore(fromWidgets[0]),
                    {
                        type: "UserWidgetWidget",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        userWidgetPageName
                    },
                    ProjectEditor.UserWidgetWidgetClass
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (isTimelineEditorActive(this)) {
            return [];
        }

        if (this.autoSize == "both") {
            return [];
        }

        if (this.autoSize == "width") {
            return [
                {
                    x: 50,
                    y: 0,
                    type: "n-resize"
                },
                {
                    x: 50,
                    y: 100,
                    type: "s-resize"
                }
            ];
        }

        if (this.autoSize == "height") {
            return [
                {
                    x: 0,
                    y: 50,
                    type: "w-resize"
                },
                {
                    x: 100,
                    y: 50,
                    type: "e-resize"
                }
            ];
        }

        return [
            {
                x: 0,
                y: 0,
                type: "nw-resize"
            },
            {
                x: 50,
                y: 0,
                type: "n-resize"
            },
            {
                x: 100,
                y: 0,
                type: "ne-resize"
            },
            {
                x: 0,
                y: 50,
                type: "w-resize"
            },
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 0,
                y: 100,
                type: "sw-resize"
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

    onClick(flowContext: IFlowContext) {
        if (
            !flowContext.projectStore.runtime ||
            !flowContext.projectStore.projectTypeTraits.isDashboard ||
            !this.eventHandlers.find(
                eventHandler => eventHandler.eventName == "CLICKED"
            )
        ) {
            return undefined;
        }

        return (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (flowContext.projectStore.runtime) {
                flowContext.projectStore.runtime.executeWidgetAction(
                    flowContext,
                    this,
                    "CLICKED",
                    makeActionParamsValue(flowContext),
                    `struct:${CLICK_EVENT_STRUCT_NAME}`
                );
            }
        };
    }

    getClassName(flowContext: IFlowContext) {
        return classNames(
            "eez-widget",
            this.type,
            this.style.classNames,
            this.style.getConditionalClassNames(flowContext)
        );
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        if (this.timeline.length > 0) {
            timelineStyleHook(this, style, flowContext);
        }
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        if (flowContext.frontFace) {
            return null;
        }

        if (flowContext.document.flow.object !== ProjectEditor.getFlow(this)) {
            return null;
        }

        // if this component is inside the list then show inputs and outputs
        // only for the fist component ($index == 0)
        if (flowContext.dataContext.has(FLOW_ITERATOR_INDEX_VARIABLE)) {
            const listIndex = flowContext.dataContext.get(
                FLOW_ITERATOR_INDEX_VARIABLE
            );
            if (listIndex > 0) {
                return null;
            }
        }

        const inputs = this.inputs;
        const outputs = this.outputs;

        if (inputs.length === 0 && outputs.length === 0) {
            return null;
        }

        return (
            <>
                <div className="inputs">
                    {inputs.map(input => (
                        <div
                            key={input.name}
                            data-connection-input-id={input.name}
                            className={classNames({
                                seq: input.name === "@seqin"
                            })}
                            title={getInputDisplayName(this, input, true)}
                        ></div>
                    ))}
                </div>
                <div className="outputs">
                    {outputs.map(output => (
                        <div
                            key={output.name}
                            data-connection-output-id={output.name}
                            className={classNames({
                                seq: output.name === "@seqout",
                                error: output.name === "@error"
                            })}
                            title={getOutputDisplayName(this, output, true)}
                        ></div>
                    ))}
                </div>
            </>
        );
    }

    getWidgetType() {
        return getClassInfo(this).flowComponentId ?? WIDGET_TYPE_NONE;
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {}

    getTimelineRect(timelinePosition: number): Rect {
        return getTimelineRect(this, timelinePosition);
    }

    lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number,
        customWidget?: ICustomWidgetCreateParams
    ) {
        return 0;
    }

    lvglPostCreate(runtime: LVGLPageRuntime) {}
}

////////////////////////////////////////////////////////////////////////////////

export function ComponentInputSpan({
    componentInput,
    title
}: {
    componentInput: ComponentInput;
    title?: string;
}) {
    const className = classNames(
        "input",
        componentInput.isSequenceInput ? "seq-connection" : "data-connection",
        {
            optional: componentInput.isOptionalInput
        }
    );
    return (
        <span
            className={className}
            data-connection-input-id={componentInput.name}
            title={title}
        ></span>
    );
}

export function ComponentOutputSpan({
    componentOutput,
    title
}: {
    componentOutput: ComponentOutput;
    title?: string;
}) {
    const className = classNames(
        "output",
        componentOutput.isSequenceOutput ? "seq-connection" : "data-connection",
        {
            optional: componentOutput.isOptionalOutput,
            error: componentOutput.name === "@error"
        }
    );
    return (
        <span
            className={className}
            data-connection-output-id={componentOutput.name}
            title={title}
        ></span>
    );
}

function renderActionComponent(
    actionNode: ActionComponent,
    flowContext: IFlowContext
) {
    const classInfo = getClassInfo(actionNode);

    //
    let seqInputIndex = -1;
    for (let i = 0; i < actionNode.inputs.length; i++) {
        const input = actionNode.inputs[i];
        if (input.isSequenceInput && input.name == "@seqin") {
            if (seqInputIndex === -1) {
                seqInputIndex = i;
            } else {
                seqInputIndex = -1;
                break;
            }
        }
    }

    let inputs: ComponentInput[];
    if (seqInputIndex != -1) {
        inputs = [
            ...actionNode.inputs.slice(0, seqInputIndex),
            ...actionNode.inputs.slice(seqInputIndex + 1)
        ];
    } else {
        inputs = actionNode.inputs;
    }

    //
    let seqOutputIndex = -1;
    let i;
    for (i = 0; i < actionNode.outputs.length; i++) {
        const output = actionNode.outputs[i];
        if (output.isSequenceOutput && output.name == "@seqout") {
            if (seqOutputIndex === -1) {
                seqOutputIndex = i;
            } else {
                seqOutputIndex = -1;
                break;
            }
        }
    }

    let outputs: ComponentOutput[];
    if (seqOutputIndex != -1) {
        outputs = [
            ...actionNode.outputs.slice(0, seqOutputIndex),
            ...actionNode.outputs.slice(seqOutputIndex + 1)
        ];
    } else {
        outputs = actionNode.outputs;
    }

    let titleStyle: React.CSSProperties | undefined;
    if (classInfo.componentHeaderColor) {
        titleStyle = {
            backgroundColor: classInfo.componentHeaderColor
        };
    }

    const body = actionNode.getBody(flowContext);

    const emptyContent = !body && !inputs.length && !outputs.length;

    let executionStateInfo: React.ReactNode = null;
    if (flowContext.flowState) {
        const componentState =
            flowContext.flowState.getComponentState(actionNode);
        if (componentState.executionState || componentState.asyncState) {
            executionStateInfo = (
                <span className="title-info-execution">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M0 0h24v24H0z" stroke="none" />
                        <path d="M12 6V3M16.25 7.75 18.4 5.6M18 12h3M16.25 16.25l2.15 2.15M12 18v3M7.75 16.25 5.6 18.4M6 12H3M7.75 7.75 5.6 5.6" />
                    </svg>
                </span>
            );
        }
    }

    return (
        <>
            <div className="title-enclosure">
                {seqInputIndex != -1 && (
                    <ComponentInputSpan
                        componentInput={actionNode.inputs[seqInputIndex]}
                        title="Sequence input"
                    />
                )}
                <div
                    className={classNames("title", {
                        "empty-content": emptyContent
                    })}
                    style={titleStyle}
                >
                    <span className="title-image">
                        {getObjectIcon(actionNode)}
                    </span>
                    {executionStateInfo}
                    <span className="title-text">{getLabel(actionNode)}</span>
                </div>
                {seqOutputIndex != -1 && (
                    <ComponentOutputSpan
                        componentOutput={actionNode.outputs[seqOutputIndex]}
                        title="Sequence output"
                    />
                )}
            </div>
            {!emptyContent && (
                <div className="content ">
                    {
                        // inputs
                        inputs.length > 0 && (
                            <div className="inputs">
                                {inputs.map(input => (
                                    <div
                                        className="connection-input-label"
                                        key={input.name}
                                        title={getInputDisplayName(
                                            actionNode,
                                            input,
                                            true
                                        )}
                                    >
                                        <ComponentInputSpan
                                            componentInput={input}
                                        />
                                        {getInputDisplayName(actionNode, input)}
                                    </div>
                                ))}
                            </div>
                        )
                    }

                    {
                        // body
                        body ? (
                            <div
                                className={
                                    /*"eez-flow-editor-capture-pointers"*/ undefined
                                }
                                style={{ width: "100%" }}
                            >
                                {body}
                            </div>
                        ) : null
                    }

                    {
                        // outputs
                        outputs.length > 0 && (
                            <div className="outputs">
                                {outputs.map(output => (
                                    <div
                                        key={output.name}
                                        className={classNames(
                                            "connection-output-label",
                                            {
                                                error: output.name === "@error"
                                            }
                                        )}
                                        title={getOutputDisplayName(
                                            actionNode,
                                            output,
                                            true
                                        )}
                                    >
                                        {getOutputDisplayName(
                                            actionNode,
                                            output
                                        )}
                                        <ComponentOutputSpan
                                            componentOutput={output}
                                        />
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </div>
            )}
        </>
    );
}

////////////////////////////////////////////////////////////////////////////////

export class ActionComponent extends Component {
    static classInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            {
                name: "description",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            }
        ]
    });

    description: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            description: observable
        });
    }

    get autoSize(): AutoSize {
        return "both";
    }

    get absolutePositionPoint() {
        return { x: this.left, y: this.top };
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [];
    }

    getClassName(flowContext: IFlowContext) {
        return "eez-action";
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    override render(flowContext: IFlowContext) {
        return renderActionComponent(this, flowContext);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class NotFoundComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: (widget: Component) => {
            return `${widget.type} [NOT FOUND]`;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 4.970000743865967 8"
            >
                <path d="M2.47 0C1.62 0 .99.26.59.66c-.4.4-.54.9-.59 1.28l1 .13c.04-.25.12-.5.31-.69C1.5 1.19 1.8 1 2.47 1c.66 0 1.02.16 1.22.34.2.18.28.4.28.66 0 .83-.34 1.06-.84 1.5-.5.44-1.16 1.08-1.16 2.25V6h1v-.25c0-.83.31-1.06.81-1.5.5-.44 1.19-1.08 1.19-2.25 0-.48-.17-1.02-.59-1.41C3.95.2 3.31 0 2.47 0zm-.5 7v1h1V7h-1z" />
            </svg>
        ),
        beforeLoadHook(object: NotFoundComponent, jsObject: any) {
            // make sure unknow properties are remembered
            each(jsObject, (value, key) => {
                if (!findPropertyByNameInObject(object, key)) {
                    (object as any)[key] = value;
                }
            });
        },
        componentHeaderColor: "#fc9b9b"
    });

    getInputs(): ComponentInput[] {
        return ProjectEditor.getFlow(this)
            .connectionLines.filter(
                connectionLine => connectionLine.target == this.objID
            )
            .map(connectionLine => ({
                name: connectionLine.input,
                type: "any",
                isSequenceInput: false,
                isOptionalInput: true
            }));
    }

    getOutputs(): ComponentOutput[] {
        return ProjectEditor.getFlow(this)
            .connectionLines.filter(
                connectionLine => connectionLine.source == this.objID
            )
            .map(connectionLine => ({
                name: connectionLine.output,
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: true
            }));
    }

    get autoSize(): AutoSize {
        return this.type.endsWith("ActionComponent") ? "both" : "none";
    }

    override render(flowContext: IFlowContext): JSX.Element {
        return renderActionComponent(this, flowContext);
    }
}

////////////////////////////////////////////////////////////////////////////////

function getProperties(propertyDefinitions: IComponentProperty[]) {
    const properties: PropertyInfo[] = [];

    for (const propertyDefinition of propertyDefinitions) {
        let disabled;
        const propertyDefinitionDisabled = propertyDefinition.disabled;
        if (propertyDefinitionDisabled) {
            disabled = (object: any, propertyInfo: PropertyInfo) =>
                propertyDefinitionDisabled(...(object?._props ?? []));
        }

        let isOptional;
        const optional = propertyDefinition.optional;
        if (optional) {
            isOptional = (object: any, propertyInfo: PropertyInfo) =>
                optional(...(object?._props ?? []));
        }

        if (propertyDefinition.type === "expression") {
            properties.push(
                makeExpressionProperty(
                    {
                        name: propertyDefinition.name,
                        displayName: propertyDefinition.displayName,
                        type: PropertyType.MultilineText,
                        propertyGridGroup: specificGroup,
                        formText: propertyDefinition.formText,
                        disabled,
                        isOptional
                    },
                    propertyDefinition.valueType
                )
            );
        } else if (propertyDefinition.type === "assignable-expression") {
            properties.push(
                makeAssignableExpressionProperty(
                    {
                        name: propertyDefinition.name,
                        displayName: propertyDefinition.displayName,
                        type: PropertyType.MultilineText,
                        propertyGridGroup: specificGroup,
                        formText: propertyDefinition.formText,
                        disabled,
                        isOptional
                    },
                    propertyDefinition.valueType
                )
            );
        } else if (propertyDefinition.type === "template-literal") {
            properties.push(
                makeTemplateLiteralProperty({
                    name: propertyDefinition.name,
                    displayName: propertyDefinition.displayName,
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    formText: propertyDefinition.formText,
                    disabled,
                    isOptional
                })
            );
        } else if (propertyDefinition.type === "enum") {
            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.Enum,
                enumItems: propertyDefinition.enumItems,
                propertyGridGroup: specificGroup,
                formText: propertyDefinition.formText,
                disabled,
                isOptional
            });
        } else if (propertyDefinition.type === "inline-code") {
            const languageToType = {
                JSON: PropertyType.JSON,
                JavaScript: PropertyType.JavaScript,
                CSS: PropertyType.CSS,
                Python: PropertyType.Python,
                "C/C++": PropertyType.CPP
            };

            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: languageToType[propertyDefinition.language],
                propertyGridGroup: specificGroup,
                formText: propertyDefinition.formText,
                disabled,
                isOptional
            });
        } else if (propertyDefinition.type === "list") {
            const listItemProperties = propertyDefinition.properties;
            const classInfoProperties = getProperties(listItemProperties);
            const defaultValue = propertyDefinition.defaults;

            const migrateProperties = propertyDefinition.migrateProperties;

            const listItemClass = class ListItem extends EezObject {
                static classInfo: ClassInfo = {
                    label: () => propertyDefinition.name,
                    properties: classInfoProperties,
                    defaultValue,
                    beforeLoadHook: migrateProperties
                        ? (object: IEezObject, jsObject: any) =>
                              migrateProperties(jsObject)
                        : undefined,

                    check: (item: ListItem, messages: IMessage[]) => {
                        for (const propertyInfo of listItemProperties) {
                            if (propertyInfo.type == "expression") {
                                try {
                                    checkExpression(
                                        getAncestorOfType(
                                            item,
                                            Component.classInfo
                                        ) as Component,
                                        (item as any)[propertyInfo.name]
                                    );
                                } catch (err) {
                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Invalid expression: ${err}`,
                                            getChildOfObject(
                                                item,
                                                propertyInfo.name
                                            )
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.type == "assignable-expression"
                            ) {
                                try {
                                    checkAssignableExpression(
                                        getAncestorOfType(
                                            item,
                                            Component.classInfo
                                        ) as Component,
                                        (item as any)[propertyInfo.name]
                                    );
                                } catch (err) {
                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Invalid assignable expression: ${err}`,
                                            getChildOfObject(item, "variable")
                                        )
                                    );
                                }
                            }
                        }
                    }
                };

                override makeEditable() {
                    super.makeEditable();

                    const observables: any = {};

                    listItemProperties.forEach(propertyInfo => {
                        (this as any)[propertyInfo.name] = undefined;
                        observables[propertyInfo.name] = observable;
                    });

                    makeObservable(this, observables);
                }
            };

            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.Array,
                typeClass: listItemClass,
                propertyGridGroup: specificGroup,
                formText: propertyDefinition.formText,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                disabled,
                isOptional
            });
        } else if (propertyDefinition.type == "boolean") {
            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                formText: propertyDefinition.formText,
                disabled,
                isOptional
            });
        }
    }

    return properties;
}

export function createActionComponentClass(
    actionComponentDefinition: IActionComponentDefinition,
    name?: string,
    componentPaletteGroupName?: string
) {
    const properties = getProperties(actionComponentDefinition.properties);

    const migrateProperties = actionComponentDefinition.migrateProperties;

    const actionComponentClass = class extends ActionComponent {
        static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
            label: () => actionComponentDefinition.name,
            properties,
            defaultValue: actionComponentDefinition.defaults,
            beforeLoadHook: migrateProperties
                ? (object: IEezObject, jsObject: any) =>
                      migrateProperties(jsObject)
                : undefined,
            icon:
                typeof actionComponentDefinition.icon === "string" ? (
                    actionComponentDefinition.icon.startsWith("data:image") ? (
                        <img src={actionComponentDefinition.icon} />
                    ) : (
                        <img
                            src={
                                "data:image/svg+xml;charset=utf-8," +
                                actionComponentDefinition.icon
                            }
                        />
                    )
                ) : (
                    actionComponentDefinition.icon
                ),
            componentHeaderColor:
                actionComponentDefinition.componentHeaderColor,
            componentPaletteGroupName,
            execute: actionComponentDefinition.execute
        });

        override makeEditable() {
            super.makeEditable();

            const observables: any = {};

            actionComponentDefinition.properties.forEach(propertyInfo => {
                (this as any)[propertyInfo.name] = undefined;
                observables[propertyInfo.name] = observable;
            });

            makeObservable(this, observables);
        }

        getInputs(): ComponentInput[] {
            return [
                {
                    name: "@seqin",
                    type: "any",
                    isSequenceInput: true,
                    isOptionalInput: true
                },
                ...actionComponentDefinition.inputs,
                ...super.getInputs()
            ];
        }

        getOutputs(): ComponentOutput[] {
            let outputs: ComponentOutput[];

            if (typeof actionComponentDefinition.outputs == "function") {
                outputs = actionComponentDefinition.outputs(
                    ...(this?._props ?? [])
                );
            } else {
                outputs = actionComponentDefinition.outputs;
            }

            return [
                {
                    name: "@seqout",
                    type: "null",
                    isSequenceOutput: true,
                    isOptionalOutput: true
                },
                ...outputs,
                ...super.getOutputs()
            ];
        }

        get _props() {
            return actionComponentDefinition.properties.map(
                propertyDefinition => (this as any)[propertyDefinition.name]
            );
        }

        getBody(flowContext: IFlowContext): React.ReactNode {
            if (actionComponentDefinition.bodyPropertyName) {
                return (
                    <div className="body">
                        <pre>
                            {
                                (this as any)[
                                    actionComponentDefinition.bodyPropertyName
                                ]
                            }
                        </pre>
                    </div>
                );
            }

            if (actionComponentDefinition.bodyPropertyCallback) {
                const body = actionComponentDefinition.bodyPropertyCallback(
                    ...this._props
                );

                if (typeof body == "string") {
                    return (
                        <div className="body">
                            <pre>{body}</pre>
                        </div>
                    );
                }

                return <div className="body">{body}</div>;
            }

            return null;
        }

        override buildFlowComponentSpecific(
            assets: Assets,
            dataBuffer: DataBuffer
        ) {
            actionComponentDefinition.properties.forEach(propertyDefinition => {
                if (
                    propertyDefinition.type == "enum" ||
                    propertyDefinition.type == "inline-code"
                ) {
                    dataBuffer.writeObjectOffset(() =>
                        dataBuffer.writeString(
                            (this as any)[propertyDefinition.name]
                        )
                    );
                } else if (propertyDefinition.type == "list") {
                    const listItemProperties = propertyDefinition.properties;

                    const items = (this as any)[propertyDefinition.name];

                    dataBuffer.writeArray(items, item => {
                        for (const itemPropertyInfo of listItemProperties) {
                            if (itemPropertyInfo.type == "expression") {
                                dataBuffer.writeObjectOffset(() =>
                                    buildExpression(
                                        assets,
                                        dataBuffer,
                                        this,
                                        (item as any)[itemPropertyInfo.name]
                                    )
                                );
                            } else if (
                                itemPropertyInfo.type == "assignable-expression"
                            ) {
                                dataBuffer.writeObjectOffset(() =>
                                    buildAssignableExpression(
                                        assets,
                                        dataBuffer,
                                        this,
                                        (item as any)[itemPropertyInfo.name]
                                    )
                                );
                            }
                        }
                    });
                } else if (propertyDefinition.type == "boolean") {
                    dataBuffer.writeUint32(
                        (this as any)[propertyDefinition.name] ? 1 : 0
                    );
                }
            });
        }
    };

    return {
        className: name || actionComponentDefinition.name,
        actionComponentClass
    };
}

export function registerActionComponent(
    actionComponentDefinition: IActionComponentDefinition,
    name?: string,
    componentPaletteGroupName?: string
) {
    const { className, actionComponentClass } = createActionComponentClass(
        actionComponentDefinition,
        name,
        componentPaletteGroupName
    );
    registerClass(className, actionComponentClass);
}

export function registerActionComponents(
    componentPaletteGroupName: string,
    actionComponentDefinitions: IActionComponentDefinition[]
) {
    actionComponentDefinitions.forEach(actionComponentDefinition =>
        registerActionComponent(
            actionComponentDefinition,
            undefined,
            componentPaletteGroupName
        )
    );
}

function isActionComponent(component: Component) {
    return component instanceof ActionComponent;
}

function checkProperty(
    projectStore: ProjectStore,
    component: Component,
    messages: IMessage[],
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (isFlowProperty(object, propertyInfo, ["input"])) {
        if (isPropertyHidden(component, propertyInfo)) {
            return;
        }

        const value = getProperty(object, propertyInfo.name);
        if (value != undefined && value !== "") {
            if (projectStore.projectTypeTraits.hasFlowSupport) {
                try {
                    if (propertyInfo.expressionIsConstant === true) {
                        evalConstantExpression(projectStore.project, value);
                    } else {
                        checkExpression(component, value);
                    }
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(object, propertyInfo.name)
                        )
                    );
                }
            } else {
                if (!findVariable(projectStore.project, value)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Variable "${value}" not found`,
                            getChildOfObject(component, propertyInfo.name)
                        )
                    );
                }
            }
        } else if (
            !isPropertyOptional(object, propertyInfo) &&
            !(object instanceof ProjectEditor.WidgetClass) &&
            !isPropertyHidden(object, propertyInfo)
        ) {
            messages.push(propertyNotSetMessage(object, propertyInfo.name));
        }
    } else if (isFlowProperty(object, propertyInfo, ["assignable"])) {
        if (isPropertyHidden(component, propertyInfo)) {
            return;
        }

        const value = getProperty(object, propertyInfo.name);
        if (value != undefined && value !== "") {
            if (projectStore.projectTypeTraits.hasFlowSupport) {
                try {
                    checkAssignableExpression(component, value);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid assignable expression: ${err}`,
                            getChildOfObject(object, propertyInfo.name)
                        )
                    );
                }
            } else {
                if (!findVariable(projectStore.project, value)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Variable "${value}" not found`,
                            getChildOfObject(component, propertyInfo.name)
                        )
                    );
                }
            }
        } else if (
            !isPropertyOptional(object, propertyInfo) &&
            !(object instanceof ProjectEditor.WidgetClass) &&
            !isPropertyHidden(object, propertyInfo)
        ) {
            messages.push(propertyNotSetMessage(object, propertyInfo.name));
        }
    } else if (isFlowProperty(object, propertyInfo, ["template-literal"])) {
        if (isPropertyHidden(component, propertyInfo)) {
            return;
        }

        const value = getProperty(object, propertyInfo.name);
        if (value != undefined && value !== "") {
            try {
                checkTemplateLiteralExpression(component, value);
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid template literal: ${err}`,
                        getChildOfObject(object, propertyInfo.name)
                    )
                );
            }
        } else if (
            !isPropertyOptional(object, propertyInfo) &&
            !(object instanceof ProjectEditor.WidgetClass) &&
            !isPropertyHidden(object, propertyInfo)
        ) {
            messages.push(propertyNotSetMessage(object, propertyInfo.name));
        }
    }
}
