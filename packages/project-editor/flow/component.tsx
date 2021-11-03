import React from "react";
import { observable, computed, decorate } from "mobx";

import { _each, _find, _range } from "eez-studio-shared/algorithm";
import { validators } from "eez-studio-shared/validation";
import { Rect } from "eez-studio-shared/geometry";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    PropertyInfo,
    PropertyType,
    findClass,
    geometryGroup,
    styleGroup,
    specificGroup,
    IPropertyGridGroupDefinition,
    areAllChildrenOfTheSameParent,
    IOnSelectParams,
    getParent,
    makeDerivedClassInfo,
    findPropertyByNameInClassInfo,
    PropertyProps,
    isPropertyHidden,
    getProperty,
    flowGroup,
    MessageType,
    registerClass
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
    hideInPropertyGridIfDashboard,
    hideInPropertyGridIfNotDashboard
} from "project-editor/core/store";
import { loadObject, objectToJS } from "project-editor/core/store";
import {
    IContextMenuContext,
    getDocumentStore,
    DocumentStoreClass
} from "project-editor/core/store";

import type {
    IResizeHandler,
    IFlowContext,
    IFlowState
} from "project-editor/flow/flow-interfaces";
import { ComponentGeometry } from "project-editor/flow/editor/render";
import {
    IResizing,
    resizingProperty
} from "project-editor/flow/editor/resizing-widget-property";

import { onSelectItem } from "project-editor/components/SelectItem";

import type { Page } from "project-editor/features/page/page";
import { Style } from "project-editor/features/style/style";
import type {
    ContainerWidget,
    ListWidget
} from "project-editor/flow/components/widgets";
import { WIDGET_TYPE_NONE } from "project-editor/flow/components/widgets/widget_types";
import { guid } from "eez-studio-shared/guid";
import classNames from "classnames";
import type {
    Assets,
    DataBuffer
} from "project-editor/features/page/build/assets";
import {
    checkAssignableExpression,
    checkExpression,
    evalConstantExpression,
    parseIdentifier
} from "project-editor/flow/expression/expression";
import {
    variableTypeProperty,
    ValueType,
    VariableTypeFieldComponent
} from "project-editor/features/variable/value-type";
import { expressionBuilder } from "./expression/ExpressionBuilder";
import { getComponentName } from "./editor/ComponentsPalette";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import type { IActionComponentDefinition, LogItemType } from "eez-studio-types";

const { MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    props?: Partial<PropertyInfo>
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
                    const DocumentStore = getDocumentStore(object);
                    if (
                        DocumentStore.project.isAppletProject ||
                        DocumentStore.project.isDashboardProject
                    ) {
                        return expressionBuilder(
                            object,
                            propertyInfo,
                            {
                                assignableExpression: false,
                                title: "Expression Builder",
                                width: 400,
                                height: 600
                            },
                            params
                        );
                    } else {
                        return onSelectItem(object, propertyInfo, {
                            title: "Select Data",
                            width: 800
                        });
                    }
                }
            },
            "any"
        ),
        props
    );
}

export function makeActionPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return makeToggablePropertyToOutput({
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: "actions",
        propertyGridGroup: propertyGridGroup || specificGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
            onSelectItem(object, propertyInfo, {
                title: propertyInfo.onSelectTitle!,
                width: 800
            }),
        onSelectTitle: "Select Action"
    });
}

export function makeStylePropertyInfo(
    name: string,
    displayName?: string
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.Object,
        typeClass: Style,
        propertyGridGroup: styleGroup,
        propertyGridCollapsable: true,
        propertyGridCollapsableDefaultPropertyName: "inheritFrom",
        enumerable: false,
        hideInPropertyGrid: hideInPropertyGridIfDashboard
    };
}

