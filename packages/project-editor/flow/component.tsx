import { MenuItem } from "@electron/remote";
import React from "react";
import { observable, computed, makeObservable } from "mobx";
import classNames from "classnames";

import { _each, _find, _range } from "eez-studio-shared/algorithm";
import { validators } from "eez-studio-shared/validation";
import { BoundingRectBuilder, Point, Rect } from "eez-studio-shared/geometry";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

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
    findPropertyByNameInClassInfo,
    PropertyProps,
    isPropertyHidden,
    getProperty,
    MessageType,
    registerClass,
    FlowPropertyType,
    setParent,
    IMessage
} from "project-editor/core/object";
import {
    getChildOfObject,
    isArray,
    getClassInfo,
    getLabel,
    findPropertyByNameInObject,
    getAncestorOfType,
    Message,
    propertyNotSetMessage,
    updateObject,
    createObject,
    ProjectStore
} from "project-editor/store";
import {
    isLVGLProject,
    isNotProjectWithFlowSupport
} from "project-editor/project/project-type-traits";
import { objectToJS } from "project-editor/store";
import { IContextMenuContext, getProjectStore } from "project-editor/store";

import type {
    IResizeHandler,
    IFlowContext,
    IFlowState
} from "project-editor/flow/flow-interfaces";
import {
    calcComponentGeometry,
    ComponentGeometry
} from "project-editor/flow/editor/render";
import {
    IResizing,
    ResizingProperty
} from "project-editor/flow/editor/resizing-widget-property";