export function makeTextPropertyInfo(
    name: string,
    props?: Partial<PropertyInfo>
): PropertyInfo {
    return Object.assign(
        {
            name,
            type: PropertyType.String,
            propertyGridGroup: specificGroup,
            onSelect: async (
                object: IEezObject,
                propertyInfo: PropertyInfo,
                params?: IOnSelectParams
            ) => {
                if (ProjectEditor.getProject(object).isDashboardProject) {
                    return undefined;
                }

                return await onSelectItem(
                    object,
                    propertyInfo,
                    {
                        title: propertyInfo.onSelectTitle!,
                        width: 800
                    },
                    params
                );
            },
            onSelectTitle: "Select Glyph"
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
        return findClass("LayoutViewWidget");
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
                                    const DocumentStore = getDocumentStore(
                                        props.objects[0]
                                    );

                                    DocumentStore.undoManager.setCombineCommands(
                                        true
                                    );

                                    const customInput = new CustomInput();
                                    customInput.name = props.propertyInfo.name;
                                    customInput.type =
                                        props.propertyInfo.expressionType ||
                                        "any";

                                    DocumentStore.addObject(
                                        component.customInputs,
                                        customInput
                                    );

                                    DocumentStore.updateObject(component, {
                                        [props.propertyInfo.name]:
                                            props.propertyInfo.name
                                    });

                                    DocumentStore.undoManager.setCombineCommands(
                                        false
                                    );
                                }
                            })
                        );
                    }
                }

                return menuItems;
            },

            onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
                expressionBuilder(object, propertyInfo, {
                    assignableExpression: false,
                    title: "Expression Builder",
                    width: 400,
                    height: 600
                }),

            monospaceFont: true
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
            onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
                expressionBuilder(object, propertyInfo, {
                    assignableExpression: true,
                    title: propertyInfo.onSelectTitle!,
                    width: 400,
                    height: 600
                }),
            onSelectTitle: "Expression Builder"
        } as Partial<PropertyInfo>,
        propertyInfo
    );
}

export function makeToggablePropertyToOutput(
    propertyInfo: PropertyInfo
): PropertyInfo {
    return Object.assign(propertyInfo, {
        flowProperty: "output",
        expressionType: "null",
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
                            const DocumentStore = getDocumentStore(
                                props.objects[0]
                            );

                            DocumentStore.undoManager.setCombineCommands(true);

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

                            DocumentStore.updateObject(component, {
                                asOutputProperties,
                                [props.propertyInfo.name]: undefined
                            });

                            DocumentStore.undoManager.setCombineCommands(false);
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
    DocumentStore: DocumentStoreClass,
    propertyInfo: PropertyInfo,
    flowPropertyType: "input" | "output" | "assignable"
) {
    if (!propertyInfo.flowProperty) {
        return false;
    }

    if (typeof propertyInfo.flowProperty === "string") {
        if (
            flowPropertyType == "input" &&
            propertyInfo.type == PropertyType.ObjectReference &&
            propertyInfo.referencedObjectCollectionPath == "actions"
        ) {
            return false;
        }
        return propertyInfo.flowProperty === flowPropertyType;
    }

    return propertyInfo.flowProperty(DocumentStore) === flowPropertyType;
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
    @observable name: string;
    @observable type: ValueType;
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

        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Component Input",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                componentInputUnique({}, parent)
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
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    type: result.values.type
                });
            });
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
    @observable name: string;
    @observable type: ValueType;
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

        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Component Output",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                componentOutputUnique({}, parent),
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
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    type: result.values.type
                });
            });
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

export function getInputDisplayName(
    component: Component | undefined,
    componentInput: ComponentInput | string
): string {
    if (typeof componentInput == "string") {
        if (componentInput == "@seqin") {
            return "seqin";
        }
        if (component) {
            const input = component.inputs.find(
                input => input.name == componentInput
            );
            if (input) {
                return getInputDisplayName(component, input);
            }
        }
        return componentInput;
    } else if (componentInput.displayName) {
        if (typeof componentInput.displayName === "string") {
            return componentInput.displayName;
        }
        if (component) {
            return componentInput.displayName(component, componentInput);
        }
    }
    if (componentInput.name == "@seqin") {
        return "seqin";
    }
    return componentInput.name;
}

export function getOutputDisplayName(
    component: Component | undefined,
    componentOutput: ComponentOutput | string
): string {
    if (typeof componentOutput == "string") {
        if (componentOutput == "@seqout") {
            return "seqout";
        }
        if (component) {
            const output = component.outputs.find(
                output => output.name == componentOutput
            );
            if (output) {
                return getOutputDisplayName(component, output);
            }
        }
        return componentOutput;
    } else if (componentOutput.displayName) {
        if (typeof componentOutput.displayName === "string") {
            return componentOutput.displayName;
        }
        if (component) {
            return componentOutput.displayName(component, componentOutput);
        }
    }
    if (componentOutput.name == "@seqout") {
        return "seqout";
    }
    return componentOutput.name;
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

    const DocumentStore = getDocumentStore(component);

    const uiStateStore = DocumentStore.uiStateStore;

    if (
        DocumentStore.project.isAppletProject ||
        DocumentStore.project.isDashboardProject
    ) {
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

    if (additionalMenuItems.length > 0) {
        additionalMenuItems.push(
            new MenuItem({
                type: "separator"
            })
        );

        menuItems.unshift(...additionalMenuItems);
    }
}

////////////////////////////////////////////////////////////////////////////////

export type AutoSize = "width" | "height" | "both" | "none";

export class Component extends EezObject {
    @observable type: string;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    @observable wireID: string;

    @observable customInputs: CustomInput[];
    @observable customOutputs: CustomOutput[];

    @observable asOutputProperties: string[];

    @observable _geometry: ComponentGeometry;

    @observable catchError: boolean;

    get autoSize(): AutoSize {
        return "none";
    }

    static classInfo: ClassInfo = {
        getClass: function (jsObject: any) {
            return getComponentClass(jsObject);
        },

        label: (component: Component) => {
            let name = getComponentName(component.type);

            if (component instanceof Widget && component.data) {
                return `${name}: ${component.data}`;
            }

            return name;
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                hideInPropertyGrid: true
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
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true
            },
            {
                name: "wireID",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "customInputs",
                displayName: "Inputs",
                type: PropertyType.Array,
                typeClass: CustomInput,
                propertyGridGroup: flowGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            {
                name: "customOutputs",
                displayName: "Outputs",
                type: PropertyType.Array,
                typeClass: CustomOutput,
                propertyGridGroup: flowGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            {
                name: "catchError",
                type: PropertyType.Boolean,
                propertyGridGroup: flowGroup
            },
            {
                name: "asOutputProperties",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
                defaultValue: []
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (!jsObject.wireID) {
                jsObject.wireID = guid();
            }

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
        setRect: (object: Component, value: Rect) => {
            const props: Partial<Rect> = {};

            if (value.left !== object.left) {
                props.left = value.left;
            }

            if (!(object.autoSize == "width" || object.autoSize == "both")) {
                if (value.width !== object.width) {
                    props.width = value.width;
                }
            }

            if (value.top !== object.top) {
                props.top = value.top;
            }

            if (!(object.autoSize == "height" || object.autoSize == "both")) {
                if (value.height !== object.height) {
                    props.height = value.height;
                }
            }

            const DocumentStore = getDocumentStore(object);
            DocumentStore.updateObject(object, props);
        },
        isMoveable: (object: Component) => {
            return object.isMoveable;
        },
        isSelectable: (object: Component) => {
            return true;
        },

        check: (component: Component) => {
            let messages: Message[] = [];

            component.inputs.forEach(componentInput => {
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
            });

            const connectionLines =
                ProjectEditor.getFlow(component).connectionLines;
            component.outputs.forEach(componentOutput => {
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
            });

            const DocumentStore = getDocumentStore(component);

            if (
                DocumentStore.project.isAppletProject ||
                DocumentStore.project.isDashboardProject
            ) {
                for (const propertyInfo of getClassInfo(component).properties) {
                    if (isFlowProperty(DocumentStore, propertyInfo, "input")) {
                        const value = getProperty(component, propertyInfo.name);
                        if (value != undefined && value !== "") {
                            try {
                                if (
                                    propertyInfo.expressionIsConstant === true
                                ) {
                                    evalConstantExpression(
                                        DocumentStore.project,
                                        value
                                    );
                                } else {
                                    checkExpression(component, value, false);
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
                        isFlowProperty(
                            DocumentStore,
                            propertyInfo,
                            "assignable"
                        )
                    ) {
                        const value = getProperty(component, propertyInfo.name);
                        if (value != undefined && value !== "") {
                            try {
                                checkAssignableExpression(
                                    component,
                                    value,
                                    false
                                );
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
                    }
                }
            } else {
                ProjectEditor.documentSearch.checkObjectReference(
                    component,
                    "data",
                    messages
                );
                ProjectEditor.documentSearch.checkObjectReference(
                    component,
                    "action",
                    messages
                );
            }

            return messages;
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
            options?: { dropPlace?: IEezObject }
        ) => {
            const flow = ProjectEditor.getFlow(component);

            let keepConnectionLines =
                options &&
                options.dropPlace &&
                flow == ProjectEditor.getFlow(options.dropPlace);

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

    set geometry(value: ComponentGeometry) {
        this._geometry = value;
        this.width = this._geometry.width;
        this.height = this._geometry.height;
    }

    get rect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width ?? 0,
            height: this.height ?? 0
        };
    }

    @computed
    get absolutePositionPoint() {
        let x = this.left;
        let y = this.top;

        for (
            let parent = getWidgetParent(this);
            parent &&
            (parent instanceof ProjectEditor.PageClass ||
                parent instanceof ProjectEditor.WidgetClass);
            parent = getWidgetParent(parent)
        ) {
            x += parent.left;
            y += parent.top;
        }

        return { x, y };
    }

    @computed
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

    @computed get inputs(): ComponentInput[] {
        return this.getInputs();
    }

    getInputs(): ComponentInput[] {
        return this.customInputs ?? [];
    }

    @computed get outputs(): ComponentOutput[] {
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

    @computed({ keepAlive: true })
    get buildInputs() {
        const flow = ProjectEditor.getFlow(this);
        return this.inputs.filter(
            input =>
                input.name != "@seqin" ||
                flow.connectionLines.find(
                    connectionLine =>
                        connectionLine.targetComponent == this &&
                        connectionLine.input == "@seqin"
                )
        );
    }

    @computed({ keepAlive: true })
    get buildOutputs() {
        const outputs: { name: string; type: "output" | "property" }[] = [];

        const DocumentStore = getDocumentStore(this);

        for (const propertyInfo of getClassInfo(this).properties) {
            if (isFlowProperty(DocumentStore, propertyInfo, "output")) {
                outputs.push({
                    name: propertyInfo.name,
                    type:
                        !this.asOutputProperties ||
                        this.asOutputProperties.indexOf(propertyInfo.name) == -1
                            ? "property"
                            : "output"
                });
            }
        }

        for (const componentOutput of this.outputs) {
            if (!outputs.find(output => output.name == componentOutput.name)) {
                outputs.push({ name: componentOutput.name, type: "output" });
            }
        }

        return outputs;
    }

    @computed
    get isMoveable() {
        return true;
    }

    draw?: (ctx: CanvasRenderingContext2D) => void;

    render(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    getClassName() {
        return "";
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {}

    // return false if you don't want to propagete through "@seqout" output
    async execute(
        flowState: IFlowState,
        dispose: (() => void) | undefined
    ): Promise<(() => void) | undefined | boolean> {
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

export class Widget extends Component {
    @observable data?: string;
    @observable action?: string;
    @observable resizing: IResizing;
    @observable className: string;

    static classInfo: ClassInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            resizingProperty,
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
            {
                name: "className",
                type: PropertyType.String,
                propertyGridGroup: styleGroup,
                hideInPropertyGrid: hideInPropertyGridIfNotDashboard
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.type.startsWith("Local.")) {
                jsObject.layout = jsObject.type.substring("Local.".length);
                jsObject.type = "LayoutView";
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
                                objects as Component[]
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
                                objects as Component[]
                            );
                            context.selectObject(listWidget);
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Create Layout",
                        click: async () => {
                            const layoutWidget = await Widget.createLayout(
                                objects as Component[]
                            );
                            if (layoutWidget) {
                                context.selectObject(layoutWidget);
                            }
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Replace with Layout",
                        click: async () => {
                            const layoutWidget = await Widget.replaceWithLayout(
                                objects as Component[]
                            );
                            if (layoutWidget) {
                                context.selectObject(layoutWidget);
                            }
                        }
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

        check: (object: Component) => {
            let messages: Message[] = [];

            if (!(object instanceof ActionComponent)) {
                if (object.left < 0) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "Widget is outside of its parent",
                            getChildOfObject(object, "left")
                        )
                    );
                }

                if (object.top < 0) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
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
                            MessageType.ERROR,
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
                            MessageType.ERROR,
                            "Widget is outside of its parent",
                            getChildOfObject(object, "height")
                        )
                    );
                }
            }

            const DocumentStore = getDocumentStore(object);

            if (
                !DocumentStore.project.isAppletProject &&
                !DocumentStore.project.isDashboardProject
            ) {
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

            return messages;
        },
        showSelectedObjectsParent: () => {
            return true;
        },
        getResizeHandlers(object: Widget) {
            return object.getResizeHandlers();
        },
        componentHeaderColor: "#ddd"
    });

    putInSelect() {
        let thisWidgetJsObject = objectToJS(this);

        var selectWidgetJsObject = Object.assign(
            {},
            getClassFromType("Select")?.classInfo.defaultValue,
            { type: "Select" }
        );

        selectWidgetJsObject.left = this.left;
        selectWidgetJsObject.top = this.top;
        selectWidgetJsObject.width = this.width;
        selectWidgetJsObject.height = this.height;

        thisWidgetJsObject.left = 0;
        delete thisWidgetJsObject.left_;
        thisWidgetJsObject.top = 0;
        delete thisWidgetJsObject.top_;

        selectWidgetJsObject.widgets = [thisWidgetJsObject];

        const DocumentStore = getDocumentStore(this);

        return DocumentStore.replaceObject(
            this,
            loadObject(
                DocumentStore,
                getParent(this),
                selectWidgetJsObject,
                Component
            )
        );
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

    static putInContainer(fromWidgets: Component[]) {
        var containerWidgetJsObject: ContainerWidget = Object.assign(
            {},
            getClassFromType("Container")?.classInfo.defaultValue,
            { type: "Container" }
        );

        const createWidgetsResult = Widget.createWidgets(fromWidgets);

        containerWidgetJsObject.widgets = createWidgetsResult.widgets;

        containerWidgetJsObject.left = createWidgetsResult.left;
        containerWidgetJsObject.top = createWidgetsResult.top;
        containerWidgetJsObject.width = createWidgetsResult.width;
        containerWidgetJsObject.height = createWidgetsResult.height;

        const DocumentStore = getDocumentStore(fromWidgets[0]);

        return DocumentStore.replaceObjects(
            fromWidgets,
            loadObject(
                DocumentStore,
                getParent(fromWidgets[0]),
                containerWidgetJsObject,
                Component
            )
        );
    }

    static putInList(fromWidgets: Component[]) {
        let containerWidgetJsObject: ContainerWidget;
        if (
            fromWidgets.length == 1 &&
            (fromWidgets[0].type == "Container" ||
                fromWidgets[0].type == "ContainerWidget")
        ) {
            containerWidgetJsObject = objectToJS(fromWidgets[0]);
        } else {
            containerWidgetJsObject = Object.assign(
                {},
                getClassFromType("Container")?.classInfo.defaultValue,
                { type: "Container" }
            );

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            containerWidgetJsObject.widgets = createWidgetsResult.widgets;

            containerWidgetJsObject.left = createWidgetsResult.left;
            containerWidgetJsObject.top = createWidgetsResult.top;
            containerWidgetJsObject.width = createWidgetsResult.width;
            containerWidgetJsObject.height = createWidgetsResult.height;
        }

        var listWidgetJsObject: ListWidget = Object.assign(
            {},
            getClassFromType("List")?.classInfo.defaultValue,
            { type: "List" }
        );

        listWidgetJsObject.itemWidget = containerWidgetJsObject;

        listWidgetJsObject.left = containerWidgetJsObject.left;
        listWidgetJsObject.top = containerWidgetJsObject.top;
        listWidgetJsObject.width = containerWidgetJsObject.width;
        listWidgetJsObject.height = containerWidgetJsObject.height;

        containerWidgetJsObject.left = 0;
        containerWidgetJsObject.top = 0;

        const DocumentStore = getDocumentStore(fromWidgets[0]);

        return DocumentStore.replaceObjects(
            fromWidgets,
            loadObject(
                DocumentStore,
                getParent(fromWidgets[0]),
                listWidgetJsObject,
                Component
            )
        );
    }

    static async createLayout(fromWidgets: Component[]) {
        const DocumentStore = getDocumentStore(fromWidgets[0]);
        const layouts = DocumentStore.project.pages;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layout name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, layouts)
                            ]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const layoutName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            DocumentStore.addObject(
                layouts,
                loadObject(
                    DocumentStore,
                    undefined,
                    {
                        name: layoutName,
                        left: 0,
                        top: 0,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        widgets: createWidgetsResult.widgets
                    },
                    findClass("Page")!
                )
            );

            return DocumentStore.replaceObjects(
                fromWidgets,
                loadObject(
                    DocumentStore,
                    getParent(fromWidgets[0]),
                    {
                        type: "LayoutView",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        layout: layoutName
                    },
                    Component
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    static async replaceWithLayout(fromWidgets: Component[]) {
        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layout name",
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

            const layoutName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            return getDocumentStore(fromWidgets[0]).replaceObjects(
                fromWidgets,
                loadObject(
                    getDocumentStore(fromWidgets[0]),
                    getParent(fromWidgets[0]),
                    {
                        type: "LayoutView",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        layout: layoutName
                    },
                    Component
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
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
        return classNames("eez-widget-component", this.type, this.className);
    }

    render(flowContext: IFlowContext): React.ReactNode {
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
                                seq: output.name === "@seqout"
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
            optional: componentOutput.isOptionalOutput
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
                    {inputs.length > 0 && (
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
                    )}
                    {body ? (
                        <div
                            className="eez-flow-editor-capture-pointers"
                            style={{ width: "100%" }}
                        >
                            {body}
                        </div>
                    ) : null}
                    {outputs.length > 0 && (
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
                                    {getOutputDisplayName(actionNode, output)}
                                    <ComponentOutputSpan
                                        componentOutput={output}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

////////////////////////////////////////////////////////////////////////////////

export class ActionComponent extends Component {
    static classInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: []
    });

    get autoSize(): AutoSize {
        return "both";
    }

    @computed
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
            return `${ActionComponent.classInfo.label!(widget)} [NOT FOUND]`;
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
                connectionLine => connectionLine.target == this.wireID
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
                connectionLine => connectionLine.source == this.wireID
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

export function registerActionComponent(
    actionComponentDefinition: IActionComponentDefinition,
    name?: string,
    componentPaletteGroupName?: string
) {
    const properties: PropertyInfo[] = [];

    for (const propertyDefinition of actionComponentDefinition.properties) {
        if (propertyDefinition.type === "expression") {
            properties.push(
                makeExpressionProperty(
                    {
                        name: propertyDefinition.name,
                        displayName: propertyDefinition.displayName,
                        type: PropertyType.MultilineText,
                        propertyGridGroup: specificGroup
                    },
                    propertyDefinition.valueType
                )
            );
        } else {
            properties.push({
                name: propertyDefinition.name,
                displayName: propertyDefinition.displayName,
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup,
                monospaceFont: true
            });
        }
    }

    const actionComponentClass = class extends ActionComponent {
        static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
            label: () => actionComponentDefinition.name,
            properties,
            icon:
                typeof actionComponentDefinition.icon === "string" ? (
                    <img
                        src={
                            "data:image/svg+xml;charset=utf-8," +
                            actionComponentDefinition.icon
                        }
                    />
                ) : (
                    actionComponentDefinition.icon
                ),
            componentHeaderColor:
                actionComponentDefinition.componentHeaderColor,
            componentPaletteGroupName
        });

        constructor() {
            super();
        }

        getInputs(): ComponentInput[] {
            return [
                ...super.getInputs(),
                {
                    name: "@seqin",
                    type: "null",
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

        getBody(flowContext: IFlowContext): React.ReactNode {
            if (!actionComponentDefinition.bodyPropertyName) {
                return null;
            }
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

        override async execute(
            flowState: IFlowState,
            dispose: (() => void) | undefined
        ): Promise<(() => void) | undefined | boolean> {
            const props = [];

            for (const propertyDefinition of actionComponentDefinition.properties) {
                props.push((this as any)[propertyDefinition.name]);
            }

            return actionComponentDefinition.execute(
                {
                    evalExpression: (expression: string) => {
                        return flowState.evalExpression(this, expression);
                    },

                    propagateValue: (output: string, value: any) => {
                        flowState.runtime.propagateValue(
                            flowState,
                            this,
                            output,
                            value
                        );
                    },

                    log: (type: LogItemType, message: string) => {
                        flowState.log(type, message, this);
                    },

                    dispose
                },
                ...props
            );
        }
    };

    const decorators: {
        [propertyName: string]: PropertyDecorator;
    } = {};

    actionComponentDefinition.properties.forEach(
        propertyInfo => (decorators[propertyInfo.name] = observable)
    );

    decorate(actionComponentClass, decorators);

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