import type { Page } from "project-editor/features/page/page";
import { Style } from "project-editor/features/style/style";
import type {
    ContainerWidget,
    UserWidgetWidget,
    ListWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";
import { WIDGET_TYPE_NONE } from "project-editor/flow/components/component_types";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import {
    buildAssignableExpression,
    buildExpression,
    checkAssignableExpression,
    checkExpression,
    checkTemplateLiteralExpression,
    evalConstantExpression,
    parseIdentifier,
    templateLiteralToExpression
} from "project-editor/flow/expression";
import {
    variableTypeProperty,
    ValueType,
    VariableTypeFieldComponent,
    ACTION_PARAMS_STRUCT_NAME,
    isValidType
} from "project-editor/features/variable/value-type";
import { expressionBuilder } from "./expression/ExpressionBuilder";
import { getComponentName } from "./editor/ComponentsPalette";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import type {
    IActionComponentDefinition,
    IComponentFlowState,
    IComponentProperty,
    LogItemType
} from "eez-studio-types";
import {
    flowGroup,
    generalGroup,
    geometryGroup,
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
    getTimelineProperty,
    getTimelineRect,
    isTimelineEditorActive,
    TimelineKeyframe,
    TimelineKeyframeProperty,
    TimelineKeyframePropertyUI,
    timelineStyleHook
} from "project-editor/flow/timeline";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";

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
    hideInPropertyGrid: isLVGLProject
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

export function makeActionPropertyInfo(
    name: string,
    props?: Partial<PropertyInfo>
): PropertyInfo {
    return Object.assign(
        makeToggablePropertyToOutput({
            name,
            type: PropertyType.ObjectReference,
            referencedObjectCollectionPath: "actions",
            propertyGridGroup: specificGroup
        }),
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
            propertyGridCollapsableDefaultPropertyName: "inheritFrom",
            enumerable: false
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

export function migrateStyleProperty(
    jsObject: any,
    propertyName: string,
    propertyName2?: string
) {
    if (jsObject[propertyName] === undefined) {
        jsObject[propertyName] = propertyName2
            ? jsObject[propertyName2]
            : {
                  inheritFrom: "default"
              };
    } else if (typeof jsObject[propertyName] === "string") {
        jsObject[propertyName] = {
            inheritFrom: jsObject[propertyName]
        };
    } else if (!jsObject[propertyName].inheritFrom) {
        jsObject[propertyName].inheritFrom = "default";
    }
}

function getClassFromType(type: string) {
    if (type.startsWith("Local.")) {
        return findClass("UserWidgetWidget");
    }

    if (type == "OverrideStyle") {
        type = "OverrideStyleActionComponent";
    }

    let componentClass;

    componentClass = findClass(type + "Widget");
    if (componentClass) {
        return componentClass;
    }

    componentClass = findClass(type);
    if (componentClass) {
        return componentClass;
    }

    if (type.endsWith("ActionComponent")) {
        componentClass = findClass(
            type.substring(0, type.length - "ActionComponent".length)
        );

        if (componentClass) {
            return componentClass;
        }
    }

    console.log(type);

    return NotFoundComponent;
}

function getComponentClass(jsObject: any) {
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
    return getClassFromType(jsObject.type);
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
            propertyMenu(props: PropertyProps) {
                let menuItems: Electron.MenuItem[] = [];

                if (props.objects.length == 1) {
                    const component = props.objects[0] as Component;

                    if (
                        !getProperty(component, props.propertyInfo.name) &&
                        !component.customInputs.find(
                            componentInput =>
                                componentInput.name == props.propertyInfo.name
                        )
                    ) {
                        menuItems.push(
                            new MenuItem({
                                label: "Convert to input",
                                click: () => {
                                    const projectStore = getProjectStore(
                                        props.objects[0]
                                    );

                                    projectStore.undoManager.setCombineCommands(
                                        true
                                    );

                                    const customInput =
                                        createObject<CustomInput>(
                                            projectStore,
                                            {
                                                name: props.propertyInfo.name,
                                                type:
                                                    props.propertyInfo
                                                        .expressionType || "any"
                                            },
                                            CustomInput
                                        );

                                    projectStore.addObject(
                                        component.customInputs,
                                        customInput
                                    );

                                    projectStore.updateObject(component, {
                                        [props.propertyInfo.name]:
                                            customInput.name
                                    });

                                    projectStore.undoManager.setCombineCommands(
                                        false
                                    );
                                }
                            })
                        );
                    }
                }

                return menuItems;
            },
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

export function makeToggablePropertyToOutput(
    propertyInfo: PropertyInfo
): PropertyInfo {
    return Object.assign(propertyInfo, {
        flowProperty: "output",
        propertyMenu(props: PropertyProps) {
            let menuItems: Electron.MenuItem[] = [];

            if (props.objects.length == 1) {
                const component = props.objects[0] as Component;

                let asOutputProperties = (
                    component.asOutputProperties ?? []
                ).slice();
                const i = asOutputProperties.indexOf(props.propertyInfo.name);

                menuItems.push(
                    new MenuItem({
                        label:
                            i === -1
                                ? "Convert to output"
                                : "Convert to property",
                        click: () => {
                            const projectStore = getProjectStore(
                                props.objects[0]
                            );

                            projectStore.undoManager.setCombineCommands(true);

                            if (i === -1) {
                                asOutputProperties.push(
                                    props.propertyInfo.name
                                );
                            } else {
                                asOutputProperties.splice(i, 1);

                                ProjectEditor.getFlow(
                                    component
                                ).deleteConnectionLinesFromOutput(
                                    component,
                                    props.propertyInfo.name
                                );
                            }

                            asOutputProperties.sort();

                            projectStore.updateObject(component, {
                                asOutputProperties,
                                [props.propertyInfo.name]: undefined
                            });

                            projectStore.undoManager.setCombineCommands(false);
                        }
                    })
                );
            }

            return menuItems;
        },
        readOnlyInPropertyGrid(
            component: Component,
            propertyInfo: PropertyInfo
        ) {
            return (
                (component.asOutputProperties ?? []).indexOf(
                    propertyInfo.name
                ) !== -1
            );
        }
    } as Partial<PropertyInfo>);
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
    if (isArray(parent)) {
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

    constructor() {
        super();

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

    constructor() {
        super();

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
        if (uiStateStore.isBreakpointAddedForComponent(component)) {
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
                <div className="EezStudio_ActionGroups">
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

            Widget.classInfo.setRect!(this.widget, {
                left
            });
        };

        onCenterVertically = () => {
            const parentRect = this.parent.rect;
            const rect = this.widget.rect;

            const top = Math.round((parentRect.height - rect.height) / 2);

            Widget.classInfo.setRect!(this.widget, {
                top
            });
        };

        render() {
            return (
                <div>
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

export type AutoSize = "width" | "height" | "both" | "none";

export class Component extends EezObject {
    type: string;

    left: number;
    top: number;
    width: number;
    height: number;

    customInputs: CustomInput[];
    customOutputs: CustomOutput[];

    asOutputProperties: string[];

    _geometry: ComponentGeometry;

    catchError: boolean;

    constructor() {
        super();

        makeObservable(this, {
            type: observable,
            left: observable,
            top: observable,
            width: observable,
            height: observable,
            customInputs: observable,
            customOutputs: observable,
            asOutputProperties: observable,
            _geometry: observable,
            catchError: observable,
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

    static classInfo: ClassInfo = {
        getClass: function (jsObject: any) {
            return getComponentClass(jsObject);
        },

        label: getComponentLabel,

        listLabel: (component: Component) => {
            const label = getComponentLabel(component);
            const classInfo = getClassInfo(component);
            return (
                <>
                    {classInfo.icon && (
                        <Icon
                            icon={classInfo.icon as any}
                            style={{
                                opacity: 0.66,
                                marginRight: 5,
                                width: 18,
                                height: 18
                            }}
                        />
                    )}
                    {label}
                </>
            );
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                hideInPropertyGrid: true
            },
            {
                name: "alignAndDistribute",
                type: PropertyType.Any,
                propertyGridGroup: geometryGroup,
                computed: true,
                propertyGridRowComponent: AlignAndDistributePropertyGridUI,
                hideInPropertyGrid: (widget: Widget) => {
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
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isActionComponent
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isActionComponent
            },
            {
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true,
                hideInPropertyGrid: isActionComponent
            },
            {
                name: "centerWidgetUI",
                type: PropertyType.Any,
                propertyGridGroup: geometryGroup,
                computed: true,
                propertyGridRowComponent: CenterWidgetUI,
                hideInPropertyGrid: (widget: Widget) => {
                    const projectStore = ProjectEditor.getProjectStore(widget);
                    const propertyGridObjects =
                        projectStore.navigationStore.propertyGridObjects;
                    return !(
                        propertyGridObjects.length == 1 &&
                        propertyGridObjects[0] instanceof Widget
                    );
                }
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
                hideInPropertyGrid: isNotProjectWithFlowSupport
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
                hideInPropertyGrid: isNotProjectWithFlowSupport
            },
            {
                name: "catchError",
                type: PropertyType.Boolean,
                propertyGridGroup: flowGroup,
                hideInPropertyGrid: isNotProjectWithFlowSupport
            },
            {
                name: "asOutputProperties",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
                defaultValue: []
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

            if (projectStore.projectTypeTraits.hasFlowSupport) {
                // check properties
                for (const propertyInfo of getClassInfo(component).properties) {
                    if (isPropertyHidden(component, propertyInfo)) {
                        continue;
                    }

                    if (isFlowProperty(component, propertyInfo, ["input"])) {
                        const value = getProperty(component, propertyInfo.name);
                        if (value != undefined && value !== "") {
                            try {
                                if (
                                    propertyInfo.expressionIsConstant === true
                                ) {
                                    evalConstantExpression(
                                        projectStore.project,
                                        value
                                    );
                                } else {
                                    checkExpression(component, value);
                                }
                            } catch (err) {
                                messages.push(
                                    new Message(
                                        MessageType.ERROR,
                                        `Invalid expression: ${err}`,
                                        getChildOfObject(
                                            component,
                                            propertyInfo.name
                                        )
                                    )
                                );
                            }
                        } else if (
                            !(component instanceof ProjectEditor.WidgetClass) &&
                            !isPropertyHidden(component, propertyInfo)
                        ) {
                            messages.push(
                                propertyNotSetMessage(
                                    component,
                                    propertyInfo.name
                                )
                            );
                        }
                    } else if (
                        isFlowProperty(component, propertyInfo, ["assignable"])
                    ) {
                        const value = getProperty(component, propertyInfo.name);
                        if (value != undefined && value !== "") {
                            try {
                                checkAssignableExpression(component, value);
                            } catch (err) {
                                messages.push(
                                    new Message(
                                        MessageType.ERROR,
                                        `Invalid assignable expression: ${err}`,
                                        getChildOfObject(
                                            component,
                                            propertyInfo.name
                                        )
                                    )
                                );
                            }
                        } else if (
                            !(component instanceof ProjectEditor.WidgetClass) &&
                            !isPropertyHidden(component, propertyInfo)
                        ) {
                            messages.push(
                                propertyNotSetMessage(
                                    component,
                                    propertyInfo.name
                                )
                            );
                        }
                    } else if (
                        isFlowProperty(component, propertyInfo, [
                            "template-literal"
                        ])
                    ) {
                        const value = getProperty(component, propertyInfo.name);
                        if (value != undefined && value !== "") {
                            try {
                                checkTemplateLiteralExpression(
                                    component,
                                    value
                                );
                            } catch (err) {
                                messages.push(
                                    new Message(
                                        MessageType.ERROR,
                                        `Invalid template literal: ${err}`,
                                        getChildOfObject(
                                            component,
                                            propertyInfo.name
                                        )
                                    )
                                );
                            }
                        } else if (
                            !(component instanceof ProjectEditor.WidgetClass) &&
                            !isPropertyHidden(component, propertyInfo)
                        ) {
                            messages.push(
                                propertyNotSetMessage(
                                    component,
                                    propertyInfo.name
                                )
                            );
                        }
                    }
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

    isOutputProperty(property: PropertyInfo | string) {
        if (!this.asOutputProperties) {
            return false;
        }

        return (
            this.asOutputProperties.indexOf(
                typeof property === "string" ? property : property.name
            ) !== -1
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
        const asOutputs: ComponentOutput[] = (
            (this.asOutputProperties ?? [])
                .map(outputPropertyName =>
                    findPropertyByNameInClassInfo(
                        getClassInfo(this),
                        outputPropertyName
                    )
                )
                .filter(
                    propertyInfo =>
                        propertyInfo && !isPropertyHidden(this, propertyInfo)
                ) as PropertyInfo[]
        ).map(propertyInfo => ({
            name: propertyInfo.name,
            type: propertyInfo.expressionType ?? "any",
            isOptionalOutput: false,
            isSequenceOutput: false
        }));

        const outputs: ComponentOutput[] = [
            ...(this.customOutputs ?? []),
            ...asOutputs
        ];

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

        for (const propertyInfo of getClassInfo(this).properties) {
            if (isFlowProperty(this, propertyInfo, ["output"])) {
                outputs.push({
                    name: propertyInfo.name,
                    type:
                        !this.asOutputProperties ||
                        this.asOutputProperties.indexOf(propertyInfo.name) == -1
                            ? "property"
                            : "output",
                    valueType: propertyInfo.expressionType!
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

    getClassName() {
        return "";
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        // if (!flowContext.projectStore.projectTypeTraits.isDashboard) {
        //     const backgroundColor = this.style.backgroundColorProperty;
        //     style.backgroundColor = to16bitsColor(backgroundColor);
        // }
    }

    onWasmWorkerMessage(
        flowState: IFlowState,
        message: any,
        messageId: number
    ) {}

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

export class Widget extends Component {
    data?: string;
    visible?: string;
    action?: string;
    resizing: IResizing;
    style: Style;

    allowOutside: boolean;

    locked: boolean;
    hiddenInEditor: boolean;

    timeline: TimelineKeyframe[];

    static classInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            resizingProperty,
            makeDataPropertyInfo("data", { hideInPropertyGrid: isLVGLProject }),
            makeDataPropertyInfo("visible", {
                hideInPropertyGrid: isLVGLProject
            }),
            makeActionPropertyInfo("action", {
                expressionType: `struct:${ACTION_PARAMS_STRUCT_NAME}`,
                hideInPropertyGrid: isLVGLProject
            }),
            makeStylePropertyInfo("style", "Normal style", {
                hideInPropertyGrid: isLVGLProject
            }),
            {
                name: "allowOutside",
                displayName: `Hide "Widget is outside of its parent" warning`,
                type: PropertyType.Boolean,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isLVGLProject
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
                type: PropertyType.Any,
                propertyGridGroup: timelineGroup,
                propertyGridRowComponent: TimelineKeyframePropertyUI,
                computed: true,
                hideInPropertyGrid: (widget: Widget) =>
                    !isTimelineEditorActive(widget)
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
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
                    inheritFrom: jsObject.className
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

            if (additionalMenuItems.length > 0) {
                additionalMenuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );

                menuItems.unshift(...additionalMenuItems);
            }
        },

        check: (object: Component, messages: IMessage[]) => {
            if (
                object instanceof Widget &&
                !(object instanceof ProjectEditor.LVGLWidgetClass) &&
                !object.allowOutside
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
                    getWidgetParent(object).width
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
                    getWidgetParent(object).height
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

            const projectStore = getProjectStore(object);

            if (!projectStore.projectTypeTraits.hasFlowSupport) {
                ProjectEditor.documentSearch.checkObjectReference(
                    object,
                    "data",
                    messages
                );
            }

            ProjectEditor.documentSearch.checkObjectReference(
                object,
                "action",
                messages
            );
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
            return !widget.locked && !getTimelineEditorState(widget);
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            data: observable,
            visible: observable,
            action: observable,
            resizing: observable,
            style: observable,
            allowOutside: observable,
            styleObject: computed,
            locked: observable,
            hiddenInEditor: observable,
            timeline: observable
        });
    }

    get styleObject() {
        return this.style;
    }

    putInSelect() {
        const projectStore = getProjectStore(this);

        var selectWidgetProperties: Partial<SelectWidget> = Object.assign(
            {},
            getClassFromType("Select")?.classInfo.defaultValue,
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
            getClassFromType("Container")?.classInfo.defaultValue,
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

        let containerWidget: ContainerWidget;
        if (
            fromWidgets.length == 1 &&
            (fromWidgets[0].type == "Container" ||
                fromWidgets[0].type == "ContainerWidget")
        ) {
            containerWidget = fromWidgets[0] as ContainerWidget;
        } else {
            var containerWidgetJsObjectProperties: Partial<ContainerWidget> =
                Object.assign(
                    {},
                    getClassFromType("Container")?.classInfo.defaultValue,
                    { type: "Container" }
                );

            containerWidget = createObject<ContainerWidget>(
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
        }

        var listWidgetJsObjectProperties: Partial<ListWidget> = Object.assign(
            {},
            getClassFromType("List")?.classInfo.defaultValue,
            { type: "List" }
        );
        const listWidget = createObject<ListWidget>(
            projectStore,
            listWidgetJsObjectProperties,
            ProjectEditor.ListWidgetClass
        );

        listWidget.itemWidget = containerWidget;
        setParent(containerWidget, listWidget);

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
        const customWidgets = projectStore.project.pages;

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
                                validators.unique({}, customWidgets)
                            ]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const userWidgetPageName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            projectStore.addObject(
                customWidgets,
                createObject<Page>(
                    projectStore,
                    {
                        name: userWidgetPageName,
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

    getClassName() {
        return classNames(
            "eez-widget-component",
            this.type,
            this.style.classNames
        );
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        if (this.timeline.length > 0) {
            timelineStyleHook(this, style, flowContext);
        }
    }

    render(
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
                            title={getInputDisplayName(this, input)}
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
                            title={getOutputDisplayName(this, output)}
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

    getTimelineProperty(
        timelinePosition: number,
        propertyName: TimelineKeyframeProperty
    ) {
        return getTimelineProperty(this, timelinePosition, propertyName);
    }

    lvglCreate(runtime: LVGLPageRuntime, parentObj: number) {
        return 0;
    }

    lvglPostCreate(runtime: LVGLPageRuntime) {}
}

////////////////////////////////////////////////////////////////////////////////

function ComponentInputSpan({
    componentInput
}: {
    componentInput: ComponentInput;
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
        ></span>
    );
}

function ComponentOutputSpan({
    componentOutput
}: {
    componentOutput: ComponentOutput;
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
    let errorOutputIndex = -1;
    let seqOutputIndex = -1;
    let i;
    for (i = 0; i < actionNode.outputs.length; i++) {
        const output = actionNode.outputs[i];
        if (output.name === "@error") {
            errorOutputIndex = i;
        } else if (output.isSequenceOutput && output.name == "@seqout") {
            if (seqOutputIndex === -1) {
                seqOutputIndex = i;
            } else {
                seqOutputIndex = -1;
                break;
            }
        }
    }
    for (; i < actionNode.outputs.length; i++) {
        const output = actionNode.outputs[i];
        if (output.name === "@error") {
            errorOutputIndex = i;
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

    // move @error output to end
    if (errorOutputIndex !== -1) {
        outputs = [
            ...outputs.slice(0, errorOutputIndex),
            ...outputs.slice(errorOutputIndex + 1),
            outputs[errorOutputIndex]
        ];
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
        if (componentState.runningState || componentState.asyncState) {
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
                    />
                )}
                <div
                    className={classNames("title", {
                        "empty-content": emptyContent
                    })}
                    style={titleStyle}
                >
                    <span className="title-image">{classInfo.icon}</span>
                    {executionStateInfo}
                    <span className="title-text">{getLabel(actionNode)}</span>
                </div>
                {seqOutputIndex != -1 && (
                    <ComponentOutputSpan
                        componentOutput={actionNode.outputs[seqOutputIndex]}
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
                                className="eez-flow-editor-capture-pointers"
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

    constructor() {
        super();

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

    getClassName() {
        return "eez-action-component";
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    render(flowContext: IFlowContext) {
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
            _each(jsObject, (value, key) => {
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

    render(flowContext: IFlowContext): JSX.Element {
        return renderActionComponent(this, flowContext);
    }
}

////////////////////////////////////////////////////////////////////////////////

function getComponentFlowState(
    flowState: IFlowState,
    component: Component,
    dispose?: () => void
): IComponentFlowState {
    return {
        getComponentRunningState: () =>
            flowState.getComponentRunningState(component),

        setComponentRunningState: runningState =>
            flowState.setComponentRunningState(component, runningState),

        evalExpression: (expression: string) =>
            flowState.evalExpression(component, expression),

        evalTemplateLiteral: (templateLiteral: string) =>
            flowState.evalExpression(
                component,
                templateLiteralToExpression(templateLiteral)
            ),

        assignValue: (assignableExpression: string, value: any) =>
            flowState.runtime.assignValue(
                flowState,
                component,
                assignableExpression,
                value
            ),

        propagateValue: (output: string, value: any) =>
            flowState.runtime.propagateValue(
                flowState,
                component,
                output,
                value
            ),

        sendResultToWorker: (
            messageId: number,
            result: any,
            finalResult?: boolean
        ) => {
            flowState.runtime.sendResultToWorker(
                messageId,
                result,
                finalResult
            );
        },

        throwError: (message: string) =>
            flowState.runtime.throwError(flowState, component, message),

        log: (type: LogItemType, message: string) =>
            flowState.log(type, message, component),

        dispose
    };
}

function getProperties(propertyDefinitions: IComponentProperty[]) {
    const properties: PropertyInfo[] = [];

    for (const propertyDefinition of propertyDefinitions) {
        let hideInPropertyGrid;

        const enabled = propertyDefinition.enabled;
        if (enabled) {
            hideInPropertyGrid = (object: any, propertyInfo: PropertyInfo) =>
                enabled(...(object?._props ?? []));
        }

        if (propertyDefinition.type === "expression") {
            properties.push(
                makeExpressionProperty(
                    {
                        name: propertyDefinition.name,
                        displayName: propertyDefinition.displayName,
                        type: PropertyType.MultilineText,
                        propertyGridGroup: specificGroup,
                        hideInPropertyGrid
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
                        hideInPropertyGrid
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
                    hideInPropertyGrid
                })
            );
        } else if (propertyDefinition.type === "enum") {
            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.Enum,
                enumItems: propertyDefinition.enumItems,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid
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
                hideInPropertyGrid
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

                constructor() {
                    super();

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
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                hideInPropertyGrid
            });
        } else if (propertyDefinition.type == "boolean") {
            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid
            });
        }
    }

    return properties;
}

export function registerActionComponent(
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

        constructor() {
            super();

            const observables: any = {};

            actionComponentDefinition.properties.forEach(propertyInfo => {
                (this as any)[propertyInfo.name] = undefined;
                observables[propertyInfo.name] = observable;
            });

            makeObservable(this, observables);
        }

        getInputs(): ComponentInput[] {
            return [
                ...super.getInputs(),
                {
                    name: "@seqin",
                    type: "any",
                    isSequenceInput: true,
                    isOptionalInput: true
                },
                ...actionComponentDefinition.inputs
            ];
        }

        getOutputs(): ComponentOutput[] {
            return [
                ...super.getOutputs(),
                {
                    name: "@seqout",
                    type: "null",
                    isSequenceOutput: true,
                    isOptionalOutput: true
                },
                ...actionComponentDefinition.outputs
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

        override onWasmWorkerMessage(
            flowState: IFlowState,
            message: any,
            messageId: number
        ): void {
            if (actionComponentDefinition.onWasmWorkerMessage) {
                actionComponentDefinition.onWasmWorkerMessage(
                    getComponentFlowState(flowState, this),
                    message,
                    messageId
                );
            }
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

    registerClass(name || actionComponentDefinition.name, actionComponentClass);
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
